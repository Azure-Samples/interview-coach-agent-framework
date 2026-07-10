var builder = DistributedApplication.CreateBuilder(args);

var config = builder.Configuration;

var mcpMarkItDown = builder.AddContainer(ResourceConstants.McpMarkItDown, "mcp/markitdown", "latest")
                           .WithHttpEndpoint(targetPort: 3001)
                           .WithArgs("--http", "--host", "0.0.0.0", "--port", "3001");

// Azure Cosmos DB (NoSQL). Uses the local emulator in run mode and provisions a managed
// account when published. Aspire creates the database and container as resources, so no
// runtime resource creation is required (see the EnsureCreatedAsync note in the MCP server).
var cosmos = builder.AddAzureCosmosDB(ResourceConstants.Cosmos);
if (builder.ExecutionContext.IsRunMode)
{
    cosmos.RunAsPreviewEmulator(emulator => emulator.WithDataExplorer());
}

var cosmosDb = cosmos.AddCosmosDatabase(ResourceConstants.CosmosDatabase);
cosmosDb.AddContainer(ResourceConstants.CosmosContainer, "/id");

var mcpInterviewData = builder.AddProject<Projects.InterviewCoach_Mcp_InterviewData>(ResourceConstants.McpInterviewData)
                              .WithReference(cosmosDb)
                              .WaitFor(cosmosDb);

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
