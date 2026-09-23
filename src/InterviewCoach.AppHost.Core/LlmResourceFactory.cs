using Aspire.Hosting.Azure;

using Azure.Provisioning;
using Azure.Provisioning.CognitiveServices;

using Microsoft.Extensions.Configuration;

public static class LlmResourceFactory
{
    private const string DEFAULT_MODEL = "gpt-5-mini";
    private const string COPILOT_GITHUB_TOKEN_KEY = "COPILOT_GITHUB_TOKEN";
    private const string AGENT_MODE_KEY = "AgentMode";
    private const string LLM_PROVIDER_KEY = "LlmProvider";
    private const string SECTION_NAME_MICROSOFT_FOUNDRY = "MicrosoftFoundry";
    private const string SECTION_NAME_GITHUB_COPILOT = "GitHubCopilot";
    private const string TOKEN_KEY = "Token";
    private const string DEPLOYMENT_NAME_KEY = "DeploymentName";
    private const string MODEL_VERSION_KEY = "ModelVersion";
    private const string MODEL_FORMAT_KEY = "ModelFormat";
    private const string MODEL_KEY = "Model";
    private const string SKU_NAME_KEY = "SkuName";
    private const string SKU_CAPACITY_KEY = "SkuCapacity";
    private const string TOKEN_RESOURCE_NAME = "token";
    private const string LLM_PROJECT_NAME = "foundry";
    private const string LLM_RESOURCE_NAME = "chat";
    private const string USE_EXISTING_FOUNDRY_KEY = "MicrosoftFoundry:UseExisting";
    private const string EXISTING_FOUNDRY_SECTION = "MicrosoftFoundry:Existing";

    public static IResourceBuilder<ProjectResource> WithLlmReference(this IResourceBuilder<ProjectResource> source, IConfiguration config, IEnumerable<string> args)
    {
        var (provider, mode) = GetProviderAndAgentMode(config, args);

        source = provider switch
        {
            LlmProvider.MicrosoftFoundry => source.AddMicrosoftFoundryResource(config, provider, mode),
            LlmProvider.GitHubCopilot => source.AddGitHubCopilotResource(config, provider, mode),
            _ => throw new NotSupportedException($"The specified LLM provider '{provider}' is not supported.")
        };

        return source;
    }

