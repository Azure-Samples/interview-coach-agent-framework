extern alias AppHostCore;

using System.Text.RegularExpressions;

using Aspire.Hosting;
using Aspire.Hosting.ApplicationModel;
using Aspire.Hosting.Azure;
using Aspire.Hosting.Foundry;

using Microsoft.Extensions.Configuration;

using Xunit;

using CoreLlmResourceFactory = AppHostCore::LlmResourceFactory;

namespace InterviewCoach.Agent.Tests;

public class FoundryReuseTests
{
    private const string SubscriptionId = "11111111-2222-3333-4444-555555555555";

    [Theory]
    [InlineData(null)]
    [InlineData("false")]
    public void GetExistingFoundryConfiguration_NotSelectedPreservesProvisioning(string? useExisting)
    {
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["MicrosoftFoundry:UseExisting"] = useExisting
        }).Build();

        Assert.Null(CoreLlmResourceFactory.GetExistingFoundryConfiguration(config));
    }

    [Theory]
    [InlineData("")]
    [InlineData("yes")]
    [InlineData("1")]
    public void GetExistingFoundryConfiguration_InvalidSwitchFails(string useExisting)
    {
        var config = CreateConfiguration();
        config["MicrosoftFoundry:UseExisting"] = useExisting;

        var exception = Assert.Throws<InvalidOperationException>(
            () => CoreLlmResourceFactory.GetExistingFoundryConfiguration(config));

        Assert.Contains("MicrosoftFoundry:UseExisting", exception.Message);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("false")]
    public void GetExistingFoundryConfiguration_IdentifiersWithoutOptInNeverProvision(string? useExisting)
    {
        var config = CreateConfiguration();
        config["MicrosoftFoundry:UseExisting"] = useExisting;

        var exception = Assert.Throws<InvalidOperationException>(
            () => CoreLlmResourceFactory.GetExistingFoundryConfiguration(config));

        Assert.Contains("refusing to provision", exception.Message);
    }

    public static IEnumerable<object[]> IncompleteConfigurations()
    {
        for (var mask = 0; mask < 15; mask++)
        {
            yield return [mask];
        }
    }

    [Theory]
    [MemberData(nameof(IncompleteConfigurations))]
    public void GetExistingFoundryConfiguration_RequiresAllFourIdentifiers(int mask)
    {
        var config = CreateConfiguration();
        string[] keys = ["Name", "ResourceGroup", "SubscriptionId", "DeploymentName"];
        for (var index = 0; index < keys.Length; index++)
        {
            if ((mask & (1 << index)) == 0)
            {
                config[$"MicrosoftFoundry:Existing:{keys[index]}"] = " ";
            }
        }

        var exception = Assert.Throws<InvalidOperationException>(
            () => CoreLlmResourceFactory.GetExistingFoundryConfiguration(config));

        for (var index = 0; index < keys.Length; index++)
        {
            if ((mask & (1 << index)) == 0)
            {
                Assert.Contains($"MicrosoftFoundry:Existing:{keys[index]}", exception.Message);
            }
        }
    }

    [Theory]
    [InlineData("SubscriptionId", "{{SUBSCRIPTION_ID}}")]
    [InlineData("SubscriptionId", "00000000-0000-0000-0000-000000000000")]
    [InlineData("Name", "<foundry-name>")]
    [InlineData("ResourceGroup", "{{RESOURCE_GROUP}}")]
    [InlineData("DeploymentName", "chat;Key=not-a-key")]
    public void GetExistingFoundryConfiguration_InvalidIdentifiersFail(string key, string value)
    {
        var config = CreateConfiguration();
        config[$"MicrosoftFoundry:Existing:{key}"] = value;

        var exception = Assert.Throws<InvalidOperationException>(
            () => CoreLlmResourceFactory.GetExistingFoundryConfiguration(config));

        Assert.Contains($"MicrosoftFoundry:Existing:{key}", exception.Message);
        Assert.DoesNotContain(value, exception.Message);
    }

    [Fact]
    public void GetExistingFoundryConfiguration_UsesActualDeploymentNameNotModelName()
    {
        var config = CreateConfiguration();
        config["MicrosoftFoundry:DeploymentName"] = "model-not-deployment";
        config["MicrosoftFoundry:Existing:DeploymentName"] = " workshop-chat ";

        var existing = CoreLlmResourceFactory.GetExistingFoundryConfiguration(config);

        Assert.NotNull(existing);
        Assert.Equal("existing-account", existing.Name);
        Assert.Equal("existing-group", existing.ResourceGroup);
        Assert.Equal(SubscriptionId, existing.SubscriptionId);
        Assert.Equal("workshop-chat", existing.DeploymentName);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("true")]
    public void WithLlmReference_ReuseCannotCreateResourceGroups(string? allowResourceGroupCreation)
    {
        var builder = CreateBuilder();
        var agent = builder.AddResource(new ProjectResource("agent"));
        var config = CreateConfiguration();
        config["Azure:AllowResourceGroupCreation"] = allowResourceGroupCreation;

        var exception = Assert.Throws<InvalidOperationException>(
            () => CoreLlmResourceFactory.WithLlmReference(agent, config, []));

        Assert.Contains("Azure:AllowResourceGroupCreation=false", exception.Message);
        Assert.Single(builder.Resources);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void WithLlmReference_ReuseTemplateContainsOnlyExistingResources(bool publish)
    {
        var builder = CreateBuilder(publish);
        var agent = builder.AddResource(new ProjectResource("agent"));
        var config = CreateConfiguration();

        CoreLlmResourceFactory.WithLlmReference(agent, config, []);

        var foundry = Assert.Single(builder.Resources.OfType<AzureProvisioningResource>());
        Assert.True(foundry.IsExisting());
        Assert.Empty(builder.Resources.OfType<FoundryResource>());
        Assert.Empty(builder.Resources.OfType<FoundryDeploymentResource>());
        var existing = Assert.Single(foundry.Annotations.OfType<ExistingAzureResourceAnnotation>());
        Assert.Equal("existing-foundry-name", Assert.IsType<ParameterResource>(existing.Name).Name);
        Assert.Equal("existing-foundry-resource-group", Assert.IsType<ParameterResource>(existing.ResourceGroup).Name);
        Assert.Equal("existing-foundry-subscription-id", Assert.IsType<ParameterResource>(existing.Subscription).Name);
        Assert.Equal(4, builder.Resources.OfType<ParameterResource>().Count());
        Assert.All(builder.Resources.OfType<ParameterResource>(), parameter => Assert.False(parameter.Secret));

        using var template = foundry.GetBicepTemplateFile();
        var bicep = File.ReadAllText(template.Path);
        var declarations = Regex.Matches(bicep, @"(?m)^resource .+$");
        Assert.Equal(2, declarations.Count);
        Assert.All(declarations.Cast<Match>(), declaration => Assert.EndsWith(" existing = {", declaration.Value));
        Assert.Contains("Microsoft.CognitiveServices/accounts@", bicep);
        Assert.Contains("Microsoft.CognitiveServices/accounts/deployments@", bicep);
        Assert.Contains("output endpoint string = foundry.properties.endpoint", bicep);
        Assert.Contains("output model string = chat.properties.model.name", bicep);
        Assert.DoesNotContain("roleAssignments", bicep);
        Assert.DoesNotContain("capabilityHosts", bicep);
        Assert.DoesNotContain("sku", bicep);
        Assert.DoesNotContain("location:", bicep);
        Assert.DoesNotContain("listKeys", bicep);
        Assert.NotNull(foundry.Scope);
        Assert.Equal(existing.ResourceGroup, foundry.Scope.ResourceGroup);
        Assert.Equal(existing.Subscription, foundry.Scope.Subscription);
        Assert.Same(foundry, Assert.Single(agent.Resource.Annotations.OfType<WaitAnnotation>()).Resource);
    }

    [Fact]
    public void WithLlmReference_ReuseNeverCreatesAnAccountIfExistingAnnotationIsRemoved()
    {
        var builder = CreateBuilder();
        var agent = builder.AddResource(new ProjectResource("agent"));
        CoreLlmResourceFactory.WithLlmReference(agent, CreateConfiguration(), []);
        var foundry = Assert.Single(builder.Resources.OfType<AzureProvisioningResource>());
        var existing = Assert.Single(foundry.Annotations.OfType<ExistingAzureResourceAnnotation>());
        foundry.Annotations.Remove(existing);

        var exception = Assert.Throws<InvalidOperationException>(() => foundry.GetBicepTemplateFile());

        Assert.Contains("cannot provision a new account", exception.Message);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task WithLlmReference_ReusePassesExistingEndpointAndDeploymentToAgent(bool publish)
    {
        var builder = CreateBuilder(publish);
        var agent = builder.AddResource(new ProjectResource("agent"));
        var config = CreateConfiguration();
        config["MicrosoftFoundry:DeploymentName"] = "unused-model";
        config["MicrosoftFoundry:SkuName"] = "unused-sku";
        config["MicrosoftFoundry:ModelVersion"] = "unused-version";

        CoreLlmResourceFactory.WithLlmReference(agent, config, []);

        var foundry = Assert.Single(builder.Resources.OfType<AzureProvisioningResource>());
        foundry.Outputs["endpoint"] = "https://existing-account.cognitiveservices.azure.com/";
        var environment = await GetEnvironmentAsync(builder, agent.Resource);
        Assert.Equal("MicrosoftFoundry", environment["LlmProvider"]);
        Assert.Equal("Single", environment["AgentMode"]);
        var connection = Assert.IsAssignableFrom<IValueProvider>(environment["ConnectionStrings__chat"]);
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(5));
        Assert.Equal(
            "Endpoint=https://existing-account.cognitiveservices.azure.com/;Deployment=workshop-chat",
            await connection.GetValueAsync(timeout.Token));
    }

    [Fact]
    public async Task WithLlmReference_ReuseResolutionFailureReachesAgentWithoutProvisioningFallback()
    {
        var builder = CreateBuilder();
        var agent = builder.AddResource(new ProjectResource("agent"));
        CoreLlmResourceFactory.WithLlmReference(agent, CreateConfiguration(), []);
        var foundry = Assert.Single(builder.Resources.OfType<AzureProvisioningResource>());
        var failure = new InvalidOperationException("The existing model deployment was not found.");
        foundry.ProvisioningTaskCompletionSource = new TaskCompletionSource();
        foundry.ProvisioningTaskCompletionSource.SetException(failure);
        var environment = await GetEnvironmentAsync(builder, agent.Resource);
        var connection = Assert.IsAssignableFrom<IValueProvider>(environment["ConnectionStrings__chat"]);
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(5));

        var exception = await Assert.ThrowsAsync<InvalidOperationException>(
            async () => await connection.GetValueAsync(timeout.Token));

        Assert.Same(failure, exception);
        Assert.Empty(builder.Resources.OfType<FoundryResource>());
        Assert.Empty(builder.Resources.OfType<FoundryDeploymentResource>());
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void WithLlmReference_DefaultFoundryProvisioningIsUnchanged(bool publish)
    {
        var builder = CreateBuilder(publish);
        var agent = builder.AddResource(new ProjectResource("agent"));
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["LlmProvider"] = "MicrosoftFoundry",
            ["AgentMode"] = "HandOff",
            ["MicrosoftFoundry:DeploymentName"] = "configured-model",
            ["MicrosoftFoundry:ModelVersion"] = "configured-version",
            ["MicrosoftFoundry:ModelFormat"] = "OpenAI",
            ["MicrosoftFoundry:SkuName"] = "GlobalStandard",
            ["MicrosoftFoundry:SkuCapacity"] = "42"
        }).Build();

        CoreLlmResourceFactory.WithLlmReference(agent, config, []);

        var foundry = Assert.Single(builder.Resources.OfType<FoundryResource>());
        Assert.False(foundry.IsExisting());
        var chat = Assert.Single(builder.Resources.OfType<FoundryDeploymentResource>());
        Assert.Equal("chat", chat.Name);
        Assert.Equal("chat", chat.DeploymentName);
        Assert.Equal("configured-model", chat.ModelName);
        Assert.Equal("configured-version", chat.ModelVersion);
        Assert.Equal("OpenAI", chat.Format);
        Assert.Equal("GlobalStandard", chat.SkuName);
        Assert.Equal(42, chat.SkuCapacity);
        Assert.Same(foundry, chat.Parent);
        var dependencies = agent.Resource.Annotations.OfType<WaitAnnotation>().Select(annotation => annotation.Resource);
        Assert.Contains(foundry, dependencies);
        Assert.Contains(chat, dependencies);
    }

    [Theory]
    [InlineData("Single", null)]
    [InlineData("HandOff", "github_pat_test")]
    public async Task WithLlmReference_GitHubCopilotStillSupportsBothModesAndAuthentication(string mode, string? token)
    {
        var builder = CreateBuilder();
        var agent = builder.AddResource(new ProjectResource("agent"));
        var config = CreateConfiguration();
        config["AgentMode"] = mode;
        config["GitHubCopilot:Model"] = "configured-copilot-model";
        config["GitHubCopilot:Token"] = token;

        CoreLlmResourceFactory.WithLlmReference(agent, config, ["--provider", "GitHubCopilot"]);

        Assert.Empty(builder.Resources.OfType<AzureProvisioningResource>());
        Assert.Empty(builder.Resources.OfType<ConnectionStringResource>());
        var environment = await GetEnvironmentAsync(builder, agent.Resource);
        Assert.Equal("GitHubCopilot", environment["LlmProvider"]);
        Assert.Equal(mode, environment["AgentMode"]);
        Assert.Equal("configured-copilot-model", environment["GitHubCopilot__Model"]);
        if (token is null)
        {
            Assert.False(environment.ContainsKey("COPILOT_GITHUB_TOKEN"));
            Assert.Empty(builder.Resources.OfType<ParameterResource>());
        }
        else
        {
            Assert.True(Assert.Single(builder.Resources.OfType<ParameterResource>()).Secret);
            using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(5));
            Assert.Equal(token, await Assert.IsAssignableFrom<IValueProvider>(
                environment["COPILOT_GITHUB_TOKEN"]).GetValueAsync(timeout.Token));
        }
    }

    private static IConfigurationRoot CreateConfiguration()
    {
        return new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["LlmProvider"] = "MicrosoftFoundry",
            ["AgentMode"] = "Single",
            ["MicrosoftFoundry:UseExisting"] = "true",
            ["MicrosoftFoundry:Existing:Name"] = "existing-account",
            ["MicrosoftFoundry:Existing:ResourceGroup"] = "existing-group",
            ["MicrosoftFoundry:Existing:SubscriptionId"] = SubscriptionId,
            ["MicrosoftFoundry:Existing:DeploymentName"] = "workshop-chat",
            ["Azure:AllowResourceGroupCreation"] = "false"
        }).Build();
    }

    private static IDistributedApplicationBuilder CreateBuilder(bool publish = false)
    {
        // Use an assembly without a UserSecretsId and never build or start an AppHost.
        var builder = DistributedApplication.CreateBuilder(new DistributedApplicationOptions
        {
            AssemblyName = typeof(DistributedApplication).Assembly.GetName().Name,
            Args = publish ? ["--publisher", "manifest"] : [],
            DisableDashboard = true
        });
        builder.Configuration.Sources.Clear();
        Assert.Equal(publish, builder.ExecutionContext.IsPublishMode);
        return builder;
    }

    private static async Task<Dictionary<string, object>> GetEnvironmentAsync(
        IDistributedApplicationBuilder builder, ProjectResource resource)
    {
        var context = new EnvironmentCallbackContext(builder.ExecutionContext, resource);
        foreach (var annotation in resource.Annotations.OfType<EnvironmentCallbackAnnotation>())
        {
            await annotation.Callback(context);
        }

        return context.EnvironmentVariables;
    }
}
