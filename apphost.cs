#:sdk Aspire.AppHost.Sdk@13.4.6
#:package Aspire.Hosting.Azure
#:package Aspire.Hosting.Azure.AppContainers
#:package Aspire.Hosting.Foundry
#:package Aspire.Hosting.GitHub.Models
#:package Aspire.Hosting.OpenAI
#:package Azure.Provisioning.Storage
#:package CommunityToolkit.Aspire.Hosting.SQLite
#:project ./src/InterviewCoach.Agent/InterviewCoach.Agent.csproj
#:project ./src/InterviewCoach.Mcp.InterviewData/InterviewCoach.Mcp.InterviewData.csproj
#:project ./src/InterviewCoach.WebUI/InterviewCoach.WebUI.csproj

using Aspire.Hosting.Azure.AppContainers;

using Azure.Provisioning;
using Azure.Provisioning.AppContainers;
using Azure.Provisioning.Expressions;
using Azure.Provisioning.Storage;

using Microsoft.Extensions.Configuration;

const string RESOURCE_CONSTANTS_LLM_PROVIDER = "LlmProvider";
const string RESOURCE_MCP_MARKITDOWN = "mcp-markitdown";
const string RESOURCE_MCP_INTERVIEWDATA = "mcp-interview-data";
const string RESOURCE_DB_SQLITE = "sqlite";
const string RESOURCE_DB_NAME = "interviewcoach.db";
const string RESOURCE_CONTAINERAPP_ENVIRONMENT = "cae";
const string RESOURCE_PROJECT_AGENT = "agent";
const string RESOURCE_PROJECT_WEBUI = "webui";

var builder = DistributedApplication.CreateBuilder(args);

var config = builder.Configuration
                    .AddJsonFile("apphost.settings.json", optional: true, reloadOnChange: true)
                    .AddUserSecrets(typeof(Program).Assembly, optional: true, reloadOnChange: true)
                    .Build();

var mcpMarkItDown = builder.AddContainer(RESOURCE_MCP_MARKITDOWN, "mcp/markitdown", "latest")
                           .WithExternalHttpEndpoints()
                           .WithImageTag("latest")
                           .WithHttpEndpoint(targetPort: 3001)
                           .WithArgs("--http", "--host", "0.0.0.0", "--port", "3001");

var sqlite = builder.AddSqlite(RESOURCE_DB_SQLITE, databaseFileName: RESOURCE_DB_NAME);
if (builder.ExecutionContext.IsRunMode)
{
    sqlite.WithSqliteWeb();
}

var mcpInterviewData = builder.AddProject<Projects.InterviewCoach_Mcp_InterviewData>(RESOURCE_MCP_INTERVIEWDATA)
                              .WithExternalHttpEndpoints();

if (builder.ExecutionContext.IsRunMode)
{
    // Local development: use the SQLite file managed by the Aspire "sqlite" resource
    // (also surfaced through the sqlite-web viewer).
    mcpInterviewData.WithReference(sqlite)
                    .WaitFor(sqlite);
}
else
{
    // When published to Azure Container Apps the SQLite database must live on a persistent,
    // writable mount. Provision an Azure Files share and mount it into the InterviewData
    // container so the database survives restarts and scale operations.
    var containerAppEnvironment = builder.AddAzureContainerAppEnvironment(RESOURCE_CONTAINERAPP_ENVIRONMENT);
    mcpInterviewData.WithSqliteAzureFileShare(containerAppEnvironment, mountPath: "/data", databaseFileName: RESOURCE_DB_NAME);
}

var agent = builder.AddProject<Projects.InterviewCoach_Agent>(RESOURCE_PROJECT_AGENT)
                   .WithExternalHttpEndpoints()
                   .WithLlmReference(builder.Configuration, args)
                   .WithEnvironment(RESOURCE_CONSTANTS_LLM_PROVIDER, builder.Configuration[RESOURCE_CONSTANTS_LLM_PROVIDER] ?? string.Empty)
                   .WithReference(mcpMarkItDown.GetEndpoint("http"))
                   .WithReference(mcpInterviewData)
                   .WaitFor(mcpMarkItDown)
                   .WaitFor(mcpInterviewData);

var webUI = builder.AddProject<Projects.InterviewCoach_WebUI>(RESOURCE_PROJECT_WEBUI)
                   .WithExternalHttpEndpoints()
                   .WithReference(agent)
                   .WaitFor(agent);

await builder.Build().RunAsync();

public enum LlmProvider
{
    Unknown,
    GitHubModels,
    AzureOpenAI,
    MicrosoftFoundry,
    GitHubCopilot
}

public enum AgentMode
{
    Unknown,
    Single,
    LlmHandOff,
    CopilotHandOff
}

