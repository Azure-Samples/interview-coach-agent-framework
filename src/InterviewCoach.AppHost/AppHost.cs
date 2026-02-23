var builder = DistributedApplication.CreateBuilder(args);

// var foundry = builder.AddBicepTemplate("foundry", "../../infra/foundry.bicep");

// GitHub Token — required for Mode 3 (Multi-Agent Handoff with GitHub Copilot SDK).
// Set the value in apphost.settings.json under "Parameters:github-token",
// as a user secret, or enter it in the Aspire Dashboard when prompted.
var githubToken = builder.AddParameter(ResourceConstants.GitHubToken, secret: true);

var mcpMarkItDown = builder.AddDockerfile(ResourceConstants.McpMarkItDown, "../InterviewCoach.Mcp.MarkItDown/packages/markitdown-mcp")
                           .WithExternalHttpEndpoints()
                           .WithImageTag("latest")
                           .WithHttpEndpoint(3001, 3001)
                           .WithArgs("--http", "--host", "0.0.0.0", "--port", "3001");

var sqlite = builder.AddSqlite(ResourceConstants.Sqlite, databaseFileName: ResourceConstants.DatabaseName)
                    .WithSqliteWeb();

var mcpInterviewData = builder.AddProject<Projects.InterviewCoach_Mcp_InterviewData>(ResourceConstants.McpInterviewData)
                              .WithExternalHttpEndpoints()
                              .WithReference(sqlite)
                              .WaitFor(sqlite);

var agent = builder.AddProject<Projects.InterviewCoach_Agent>(ResourceConstants.Agent)
                   .WithExternalHttpEndpoints()
                   .WithLlmReference(builder.Configuration)
                   .WithEnvironment(ResourceConstants.LlmProvider, builder.Configuration[ResourceConstants.LlmProvider] ?? string.Empty)
                   .WithEnvironment("GITHUB_TOKEN", githubToken)
                   .WithReference(mcpMarkItDown.GetEndpoint("http"))
                   .WithReference(mcpInterviewData)
                   .WaitFor(mcpMarkItDown)
                   .WaitFor(mcpInterviewData);

var webUI = builder.AddProject<Projects.InterviewCoach_WebUI>(ResourceConstants.WebUI)
                   .WithExternalHttpEndpoints()
                   .WithReference(agent)
                   .WaitFor(agent);

await builder.Build().RunAsync();
