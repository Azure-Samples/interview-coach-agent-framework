var builder = DistributedApplication.CreateBuilder(args);

var config = builder.Configuration;

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
                   .WithLlmReference(config, args)
                   .WithEnvironment(ResourceConstants.LlmProvider, config[ResourceConstants.LlmProvider] ?? string.Empty)
                   .WithEnvironment("AZURE_TENANT_ID", config["AZURE_TENANT_ID"] ?? string.Empty)
                   .WithReference(mcpMarkItDown.GetEndpoint("http"))
                   .WithReference(mcpInterviewData)
                   .WaitFor(mcpMarkItDown)
                   .WaitFor(mcpInterviewData);

var webUI = builder.AddProject<Projects.InterviewCoach_WebUI>(ResourceConstants.WebUI)
                   .WithExternalHttpEndpoints()
                   .WithReference(agent)
                   .WaitFor(agent);

await builder.Build().RunAsync();
