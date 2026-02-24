#:sdk Aspire.AppHost.Sdk@13.1.1
#:package Aspire.Hosting.Azure@13.1.1
#:package Aspire.Hosting.GitHub.Models@13.1.1
#:package Aspire.Hosting.OpenAI@13.1.1
#:package CommunityToolkit.Aspire.Hosting.SQLite@13.*
#:project ./src/InterviewCoach.Agent/InterviewCoach.Agent.csproj
#:project ./src/InterviewCoach.Mcp.InterviewData/InterviewCoach.Mcp.InterviewData.csproj
#:project ./src/InterviewCoach.WebUI/InterviewCoach.WebUI.csproj
#:property UserSecretsId=7ae1635d-7ac9-43dd-b458-5f56d1b1ee02

using Microsoft.Extensions.Configuration;

const string RESOURCE_CONSTANTS_LLM_PROVIDER = "LlmProvider";
const string RESOURCE_MCP_MARKITDOWN = "mcp-markitdown";
const string RESOURCE_MCP_INTERVIEWDATA = "mcp-interview-data";
const string RESOURCE_DB_SQLITE = "sqlite";
const string RESOURCE_DB_NAME = "interviewcoach.db";
const string RESOURCE_PROJECT_AGENT = "agent";
const string RESOURCE_PROJECT_WEBUI = "webui";

var builder = DistributedApplication.CreateBuilder(args);

// var foundry = builder.AddBicepTemplate("foundry", "./infra/foundry.bicep");

var config = builder.Configuration
                    .AddJsonFile("apphost.settings.json", optional: true, reloadOnChange: true)
                    .AddUserSecrets(typeof(Program).Assembly, optional: true, reloadOnChange: true)
                    .Build();

var mcpMarkItDown = builder.AddDockerfile(RESOURCE_MCP_MARKITDOWN, "./src/InterviewCoach.Mcp.MarkItDown/packages/markitdown-mcp")
                           .WithExternalHttpEndpoints()
                           .WithImageTag("latest")
                           .WithHttpEndpoint(3001, 3001)
                           .WithArgs("--http", "--host", "0.0.0.0", "--port", "3001");

var sqlite = builder.AddSqlite(RESOURCE_DB_SQLITE, databaseFileName: RESOURCE_DB_NAME)
                    .WithSqliteWeb();

var mcpInterviewData = builder.AddProject<Projects.InterviewCoach_Mcp_InterviewData>(RESOURCE_MCP_INTERVIEWDATA)
                              .WithExternalHttpEndpoints()
                              .WithReference(sqlite)
                              .WaitFor(sqlite);

var agent = builder.AddProject<Projects.InterviewCoach_Agent>(RESOURCE_PROJECT_AGENT)
                   .WithExternalHttpEndpoints()
                   .WithLlmReference(builder.Configuration)
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
        var provider = config["LlmProvider"];

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
                         .AddOpenAI(LLM_PROJECT_NAME)
                         .WithEndpoint($"{string.Join("://", endpoint.Split([':', '/'], StringSplitOptions.RemoveEmptyEntries).Take(2))}/openai/v1/")
                         .WithApiKey(apiKey)
                         .AddModel(name: LLM_RESOURCE_NAME, model: deploymentName);
        return source.WithReference(chat)
                     .WaitFor(chat);
    }
}
