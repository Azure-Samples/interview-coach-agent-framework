using Aspire.Hosting.ApplicationModel;
using Aspire.Hosting.Azure;
using Aspire.Hosting.Azure.AppContainers;

using Azure.Provisioning;
using Azure.Provisioning.AppContainers;
using Azure.Provisioning.Expressions;
using Azure.Provisioning.Storage;

/// <summary>
/// Provides persistent storage for the SQLite database when the application is published
/// to Azure Container Apps by provisioning an Azure Files share and mounting it into the
/// project's container app. Without this the SQLite file lives on the container's ephemeral
/// (and read-only in places) file system, so it is lost on restart/scale and the injected
/// local-development connection string points at a host path that does not exist in the
/// container.
/// </summary>
internal static class AzureFileShareExtensions
{
    // Azure Container Apps resource names. The volume's StorageName must match the name of
    // the managed environment storage that is registered on the environment.
    private const string EnvironmentStorageName = "sqlitedata";
    private const string VolumeName = "sqlitedata";
    private const string FileShareName = "interviewdata";

    /// <summary>
    /// Provisions an Azure Files share on the Container Apps environment and mounts it into
    /// the project, pointing the SQLite database at the mounted path so the data is persisted.
    /// </summary>
    /// <param name="project">The project resource to mount the share into.</param>
    /// <param name="environment">The Container Apps environment that hosts the share.</param>
    /// <param name="mountPath">The container path to mount the share at (for example <c>/data</c>).</param>
    /// <param name="databaseFileName">The SQLite database file name stored on the share.</param>
    public static IResourceBuilder<ProjectResource> WithSqliteAzureFileShare(
        this IResourceBuilder<ProjectResource> project,
        IResourceBuilder<AzureContainerAppEnvironmentResource> environment,
        string mountPath,
        string databaseFileName)
    {
        // 1) Provision a storage account + Azure Files share and register it as managed
        //    environment storage on the Container Apps environment.
        environment.ConfigureInfrastructure(infrastructure =>
        {
            var storageAccount = new StorageAccount("sqliteStorageAccount")
            {
                Name = BicepFunction.Interpolate($"sqlite{BicepFunction.GetUniqueString(BicepFunction.GetResourceGroup().Id)}"),
                Kind = StorageKind.StorageV2,
                Sku = new StorageSku { Name = StorageSkuName.StandardLrs },
            };

            var fileService = new FileService("sqliteFileService")
            {
                Parent = storageAccount,
            };

            var fileShare = new Azure.Provisioning.Storage.FileShare("sqliteFileShare")
            {
                Parent = fileService,
                Name = FileShareName,
                ShareQuota = 1,
                EnabledProtocol = FileShareEnabledProtocol.Smb,
            };

            var managedEnvironment = infrastructure.GetProvisionableResources()
                                                   .OfType<ContainerAppManagedEnvironment>()
                                                   .Single();

            infrastructure.Add(storageAccount);
            infrastructure.Add(fileService);
            infrastructure.Add(fileShare);

            // Reference the storage account's primary key as a Bicep expression
            // (listKeys(...).keys[0].value). The strongly typed GetKeys()[0].Value path
            // materialises to null for an expression-backed list, so the expression is
            // composed explicitly.
            var accountKey = new MemberExpression(
                new IndexExpression(storageAccount.GetKeys().ToBicepExpression(), 0),
                "value");

            var environmentStorage = new ContainerAppManagedEnvironmentStorage("sqliteEnvironmentStorage")
            {
                Parent = managedEnvironment,
                Name = EnvironmentStorageName,
                Properties = new ManagedEnvironmentStorageProperties
                {
                    AzureFile = new ContainerAppAzureFileProperties
                    {
                        AccountName = storageAccount.Name,
                        AccountKey = accountKey,
                        ShareName = fileShare.Name,
                        AccessMode = ContainerAppAccessMode.ReadWrite,
                    },
                },
            };

            infrastructure.Add(environmentStorage);
        });

        // 2) Mount the Azure Files share into the project's container app.
        project.PublishAsAzureContainerApp((_, app) =>
        {
            // SQLite uses EXCLUSIVE locking on the shared file, so only one replica may hold
            // the database open at a time. Pin the app to a single replica.
            app.Template.Scale = new ContainerAppScale
            {
                MinReplicas = 1,
                MaxReplicas = 1,
            };

            app.Template.Volumes.Add(new ContainerAppVolume
            {
                Name = VolumeName,
                StorageType = ContainerAppStorageType.AzureFile,
                StorageName = EnvironmentStorageName,
            });

            app.Template.Containers[0].Value!.VolumeMounts.Add(new ContainerAppVolumeMount
            {
                VolumeName = VolumeName,
                MountPath = mountPath,
            });
        });

        // 3) Point the SQLite database at the mounted, persistent path.
        return project.WithEnvironment("ConnectionStrings__sqlite", $"Data Source={mountPath}/{databaseFileName}");
    }
}
