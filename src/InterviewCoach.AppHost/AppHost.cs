const string SECTION_NAME = "GitHub";
const string ENDPOINT_KEY = "Endpoint";
const string TOKEN_KEY = "Token";
const string MODEL_KEY = "Model";

const string API_KEY_RESOURCE_NAME = "apiKey";
const string LLM_RESOURCE_NAME = "chat";
const string AGENT_PROJECT_RESOURCE_NAME = "agent";
const string WEBUI_PROJECT_RESOURCE_NAME = "webui";

var builder = DistributedApplication.CreateBuilder(args);

var config = builder.Configuration;
var github = config.GetSection(SECTION_NAME);
var endpoint = github[ENDPOINT_KEY] ?? throw new InvalidOperationException("Missing configuration: GitHub:Endpoint");
var token = github[TOKEN_KEY] ?? throw new InvalidOperationException("Missing configuration: GitHub:Token");
var model = github[MODEL_KEY] ?? throw new InvalidOperationException("Missing configuration: GitHub:Model");

var apiKey = builder.AddParameter(name: API_KEY_RESOURCE_NAME, value: token, secret: true);
var chat = builder.AddGitHubModel(name: LLM_RESOURCE_NAME, model: model)
                  .WithApiKey(apiKey);

var agent = builder.AddProject<Projects.InterviewCoach_Agent>(AGENT_PROJECT_RESOURCE_NAME)
                   .WithExternalHttpEndpoints()
                   .WithReference(chat)
                   .WaitFor(chat);

var webUI = builder.AddProject<Projects.InterviewCoach_WebUI>(WEBUI_PROJECT_RESOURCE_NAME)
                   .WithExternalHttpEndpoints()
                   .WithReference(agent)
                   .WaitFor(agent);

builder.Build().Run();
