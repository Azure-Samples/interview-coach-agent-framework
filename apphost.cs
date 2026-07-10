#:sdk Aspire.AppHost.Sdk@13.4.6
#:package Aspire.Hosting.Azure.AppContainers
#:package CommunityToolkit.Aspire.Hosting.SQLite
#:project ./src/InterviewCoach.Agent/InterviewCoach.Agent.csproj
#:project ./src/InterviewCoach.AppHost.Core/InterviewCoach.AppHost.Core.csproj
#:project ./src/InterviewCoach.Mcp.InterviewData/InterviewCoach.Mcp.InterviewData.csproj
#:project ./src/InterviewCoach.WebUI/InterviewCoach.WebUI.csproj

using Microsoft.Extensions.Configuration;

var builder = DistributedApplication.CreateBuilder(args);

var config = builder.Configuration
                    .AddJsonFile("apphost.settings.json", optional: true, reloadOnChange: true)
                    .AddUserSecrets(typeof(Program).Assembly, optional: true, reloadOnChange: true)
                    .Build();

var mcpMarkItDown = builder.AddContainer(ResourceConstants.McpMarkItDown, "mcp/markitdown", "latest")
                           .WithExternalHttpEndpoints()
                           .WithImageTag("latest")
                           .WithHttpEndpoint(targetPort: 3001)
                           .WithArgs("--http", "--host", "0.0.0.0", "--port", "3001");

var sqlite = builder.AddSqlite(ResourceConstants.Sqlite, databaseFileName: ResourceConstants.DatabaseName);
if (builder.ExecutionContext.IsRunMode)
{
    sqlite.WithSqliteWeb();
}

var mcpInterviewData = builder.AddProject<Projects.InterviewCoach_Mcp_InterviewData>(ResourceConstants.McpInterviewData)
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
    var containerAppEnvironment = builder.AddAzureContainerAppEnvironment(ResourceConstants.ContainerAppEnvironment);
    mcpInterviewData.WithSqliteAzureFileShare(containerAppEnvironment, mountPath: "/data", databaseFileName: ResourceConstants.DatabaseName);
}

var agent = builder.AddProject<Projects.InterviewCoach_Agent>(ResourceConstants.Agent)
                   .WithExternalHttpEndpoints()
                   .WithLlmReference(builder.Configuration, args)
                   .WithEnvironment(ResourceConstants.LlmProvider, builder.Configuration[ResourceConstants.LlmProvider] ?? string.Empty)
                   .WithReference(mcpMarkItDown.GetEndpoint("http"))
                   .WithReference(mcpInterviewData)
                   .WaitFor(mcpMarkItDown)
                   .WaitFor(mcpInterviewData);

var webUI = builder.AddProject<Projects.InterviewCoach_WebUI>(ResourceConstants.WebUI)
                   .WithExternalHttpEndpoints()
                   .WithReference(agent)
                   .WaitFor(agent);

await builder.Build().RunAsync();
