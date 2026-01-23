const string AGENT_PROJECT_RESOURCE_NAME = "agent";
const string WEBUI_PROJECT_RESOURCE_NAME = "webui";

var builder = DistributedApplication.CreateBuilder(args);

var agent = builder.AddProject<Projects.InterviewCoach_Agent>(AGENT_PROJECT_RESOURCE_NAME)
                   .WithExternalHttpEndpoints()
                   .WithLlmReference(builder.Configuration);

var webUI = builder.AddProject<Projects.InterviewCoach_WebUI>(WEBUI_PROJECT_RESOURCE_NAME)
                   .WithExternalHttpEndpoints()
                   .WithReference(agent)
                   .WaitFor(agent);

builder.Build().Run();