public static class LlmResourceFactory
{
    private const string GITHUB_TOKEN_KEY = "GITHUB_TOKEN";
    private const string AGENT_MODE_KEY = "AgentMode";
    private const string LLM_PROVIDER_KEY = "LlmProvider";
    private const string SECTION_NAME_GITHUB = "GitHub";
    private const string SECTION_NAME_AZURE_OPENAI = "Azure:OpenAI";
    private const string SECTION_NAME_MICROSOFT_FOUNDRY = "MicrosoftFoundry";
    private const string SECTION_NAME_GITHUB_COPILOT = "GitHubCopilot";
    private const string ENDPOINT_KEY = "Endpoint";
    private const string TOKEN_KEY = "Token";
    private const string API_KEY_KEY = "ApiKey";
    private const string MODEL_KEY = "Model";
    private const string DEPLOYMENT_NAME_KEY = "DeploymentName";
    private const string MODEL_VERSION_KEY = "ModelVersion";
    private const string MODEL_FORMAT_KEY = "ModelFormat";
    private const string SKU_NAME_KEY = "SkuName";
    private const string SKU_CAPACITY_KEY = "SkuCapacity";
    private const string API_KEY_RESOURCE_NAME = "apiKey";
    private const string TOKEN_RESOURCE_NAME = "token";
    private const string LLM_PROJECT_NAME = "foundry";
    private const string LLM_SERVICE_NAME = "openai";
    private const string LLM_RESOURCE_NAME = "chat";

    public static IResourceBuilder<ProjectResource> WithLlmReference(this IResourceBuilder<ProjectResource> source, IConfiguration config, IEnumerable<string> args)
    {
        var (provider, mode) = GetProviderAndAgentMode(config, args);

        source = provider switch
        {
            LlmProvider.GitHubModels => source.AddGitHubModelsResource(config, provider, mode),
            LlmProvider.AzureOpenAI => source.AddAzureOpenAIResource(config, provider, mode),
            LlmProvider.MicrosoftFoundry => source.AddMicrosoftFoundryResource(config, provider, mode),
            LlmProvider.GitHubCopilot => source.AddGitHubCopilotResource(config, provider, mode),
            _ => throw new NotSupportedException($"The specified LLM provider '{provider}' is not supported.")
        };

        return source;
    }

    private static (LlmProvider provider, AgentMode mode) GetProviderAndAgentMode(IConfiguration config, IEnumerable<string> args)
    {
        var provider = Enum.TryParse<LlmProvider>(config[LLM_PROVIDER_KEY], ignoreCase: true, out var parsedProvider) ? parsedProvider : LlmProvider.Unknown;
        var mode = Enum.TryParse<AgentMode>(config[AGENT_MODE_KEY], ignoreCase: true, out var parsedMode) ? parsedMode : AgentMode.Unknown;
        foreach (var arg in args)
        {
            var index = args.ToList().IndexOf(arg);
            switch (arg)
            {
                case "--provider":
                case "-p":
                    provider = Enum.TryParse<LlmProvider>(args.ToList()[index + 1], ignoreCase: true, out var parsedArgProvider) ? parsedArgProvider : LlmProvider.Unknown;
                    break;
                case "--mode":
                case "-m":
                    mode = Enum.TryParse<AgentMode>(args.ToList()[index + 1], ignoreCase: true, out var parsedArgMode) ? parsedArgMode : AgentMode.Unknown;
                    break;
            }
        }
        if (provider == LlmProvider.Unknown)
        {
            throw new InvalidOperationException($"Missing configuration: {LLM_PROVIDER_KEY}");
        }
        if (mode == AgentMode.Unknown)
        {
            throw new InvalidOperationException($"Missing configuration: {AGENT_MODE_KEY}");
        }
        if (provider != LlmProvider.GitHubCopilot && mode == AgentMode.CopilotHandOff)
        {
            throw new InvalidOperationException($"The specified LLM provider '{provider}' is not supported for the '{mode}' mode.");
        }

        return (provider, mode);
    }

    private static IResourceBuilder<ProjectResource> AddGitHubModelsResource(this IResourceBuilder<ProjectResource> source, IConfiguration config, LlmProvider provider, AgentMode mode)
    {
        var github = config.GetSection(SECTION_NAME_GITHUB);
        var token = github[TOKEN_KEY] ?? throw new InvalidOperationException($"Missing configuration: {SECTION_NAME_GITHUB}:{TOKEN_KEY}");
        var model = github[MODEL_KEY] ?? throw new InvalidOperationException($"Missing configuration: {SECTION_NAME_GITHUB}:{MODEL_KEY}");

        Console.WriteLine();
        Console.WriteLine($"\tLLM Provider: {provider}");
        Console.WriteLine($"\tModel: {model}");
        Console.WriteLine($"\tAgent Mode: {mode}");
        Console.WriteLine();

        var apiKey = source.ApplicationBuilder
                           .AddParameter(name: API_KEY_RESOURCE_NAME, value: token, secret: true);
        var chat = source.ApplicationBuilder
                         .AddGitHubModel(name: LLM_RESOURCE_NAME, model: model)
                         .WithApiKey(apiKey);

        return source.WithEnvironment(AGENT_MODE_KEY, mode.ToString())
                     .WithEnvironment(LLM_PROVIDER_KEY, provider.ToString())
                     .WithReference(chat)
                     .WaitFor(chat);
    }

