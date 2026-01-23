var builder = DistributedApplication.CreateBuilder(args);

var mcpMarkItDown = builder.AddDockerfile(ResourceConstants.McpMarkItDown, "../InterviewCoach.Mcp.MarkItDown/packages/markitdown-mcp")
                           .WithExternalHttpEndpoints()
                           .WithImageTag("latest")
                           .WithHttpEndpoint(3001, 3001)
                           .WithArgs("--http", "--host", "0.0.0.0", "--port", "3001");

var mcpInterviewData = builder.AddProject<Projects.InterviewCoach_Mcp_InterviewData>(ResourceConstants.McpInterviewData)
                              .WithExternalHttpEndpoints();

var agent = builder.AddProject<Projects.InterviewCoach_Agent>(ResourceConstants.Agent)
                   .WithExternalHttpEndpoints()
                   .WithLlmReference(builder.Configuration)
                   .WithReference(mcpMarkItDown.GetEndpoint("http"))
                   .WithReference(mcpInterviewData)
                   .WaitFor(mcpMarkItDown)
                   .WaitFor(mcpInterviewData);

var webUI = builder.AddProject<Projects.InterviewCoach_WebUI>(ResourceConstants.WebUI)
                   .WithExternalHttpEndpoints()
                   .WithReference(agent)
                   .WaitFor(agent);

builder.Build().Run();
