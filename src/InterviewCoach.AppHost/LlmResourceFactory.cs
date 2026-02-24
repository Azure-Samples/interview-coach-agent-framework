using Microsoft.Extensions.Configuration;

public static class LlmResourceFactory
{
    private const string GITHUB_TOKEN_KEY = "GITHUB_TOKEN";
    private const string AGENT_MODE_KEY = "AgentMode";
    private const string LLM_PROVIDER_KEY = "LlmProvider";
    private const string LLM_PROVIDER_GITHUB_MODELS = "GitHubModels";
    private const string LLM_PROVIDER_AZURE_OPENAI = "AzureOpenAI";
    private const string LLM_PROVIDER_MICROSOFT_FOUNDRY = "MicrosoftFoundry";
    private const string LLM_PROVIDER_GITHUB_COPILOT = "GitHubCopilot";
    private const string SECTION_NAME_GITHUB = "GitHub";
    private const string SECTION_NAME_AZURE_OPENAI = "Azure:OpenAI";
    private const string SECTION_NAME_MICROSOFT_FOUNDRY = "MicrosoftFoundry:Project";
    private const string SECTION_NAME_GITHUB_COPILOT = "GitHubCopilot";
    private const string ENDPOINT_KEY = "Endpoint";
    private const string TOKEN_KEY = "Token";
    private const string API_KEY_KEY = "ApiKey";
    private const string MODEL_KEY = "Model";
    private const string DEPLOYMENT_NAME_KEY = "DeploymentName";
    private const string API_KEY_RESOURCE_NAME = "apiKey";
    private const string LLM_PROJECT_NAME = "foundry";
    private const string LLM_SERVICE_NAME = "openai";
    private const string LLM_RESOURCE_NAME = "chat";

    public static IResourceBuilder<ProjectResource> WithLlmReference(this IResourceBuilder<ProjectResource> source, IConfiguration config, IEnumerable<string> args)
    {
        var (provider, mode) = GetProviderAndAgentMode(config, args);

        source = provider switch
        {
            LLM_PROVIDER_GITHUB_MODELS => source.AddGitHubModelsResource(config, provider!, mode!),
            LLM_PROVIDER_AZURE_OPENAI => source.AddAzureOpenAIResource(config, provider!, mode!),
            LLM_PROVIDER_MICROSOFT_FOUNDRY => source.AddMicrosoftFoundryResource(config, provider!, mode!),
            LLM_PROVIDER_GITHUB_COPILOT => source.AddGitHubCopilotResource(config, provider!, mode!),
            _ => throw new NotSupportedException($"The specified LLM provider '{provider}' is not supported.")
        };

        return source;
    }

    private static (string? provider, string? mode) GetProviderAndAgentMode(IConfiguration config, IEnumerable<string> args)
    {
        var provider = config[LLM_PROVIDER_KEY];
        var mode = config[AGENT_MODE_KEY];
        foreach (var arg in args)
        {
            var index = args.ToList().IndexOf(arg);
            switch (arg)
            {
                case "--provider":
                case "-p":
                    provider = args.ToList()[index + 1];
                    break;
                case "--mode":
                case "-m":
                    mode = args.ToList()[index + 1];
                    break;
            }
        }
        if (string.IsNullOrWhiteSpace(provider))
        {
            throw new InvalidOperationException($"Missing configuration: {LLM_PROVIDER_KEY}");
        }
        if (string.IsNullOrWhiteSpace(mode))
        {
            throw new InvalidOperationException($"Missing configuration: {AGENT_MODE_KEY}");
        }
        return (provider, mode);
    }

    private static IResourceBuilder<ProjectResource> AddGitHubModelsResource(this IResourceBuilder<ProjectResource> source, IConfiguration config, string provider, string mode)
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