    internal static (LlmProvider provider, AgentMode mode) GetProviderAndAgentMode(IConfiguration config, IEnumerable<string> args)
    {
        var provider = Enum.TryParse<LlmProvider>(config[LLM_PROVIDER_KEY], ignoreCase: true, out var parsedProvider) ? parsedProvider : LlmProvider.Unknown;
        var mode = Enum.TryParse<AgentMode>(config[AGENT_MODE_KEY], ignoreCase: true, out var parsedMode) ? parsedMode : AgentMode.Unknown;
        var arguments = args.ToArray();
        for (var index = 0; index < arguments.Length; index++)
        {
            switch (arguments[index])
            {
                case "--provider":
                case "-p":
                    provider = Enum.TryParse<LlmProvider>(GetArgumentValue(arguments, ref index), ignoreCase: true, out var parsedArgProvider) ? parsedArgProvider : LlmProvider.Unknown;
                    break;
                case "--mode":
                case "-m":
                    mode = Enum.TryParse<AgentMode>(GetArgumentValue(arguments, ref index), ignoreCase: true, out var parsedArgMode) ? parsedArgMode : AgentMode.Unknown;
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

        return (provider, mode);
    }

    private static string GetArgumentValue(string[] arguments, ref int index)
    {
        if (++index >= arguments.Length)
        {
            throw new InvalidOperationException($"Missing value for command-line argument '{arguments[index - 1]}'.");
        }

        return arguments[index];
    }

    private static IResourceBuilder<ProjectResource> AddMicrosoftFoundryResource(this IResourceBuilder<ProjectResource> source, IConfiguration config, LlmProvider provider, AgentMode mode)
    {
        if (GetExistingFoundryConfiguration(config) is { } existing)
        {
            return source.AddExistingMicrosoftFoundryResource(config, existing, provider, mode);
        }

        var foundry = config.GetSection(SECTION_NAME_MICROSOFT_FOUNDRY);
        var deploymentName = foundry[DEPLOYMENT_NAME_KEY] ?? DEFAULT_MODEL;
        var modelVersion = foundry[MODEL_VERSION_KEY] ?? "1";
        var modelFormat = foundry[MODEL_FORMAT_KEY] ?? "OpenAI";
        var skuName = foundry[SKU_NAME_KEY] ?? "GlobalStandard";
        var skuCapacity = int.TryParse(foundry[SKU_CAPACITY_KEY], out var capacity) ? capacity : 100;

        Console.WriteLine();
        Console.WriteLine($"\tLLM Provider: {provider}");
        Console.WriteLine($"\tModel: {deploymentName}");
        Console.WriteLine($"\tSKU: {skuName} ({skuCapacity}K TPM)");
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

    private static IResourceBuilder<ProjectResource> AddExistingMicrosoftFoundryResource(
        this IResourceBuilder<ProjectResource> source,
        IConfiguration config,
        ExistingFoundryConfiguration existing,
        LlmProvider provider,
        AgentMode mode)
    {
        var builder = source.ApplicationBuilder;
        if (builder.ExecutionContext.IsRunMode &&
            !string.Equals(config["Azure:AllowResourceGroupCreation"], "false", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException(
                "Foundry reuse requires Azure:AllowResourceGroupCreation=false. Use the existing Azure subscription, resource group, and location in your local AppHost configuration.");
        }

        var name = builder.AddParameter("existing-foundry-name", existing.Name);
        var resourceGroup = builder.AddParameter("existing-foundry-resource-group", existing.ResourceGroup);
        var subscription = builder.AddParameter("existing-foundry-subscription-id", existing.SubscriptionId);
        var deploymentName = builder.AddParameter("existing-foundry-deployment-name", existing.DeploymentName);

        builder.AddAzureProvisioning();

        // AddFoundry also provisions child deployments and a capability host, even on an existing account.
        // This reference-only template reads the account and deployment without changing either or assigning roles.
        var foundry = builder.AddResource(new AzureProvisioningResource(LLM_PROJECT_NAME, infrastructure =>
        {
            var account = AzureProvisioningResource.CreateExistingOrNewProvisionableResource(
                infrastructure,
                (identifier, accountName) =>
                {
                    var resource = CognitiveServicesAccount.FromExisting(identifier);
                    resource.Name = accountName;
                    return resource;
                },
                _ => throw new InvalidOperationException("Foundry reuse cannot provision a new account."));

            var deployment = CognitiveServicesAccountDeployment.FromExisting(LLM_RESOURCE_NAME);
            deployment.Parent = account;
            deployment.Name = deploymentName.Resource.AsProvisioningParameter(infrastructure);
            infrastructure.Add(deployment);

            infrastructure.Add(new ProvisioningOutput("endpoint", typeof(string))
            {
                Value = account.Properties.Endpoint
            });
            // Reading model metadata makes a missing deployment fail during resolution, not fall back to creation.
            infrastructure.Add(new ProvisioningOutput("model", typeof(string))
            {
                Value = deployment.Properties.Model.Name
            });
        })).AsExistingInResourceGroup(name, resourceGroup, subscription);

        var endpoint = new BicepOutputReference("endpoint", foundry.Resource);
        var chat = builder.AddResource(new ConnectionStringResource(
            LLM_RESOURCE_NAME,
            ReferenceExpression.Create($"Endpoint={endpoint};Deployment={deploymentName}")));

        Console.WriteLine();
        Console.WriteLine($"\tLLM Provider: {provider}");
        Console.WriteLine($"\tExisting Foundry account: {existing.Name}");
        Console.WriteLine($"\tExisting deployment: {existing.DeploymentName}");
        Console.WriteLine($"\tAgent Mode: {mode}");
        Console.WriteLine();

        return source.WithEnvironment(AGENT_MODE_KEY, mode.ToString())
                     .WithEnvironment(LLM_PROVIDER_KEY, provider.ToString())
                     .WithReference(chat)
                     .WaitFor(foundry);
    }

    internal static ExistingFoundryConfiguration? GetExistingFoundryConfiguration(IConfiguration config)
    {
        var useExistingValue = config[USE_EXISTING_FOUNDRY_KEY];
        if (useExistingValue is not null && !bool.TryParse(useExistingValue, out _))
        {
            throw new InvalidOperationException($"{USE_EXISTING_FOUNDRY_KEY} must be true or false.");
        }

        var section = config.GetSection(EXISTING_FOUNDRY_SECTION);
        if (!bool.TryParse(useExistingValue, out var useExisting) || !useExisting)
        {
            if (section.Exists())
            {
                throw new InvalidOperationException(
                    $"{EXISTING_FOUNDRY_SECTION} is configured but {USE_EXISTING_FOUNDRY_KEY} is not true. Enable reuse or remove the existing-resource configuration; refusing to provision a new account.");
            }

            return null;
        }

        string[] requiredKeys = ["Name", "ResourceGroup", "SubscriptionId", DEPLOYMENT_NAME_KEY];
        var missingKeys = requiredKeys.Where(key => string.IsNullOrWhiteSpace(section[key])).ToArray();
        if (missingKeys.Length > 0)
        {
            throw new InvalidOperationException(
                $"Foundry reuse requires all existing-resource settings. Missing configuration: {string.Join(", ", missingKeys.Select(key => $"{EXISTING_FOUNDRY_SECTION}:{key}"))}. No new account or deployment will be provisioned.");
        }

        var name = section["Name"]!.Trim();
        var resourceGroup = section["ResourceGroup"]!.Trim();
        var subscriptionId = section["SubscriptionId"]!.Trim();
        var deploymentName = section[DEPLOYMENT_NAME_KEY]!.Trim();
        if (!Guid.TryParse(subscriptionId, out var subscriptionGuid) || subscriptionGuid == Guid.Empty)
        {
            throw new InvalidOperationException($"{EXISTING_FOUNDRY_SECTION}:SubscriptionId must be an existing Azure subscription ID (a nonempty GUID).");
        }

        foreach (var key in new[] { "Name", "ResourceGroup", DEPLOYMENT_NAME_KEY })
        {
            var value = section[key]!;
            if (value.IndexOfAny(['<', '>', '{', '}', ';', '\r', '\n']) >= 0)
            {
                throw new InvalidOperationException($"{EXISTING_FOUNDRY_SECTION}:{key} must be an actual resource name, not a placeholder or connection string.");
            }
        }

        return new ExistingFoundryConfiguration(name, resourceGroup, subscriptionId, deploymentName);
    }

    internal sealed record ExistingFoundryConfiguration(string Name, string ResourceGroup, string SubscriptionId, string DeploymentName);

    private static IResourceBuilder<ProjectResource> AddGitHubCopilotResource(this IResourceBuilder<ProjectResource> source, IConfiguration config, LlmProvider provider, AgentMode mode)
    {
        var github = config.GetSection(SECTION_NAME_GITHUB_COPILOT);
        var tokenValue = GetGitHubToken(config);
        var model = github[MODEL_KEY] ?? DEFAULT_MODEL;

        Console.WriteLine();
        Console.WriteLine($"\tLLM Provider: {provider}");
        Console.WriteLine($"\tModel: {model}");
        Console.WriteLine($"\tAgent Mode: {mode}");
        Console.WriteLine();

        source = source.WithEnvironment(AGENT_MODE_KEY, mode.ToString())
                       .WithEnvironment(LLM_PROVIDER_KEY, provider.ToString())
                       .WithEnvironment($"{SECTION_NAME_GITHUB_COPILOT}__{MODEL_KEY}", model);

        if (tokenValue is not null)
        {
            var token = source.ApplicationBuilder
                              .AddParameter(name: TOKEN_RESOURCE_NAME, value: tokenValue, secret: true);
            source = source.WithEnvironment(COPILOT_GITHUB_TOKEN_KEY, token);
        }

        return source;
    }

    internal static string? GetGitHubToken(IConfiguration config)
    {
        var token = config[$"{SECTION_NAME_GITHUB_COPILOT}:{TOKEN_KEY}"]
            ?? config[COPILOT_GITHUB_TOKEN_KEY];

        if (string.IsNullOrWhiteSpace(token) ||
            (token.StartsWith("{{", StringComparison.Ordinal) &&
             token.EndsWith("}}", StringComparison.Ordinal)))
        {
            return null;
        }

        return token;
    }
}
