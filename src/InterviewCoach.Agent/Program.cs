using System.ClientModel.Primitives;
using System.Data.Common;

using Azure.Identity;

using InterviewCoach.Agent;

using Microsoft.Agents.AI;
using Microsoft.Agents.AI.DevUI;
using Microsoft.Agents.AI.Hosting;
using Microsoft.Agents.AI.Hosting.AGUI.AspNetCore;
using Microsoft.Extensions.AI;

using ModelContextProtocol.Client;
using ModelContextProtocol.Protocol;

using OpenAI;

#pragma warning disable OPENAI001

var builder = WebApplication.CreateBuilder(args);
var config = builder.Configuration;

builder.AddServiceDefaults();

builder.Services.AddHttpClient("mcp-markitdown", client =>
{
    client.BaseAddress = new Uri("https+http://mcp-markitdown");
});

builder.Services.AddKeyedSingleton<McpClient>("mcp-markitdown", (sp, obj) =>
{
    var loggerFactory = sp.GetRequiredService<ILoggerFactory>();
    var httpClient = sp.GetRequiredService<IHttpClientFactory>()
                       .CreateClient("mcp-markitdown");
    var endpoint = builder.Environment.IsDevelopment() == true
                 ? $"{httpClient.BaseAddress!.ToString().Replace("https+", string.Empty).TrimEnd('/')}"
                 : $"{httpClient.BaseAddress!.ToString().Replace("+http", string.Empty).TrimEnd('/')}";

    var clientTransportOptions = new HttpClientTransportOptions()
    {
        Endpoint = new Uri($"{endpoint}/sse")
    };
    var clientTransport = new HttpClientTransport(clientTransportOptions, httpClient, loggerFactory);

    var clientOptions = new McpClientOptions()
    {
        ClientInfo = new Implementation()
        {
            Name = "MCP MarkItDown Client",
            Version = "1.0.0",
        }
    };

    return McpClient.CreateAsync(clientTransport, clientOptions, loggerFactory).GetAwaiter().GetResult();
});


builder.Services.AddHttpClient("mcp-interview-data", client =>
{
    client.BaseAddress = new Uri("https+http://mcp-interview-data");
});

builder.Services.AddKeyedSingleton<McpClient>("mcp-interview-data", (sp, obj) =>
{
    var loggerFactory = sp.GetRequiredService<ILoggerFactory>();
    var httpClient = sp.GetRequiredService<IHttpClientFactory>()
                       .CreateClient("mcp-interview-data");

    var clientTransportOptions = new HttpClientTransportOptions()
    {
        Endpoint = new Uri($"{httpClient.BaseAddress!.ToString().Replace("+http", string.Empty).TrimEnd('/')}/mcp")
    };
    var clientTransport = new HttpClientTransport(clientTransportOptions, httpClient, loggerFactory);

    var clientOptions = new McpClientOptions()
    {
        ClientInfo = new Implementation()
        {
            Name = "MCP Interview Data Client",
            Version = "1.0.0",
        }
    };

    return McpClient.CreateAsync(clientTransport, clientOptions, loggerFactory).GetAwaiter().GetResult();
});

if (config[Constants.LlmProvider] != "MicrosoftFoundry")
{
    builder.AddOpenAIClient("chat")
           .AddChatClient();
}
else
{
    builder.AddOpenAIClient("chat")
           .AddChatClient();

//     var connection = new DbConnectionStringBuilder() { ConnectionString = config.GetConnectionString("foundry") };
//     var endpoint = connection.TryGetValue("Endpoint", out var endpointValue) ? endpointValue?.ToString() : throw new InvalidOperationException("Missing Foundry Endpoint");
//     // var accessKey = connection.TryGetValue("Key", out var accessKeyValue) ? accessKeyValue?.ToString() : throw new InvalidOperationException("Missing Foundry Key");
//     var model = connection.TryGetValue("Model", out var modelValue) ? modelValue?.ToString() : throw new InvalidOperationException("Missing Foundry Model");
//     var options = new OpenAIClientOptions() { Endpoint = new Uri(endpoint!) };
//     var credential = new DefaultAzureCredential();
//     var client = new OpenAIClient(new BearerTokenPolicy(credential, "https://ai.azure.com/.default"), options)
//                     .GetResponsesClient(model!)
//                     .AsIChatClient();

//     builder.Services.AddSingleton<IChatClient>(client);
}

builder.AddAIAgent(
    name: "coach",
    createAgentDelegate: (sp, key) =>
    {
        var chatClient = sp.GetRequiredService<IChatClient>();
        var markitdown = sp.GetRequiredKeyedService<McpClient>("mcp-markitdown");
        var interviewData = sp.GetRequiredKeyedService<McpClient>("mcp-interview-data");

        var markitdownTools = markitdown.ListToolsAsync().GetAwaiter().GetResult();
        var interviewDataTools = interviewData.ListToolsAsync().GetAwaiter().GetResult();

        var agent = new ChatClientAgent(
            chatClient: chatClient,
            name: key,
            instructions: """
                You are an AI Interview Coach designed to help users prepare for job interviews.
                You will guide them through the interview process, provide feedback, and help them improve their skills.
                You will be given a session Id to track the interview session progress.
                Use the provided tools to manage interview sessions, capture resume and job description, ask both behavioral and technical questions, analyze responses, and generate summaries.

                Here's the overall process you should follow:
                01. Start by fetching an existing interview session and let the user know their session ID.
                02. If there's no existing session, create a new interview session by the session ID and let the user know their session ID.
                03. Once you have the session, then keep using this session record for all subsequent interactions. DO NOT create a new session again.
                04. Ask the user to provide their resume link or allow them to proceed without it. The user may provide the resume in text form if they prefer.
                05. Next, request the job description link or let them proceed without it. The user may provide the job description in text form if they prefer.
                06. Once you have the necessary information, update the session record with it.
                07. Once you have updated the session record with the information, begin the interview by asking behavioral questions first.
                08. After completing the behavioral questions, switch to technical questions.
                09. Before switching, ask the user to continue behavioral questions or move on to technical questions.
                10. The user may want to stop the interview at any time; in such cases, mark the interview as complete and proceed to summary generation.
                11. After the interview is complete, generate a comprehensive summary that includes an overview, key highlights, areas for improvement, and recommendations.
                12. Record all the conversations including greetings, questions, answers and summary as a transcript by updating the current session record.

                Always maintain a supportive and encouraging tone.
                """,
            tools: [ .. markitdownTools, .. interviewDataTools ]
        );

        return agent;
    });

builder.Services.AddOpenAIResponses();
builder.Services.AddOpenAIConversations();

builder.Services.AddAGUI();

var app = builder.Build();

app.MapDefaultEndpoints();

app.MapOpenAIResponses();
app.MapOpenAIConversations();

app.MapAGUI(
    pattern: "ag-ui",
    aiAgent: app.Services.GetRequiredKeyedService<AIAgent>("coach")
);

if (builder.Environment.IsDevelopment() == false)
{
    app.UseHttpsRedirection();
}
else
{
    app.MapDevUI();
}

await app.RunAsync();
