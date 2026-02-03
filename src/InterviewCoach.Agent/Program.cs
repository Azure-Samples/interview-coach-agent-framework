using System.ComponentModel;

using Microsoft.Agents.AI;
using Microsoft.Agents.AI.DevUI;
using Microsoft.Agents.AI.Hosting;
using Microsoft.Agents.AI.Hosting.AGUI.AspNetCore;
using Microsoft.Agents.AI.Workflows;
using Microsoft.Extensions.AI;

using ModelContextProtocol.Client;
using ModelContextProtocol.Protocol;

var builder = WebApplication.CreateBuilder(args);

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

builder.AddOpenAIClient("chat")
       .AddChatClient();

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
                1. Start by creating a new interview session and let the user know their session ID.
                2. Ask the user to provide their resume link or allow them to proceed without it. The user may provide the resume in text form if they prefer.
                3. Next, request the job description link or let them proceed without it. The user may provide the job description in text form if they prefer.
                4. Once you have the necessary information, begin the interview by asking behavioral questions first.
                5. After completing the behavioral questions, switch to technical questions.
                6. Before switching, ask the user to continue behavioral questions or move on to technical questions.
                7. The user may want to stop the interview at any time; in such cases, mark the interview as complete and proceed to summary generation.
                8. After the interview is complete, generate a comprehensive summary that includes an overview, key highlights, areas for improvement, and recommendations.
                9. Record all the conversations including greetings, questions, answers and summary as a transcript.

                Always maintain a supportive and encouraging tone.
                """,
            tools: [ .. markitdownTools, .. interviewDataTools ]
        );

        return agent;
    });

// builder.AddAIAgent(
//     name: "editor",
//     createAgentDelegate: (sp, key) => new ChatClientAgent(
//         chatClient: sp.GetRequiredService<IChatClient>(),
//         name: key,
//         instructions: """
//             You edit short stories to improve grammar and style, ensuring the stories are less than 300 words. Once finished editing, you select a title and format the story for publishing.
//             """,
//         tools: [ AIFunctionFactory.Create(FormatStory) ]
//     )
// );

// builder.AddWorkflow(
//     name: "publisher",
//     createWorkflowDelegate: (sp, key) => AgentWorkflowBuilder.BuildSequential(
//         workflowName: key,
//         agents:
//         [
//             sp.GetRequiredKeyedService<AIAgent>("writer"),
//             sp.GetRequiredKeyedService<AIAgent>("editor")
//         ]
//     )
// ).AddAsAIAgent();

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
    // aiAgent: app.Services.GetRequiredKeyedService<AIAgent>("publisher")
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

[Description("Formats the story for publication, revealing its title.")]
string FormatStory(string title, string story) => $"""
    **Title**: {title}

    {story}
    """;
