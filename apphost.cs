#:sdk Aspire.AppHost.Sdk@13.1.1
#:package Aspire.Hosting.Azure@13.*
#:package Aspire.Hosting.GitHub.Models@13.*
#:package Aspire.Hosting.OpenAI@13.*
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

var mcpMarkItDown = builder.AddContainer(RESOURCE_MCP_MARKITDOWN, "mcp/markitdown", "latest")
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
    private const string SECTION_NAME_MICROSOFT_FOUNDRY = "MicrosoftFoundry:Project";
    private const string SECTION_NAME_GITHUB_COPILOT = "GitHubCopilot";
    private const string ENDPOINT_KEY = "Endpoint";
    private const string TOKEN_KEY = "Token";
    private const string API_KEY_KEY = "ApiKey";
    private const string MODEL_KEY = "Model";
    private const string DEPLOYMENT_NAME_KEY = "DeploymentName";
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
