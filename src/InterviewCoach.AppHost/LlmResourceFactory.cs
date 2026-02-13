using Microsoft.Extensions.Configuration;

public static class LlmResourceFactory
{
    private const string LLM_PROVIDER_KEY = "LlmProvider";
    private const string LLM_PROVIDER_GITHUB = "GitHubModels";
    private const string LLM_PROVIDER_AZURE_OPENAI = "AzureOpenAI";
    private const string LLM_PROVIDER_MICROSOFT_FOUNDRY = "MicrosoftFoundry";
    private const string SECTION_NAME_GITHUB = "GitHub";
    private const string SECTION_NAME_AZURE_OPENAI = "Azure:OpenAI";
    private const string SECTION_NAME_MICROSOFT_FOUNDRY = "MicrosoftFoundry:Project";
    private const string ENDPOINT_KEY = "Endpoint";
    private const string TOKEN_KEY = "Token";
    private const string API_KEY_KEY = "ApiKey";
    private const string MODEL_KEY = "Model";
    private const string DEPLOYMENT_NAME_KEY = "DeploymentName";
    private const string API_KEY_RESOURCE_NAME = "apiKey";
    private const string LLM_PROJECT_NAME = "foundry";
    private const string LLM_SERVICE_NAME = "openai";
    private const string LLM_RESOURCE_NAME = "chat";

    public static IResourceBuilder<ProjectResource> WithLlmReference(this IResourceBuilder<ProjectResource> source, IConfiguration config)
    {
        var provider = config[LLM_PROVIDER_KEY] ?? throw new InvalidOperationException($"Missing configuration: {LLM_PROVIDER_KEY}");
        source = provider switch
        {
            LLM_PROVIDER_GITHUB => AddGitHubModelsResource(source, config),
            LLM_PROVIDER_AZURE_OPENAI => AddAzureOpenAIResource(source, config),
            LLM_PROVIDER_MICROSOFT_FOUNDRY => AddMicrosoftFoundryResource(source, config),
            _ => throw new NotSupportedException($"The specified LLM provider '{provider}' is not supported.")
        };

        return source;
    }

    private static IResourceBuilder<ProjectResource> AddGitHubModelsResource(IResourceBuilder<ProjectResource> source, IConfiguration config)
    {
        var provider = config[LLM_PROVIDER_KEY];

        var github = config.GetSection(SECTION_NAME_GITHUB);
        var endpoint = github[ENDPOINT_KEY] ?? throw new InvalidOperationException($"Missing configuration: {SECTION_NAME_GITHUB}:{ENDPOINT_KEY}");
        var token = github[TOKEN_KEY] ?? throw new InvalidOperationException($"Missing configuration: {SECTION_NAME_GITHUB}:{TOKEN_KEY}");
        var model = github[MODEL_KEY] ?? throw new InvalidOperationException($"Missing configuration: {SECTION_NAME_GITHUB}:{MODEL_KEY}");

        Console.WriteLine();
        Console.WriteLine($"\tUsing {provider}: {model}");
        Console.WriteLine();

        var apiKey = source.ApplicationBuilder
                           .AddParameter(name: API_KEY_RESOURCE_NAME, value: token, secret: true);
        var chat = source.ApplicationBuilder
                         .AddGitHubModel(name: LLM_RESOURCE_NAME, model: model)
                         .WithApiKey(apiKey);

        return source.WithReference(chat)
                     .WaitFor(chat);
    }

    private static IResourceBuilder<ProjectResource> AddAzureOpenAIResource(IResourceBuilder<ProjectResource> source, IConfiguration config)
    {
        var provider = config[LLM_PROVIDER_KEY];

        var azure = config.GetSection(SECTION_NAME_AZURE_OPENAI);
        var endpoint = azure[ENDPOINT_KEY] ?? throw new InvalidOperationException($"Missing configuration: {SECTION_NAME_AZURE_OPENAI}:{ENDPOINT_KEY}");
        var accessKey = azure[API_KEY_KEY] ?? throw new InvalidOperationException($"Missing configuration: {SECTION_NAME_AZURE_OPENAI}:{API_KEY_KEY}");
        var deploymentName = azure[DEPLOYMENT_NAME_KEY] ?? throw new InvalidOperationException($"Missing configuration: {SECTION_NAME_AZURE_OPENAI}:{DEPLOYMENT_NAME_KEY}");

        Console.WriteLine();
        Console.WriteLine($"\tUsing {provider}: {deploymentName}");
        Console.WriteLine();

        var apiKey = source.ApplicationBuilder
                           .AddParameter(name: API_KEY_RESOURCE_NAME, value: accessKey, secret: true);
        var chat = source.ApplicationBuilder
                         .AddOpenAI(LLM_SERVICE_NAME)
                         .WithEndpoint($"{endpoint.TrimEnd('/')}/openai/v1/")
                         .WithApiKey(apiKey)
                         .AddModel(name: LLM_RESOURCE_NAME, model: deploymentName);
        return source.WithReference(chat)
                     .WaitFor(chat);
    }

    private static IResourceBuilder<ProjectResource> AddMicrosoftFoundryResource(IResourceBuilder<ProjectResource> source, IConfiguration config)
    {
        var provider = config[LLM_PROVIDER_KEY];

        var foundry = config.GetSection(SECTION_NAME_MICROSOFT_FOUNDRY);
        var endpoint = foundry[ENDPOINT_KEY] ?? throw new InvalidOperationException($"Missing configuration: {SECTION_NAME_MICROSOFT_FOUNDRY}:{ENDPOINT_KEY}");
        var accessKey = foundry[API_KEY_KEY] ?? throw new InvalidOperationException($"Missing configuration: {SECTION_NAME_MICROSOFT_FOUNDRY}:{API_KEY_KEY}");
        var deploymentName = foundry[DEPLOYMENT_NAME_KEY] ?? throw new InvalidOperationException($"Missing configuration: {SECTION_NAME_MICROSOFT_FOUNDRY}:{DEPLOYMENT_NAME_KEY}");

        Console.WriteLine();
        Console.WriteLine($"\tUsing {provider}: {deploymentName}");
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
        return source.WithReference(chat)
                     .WaitFor(chat);
    }
}