        return source.WithEnvironment(AGENT_MODE_KEY, mode)
                     .WithEnvironment(LLM_PROVIDER_KEY, provider)
                     .WithReference(chat)
                     .WaitFor(chat);
    }

    private static IResourceBuilder<ProjectResource> AddAzureOpenAIResource(this IResourceBuilder<ProjectResource> source, IConfiguration config, string provider, string mode)
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

        return source.WithEnvironment(AGENT_MODE_KEY, mode)
                     .WithEnvironment(LLM_PROVIDER_KEY, provider)
                     .WithReference(chat)
                     .WaitFor(chat);
    }

    private static IResourceBuilder<ProjectResource> AddMicrosoftFoundryResource(this IResourceBuilder<ProjectResource> source, IConfiguration config, string provider, string mode)
    {
        var foundry = config.GetSection(SECTION_NAME_MICROSOFT_FOUNDRY);
        var endpoint = foundry[ENDPOINT_KEY] ?? throw new InvalidOperationException($"Missing configuration: {SECTION_NAME_MICROSOFT_FOUNDRY}:{ENDPOINT_KEY}");
        var accessKey = foundry[API_KEY_KEY] ?? throw new InvalidOperationException($"Missing configuration: {SECTION_NAME_MICROSOFT_FOUNDRY}:{API_KEY_KEY}");
        var deploymentName = foundry[DEPLOYMENT_NAME_KEY] ?? throw new InvalidOperationException($"Missing configuration: {SECTION_NAME_MICROSOFT_FOUNDRY}:{DEPLOYMENT_NAME_KEY}");

        Console.WriteLine();
        Console.WriteLine($"\tLLM Provider: {provider}");
        Console.WriteLine($"\tModel: {deploymentName}");
        Console.WriteLine($"\tAgent Mode: {mode}");
        Console.WriteLine();

        var apiKey = source.ApplicationBuilder
                           .AddParameter(name: API_KEY_RESOURCE_NAME, value: accessKey, secret: true);
        var chat = source.ApplicationBuilder
                        //  .AddConnectionString(
                        //      LLM_PROJECT_NAME,
                        //     //  ReferenceExpression.Create($"Endpoint:{endpoint};Key={accessKey};Model={deploymentName}"));
                        //     //  ReferenceExpression.Create($"Endpoint={string.Join("://", endpoint.Split([':', '/'], StringSplitOptions.RemoveEmptyEntries).Take(2))}/openai/v1/;Model={deploymentName}"));
                        //     //  ReferenceExpression.Create($"Endpoint={string.Join("://", endpoint.Split([':', '/'], StringSplitOptions.RemoveEmptyEntries).Take(2))}/openai/v1/;Key={accessKey};Model={deploymentName}"));
                         .AddOpenAI(LLM_PROJECT_NAME)
                         .WithEndpoint($"{string.Join("://", endpoint.Split([':', '/'], StringSplitOptions.RemoveEmptyEntries).Take(2))}/openai/v1/")
                         .WithApiKey(apiKey)
                         .AddModel(name: LLM_RESOURCE_NAME, model: deploymentName);

        return source.WithEnvironment(AGENT_MODE_KEY, mode)
                     .WithEnvironment(LLM_PROVIDER_KEY, provider)
                     .WithReference(chat)
                     .WaitFor(chat);
    }

    private static IResourceBuilder<ProjectResource> AddGitHubCopilotResource(this IResourceBuilder<ProjectResource> source, IConfiguration config, string provider, string mode)
    {
        var github = config.GetSection(SECTION_NAME_GITHUB_COPILOT);
        var token = github[TOKEN_KEY] ?? throw new InvalidOperationException($"Missing configuration: {SECTION_NAME_GITHUB_COPILOT}:{TOKEN_KEY}");

        Console.WriteLine();
        Console.WriteLine($"\tLLM Provider: {provider}");
        Console.WriteLine($"\tAgent Mode: {mode}");
        Console.WriteLine();

        var apiKey = source.ApplicationBuilder
                           .AddParameter(name: API_KEY_RESOURCE_NAME, value: token, secret: true);

        return source.WithEnvironment(AGENT_MODE_KEY, mode)
                     .WithEnvironment(LLM_PROVIDER_KEY, provider)
                     .WithEnvironment(GITHUB_TOKEN_KEY, token);
    }
}