    private static IResourceBuilder<ProjectResource> AddAzureOpenAIResource(this IResourceBuilder<ProjectResource> source, IConfiguration config, LlmProvider provider, AgentMode mode)
    {
        var azure = config.GetSection(SECTION_NAME_AZURE_OPENAI);
        var endpoint = azure[ENDPOINT_KEY] ?? throw new InvalidOperationException($"Missing configuration: {SECTION_NAME_AZURE_OPENAI}:{ENDPOINT_KEY}");
        var accessKey = azure[API_KEY_KEY] ?? throw new InvalidOperationException($"Missing configuration: {SECTION_NAME_AZURE_OPENAI}:{API_KEY_KEY}");
        var deploymentName = azure[DEPLOYMENT_NAME_KEY] ?? throw new InvalidOperationException($"Missing configuration: {SECTION_NAME_AZURE_OPENAI}:{DEPLOYMENT_NAME_KEY}");

        Console.WriteLine();
        Console.WriteLine($"\tLLM Provider: {provider}");
        Console.WriteLine($"\tModel: {deploymentName}");
        Console.WriteLine($"\tAgent Mode: {mode}");
        Console.WriteLine();

        var apiKey = source.ApplicationBuilder
                           .AddParameter(name: API_KEY_RESOURCE_NAME, value: accessKey, secret: true);
        var chat = source.ApplicationBuilder
                         .AddOpenAI(LLM_SERVICE_NAME)
                         .WithEndpoint($"{endpoint.TrimEnd('/')}/openai/v1/")
                         .WithApiKey(apiKey)
                         .AddModel(name: LLM_RESOURCE_NAME, model: deploymentName);

        return source.WithEnvironment(AGENT_MODE_KEY, mode.ToString())
                     .WithEnvironment(LLM_PROVIDER_KEY, provider.ToString())
                     .WithReference(chat)
                     .WaitFor(chat);
    }

    private static IResourceBuilder<ProjectResource> AddMicrosoftFoundryResource(this IResourceBuilder<ProjectResource> source, IConfiguration config, LlmProvider provider, AgentMode mode)
    {
        var foundry = config.GetSection(SECTION_NAME_MICROSOFT_FOUNDRY);
        var deploymentName = foundry[DEPLOYMENT_NAME_KEY] ?? throw new InvalidOperationException($"Missing configuration: {SECTION_NAME_MICROSOFT_FOUNDRY}:{DEPLOYMENT_NAME_KEY}");
        var modelVersion = foundry[MODEL_VERSION_KEY] ?? "1";
        var modelFormat = foundry[MODEL_FORMAT_KEY] ?? "OpenAI";
        var skuName = foundry[SKU_NAME_KEY] ?? "GlobalStandard";
        var skuCapacity = int.TryParse(foundry[SKU_CAPACITY_KEY], out var capacity) ? capacity : 100;

        Console.WriteLine();
        Console.WriteLine($"\tLLM Provider: {provider}");
        Console.WriteLine($"\tModel: {deploymentName}");
        Console.WriteLine($"\tAgent Mode: {mode}");
        Console.WriteLine();

        var chat = source.ApplicationBuilder
                         .AddFoundry(LLM_PROJECT_NAME)
                         .AddDeployment(LLM_RESOURCE_NAME, deploymentName, modelVersion, modelFormat)
                         .WithProperties(deployment =>
                         {
                             deployment.SkuName = skuName;
                             deployment.SkuCapacity = skuCapacity;
                         });

        return source.WithEnvironment(AGENT_MODE_KEY, mode.ToString())
                     .WithEnvironment(LLM_PROVIDER_KEY, provider.ToString())
                     .WithReference(chat)
                     .WaitFor(chat);
    }

    private static IResourceBuilder<ProjectResource> AddGitHubCopilotResource(this IResourceBuilder<ProjectResource> source, IConfiguration config, LlmProvider provider, AgentMode mode)
    {
        var github = config.GetSection(SECTION_NAME_GITHUB_COPILOT);
        var tokenValue = github[TOKEN_KEY] ?? throw new InvalidOperationException($"Missing configuration: {SECTION_NAME_GITHUB_COPILOT}:{TOKEN_KEY}");

        Console.WriteLine();
        Console.WriteLine($"\tLLM Provider: {provider}");
        Console.WriteLine($"\tAgent Mode: {mode}");
        Console.WriteLine();

        var token = source.ApplicationBuilder
                          .AddParameter(name: TOKEN_RESOURCE_NAME, value: tokenValue, secret: true);

        return source.WithEnvironment(AGENT_MODE_KEY, mode.ToString())
                     .WithEnvironment(LLM_PROVIDER_KEY, provider.ToString())
                     .WithEnvironment(GITHUB_TOKEN_KEY, token)
                     .WaitFor(token);
    }
}

/// <summary>
/// Provides persistent storage for the SQLite database when the application is published
/// to Azure Container Apps by provisioning an Azure Files share and mounting it into the
/// project's container app. Without this the SQLite file lives on the container's ephemeral
/// (and read-only in places) file system, so it is lost on restart/scale and the injected
/// local-development connection string points at a host path that does not exist in the
/// container.
/// </summary>
public static class AzureFileShareExtensions
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
