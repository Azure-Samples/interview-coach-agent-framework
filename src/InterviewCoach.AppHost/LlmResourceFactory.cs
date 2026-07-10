using Microsoft.Extensions.Configuration;

public enum LlmProvider
{
    Unknown,
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
    private const string SECTION_NAME_AZURE_OPENAI = "Azure:OpenAI";
    private const string SECTION_NAME_MICROSOFT_FOUNDRY = "MicrosoftFoundry";
    private const string SECTION_NAME_GITHUB_COPILOT = "GitHubCopilot";
    private const string ENDPOINT_KEY = "Endpoint";
    private const string TOKEN_KEY = "Token";
    private const string API_KEY_KEY = "ApiKey";
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
