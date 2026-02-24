using System.ClientModel.Primitives;
using System.Data.Common;
using System.Runtime.CompilerServices;
using System.Text.Json;

using Azure.Identity;

using GitHub.Copilot.SDK;

using InterviewCoach.Agent;

using Microsoft.Agents.AI;
using Microsoft.Agents.AI.DevUI;
using Microsoft.Agents.AI.Hosting;
using Microsoft.Agents.AI.Hosting.AGUI.AspNetCore;
using Microsoft.Agents.AI.Workflows;
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
    var endpoint = GetMarkItDownMcpServerUrl();

    var clientTransportOptions = new HttpClientTransportOptions()
    {
        Endpoint = new Uri($"{endpoint}sse")
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

// ============================================================================
// AGENT MODE TOGGLE
// Uncomment exactly ONE of the following lines to select the agent mode.
//
// Mode 1: Single Agent (default) — one monolithic agent handles everything.
// Mode 2: Multi-Agent Handoff (ChatClient) — 5 specialized agents using your
//         configured LLM provider (Foundry, Azure OpenAI, GitHub Models).
// Mode 3: Multi-Agent Handoff (GitHub Copilot) — 5 specialized agents backed
//         by the GitHub Copilot SDK. Requires Copilot CLI installed & authenticated.
// ============================================================================

//builder.AddAIAgent("coach", createAgentDelegate: CreateSingleAgent);              // Mode 1: Single agent

builder.AddAIAgent("coach", createAgentDelegate: CreateHandoffAgents);         // Mode 2: Multi-agent handoff (ChatClient + LLM)

// builder.AddAIAgent("coach", createAgentDelegate: CreateCopilotHandoffAgents);  // Mode 3: Multi-agent handoff (GitHub Copilot)

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

// ============================================================================
// MODE 1: Single Agent
// The original monolithic agent that handles the entire interview process.
// It has access to all MCP tools (MarkItDown for document parsing and
// InterviewData for session management) and follows a linear interview flow.
// ============================================================================
static AIAgent CreateSingleAgent(IServiceProvider sp, string key)
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
        tools: [.. markitdownTools, .. interviewDataTools]
    );

    return agent;
}

// ============================================================================
// MODE 2: Multi-Agent Handoff (ChatClient + LLM Provider)
// Splits the interview coach into 5 specialized agents connected via the
// handoff orchestration pattern from Microsoft Agent Framework.
//
// Topology:
//   User → Triage ⇄ Receptionist
//          Triage ⇄ BehaviouralInterviewer
//          Triage ⇄ TechnicalInterviewer
//          Triage ⇄ Summariser
//
// Each agent has scoped tools and focused instructions. The Triage agent
// routes user messages to the appropriate specialist. Specialists hand
// control back to Triage when their part is complete.
// ============================================================================
static AIAgent CreateHandoffAgents(IServiceProvider sp, string key)
{
    var chatClient = sp.GetRequiredService<IChatClient>();
    var markitdown = sp.GetRequiredKeyedService<McpClient>("mcp-markitdown");
    var interviewData = sp.GetRequiredKeyedService<McpClient>("mcp-interview-data");

    var markitdownTools = markitdown.ListToolsAsync().GetAwaiter().GetResult();
    var interviewDataTools = interviewData.ListToolsAsync().GetAwaiter().GetResult();

    // --- Triage Agent ---
    // Routes user messages to the correct specialist. No tools — pure routing.
    var triageAgent = new ChatClientAgent(
        chatClient: chatClient,
        name: "triage",
        instructions: """
            You are the Triage agent for an AI Interview Coach system.
            Your ONLY job is to analyze the user's message and hand off to the right specialist agent.
            You do NOT answer questions or conduct interviews yourself.

            Routing rules:
            - If the user wants to start a session, provide a resume, or provide a job description → hand off to "receptionist"
            - If the user is ready for or is in a behavioural interview → hand off to "behavioural_interviewer"
            - If the user is ready for or is in a technical interview → hand off to "technical_interviewer"
            - If the user wants a summary, wants to end the interview, or the interview is complete → hand off to "summariser"
            - If unclear, ask the user to clarify what they'd like to do.

            Always be brief and supportive. Let the specialists do the detailed work.
            """);

    // --- Receptionist Agent ---
    // Handles session creation and document intake. Has all MCP tools.
    var receptionistAgent = new ChatClientAgent(
        chatClient: chatClient,
        name: "receptionist",
        instructions: """
            You are the Receptionist for an AI Interview Coach system.
            Your job is to set up the interview session and collect documents.

            Process:
            1. Fetch an existing interview session or create a new one. Let the user know their session ID.
            2. Ask the user to provide their resume (link or text). Use MarkItDown to parse document links into markdown.
            3. Ask the user to provide the job description (link or text). Use MarkItDown to parse document links into markdown.
            4. Store the resume and job description in the session record.
            5. Once document intake is complete, let the user know and hand off back to triage.

            The user may choose to proceed without a resume or job description — that's fine.
            Always maintain a supportive and encouraging tone.
            """,
        tools: [.. markitdownTools, .. interviewDataTools]);

    // --- Behavioural Interviewer Agent ---
    // Conducts the behavioural part of the interview.
    var behaviouralAgent = new ChatClientAgent(
        chatClient: chatClient,
        name: "behavioural_interviewer",
        instructions: """
            You are the Behavioural Interviewer for an AI Interview Coach system.
            Your job is to conduct the behavioural part of the interview.

            Process:
            1. Fetch the interview session record to get the resume and job description context.
            2. Ask behavioural questions one at a time, tailored to the job description and resume.
            3. After each answer, provide constructive feedback and analysis.
            4. Append all questions, answers, and analysis to the transcript by updating the session record.
            5. After a few questions (typically 3-5), ask if the user wants to continue or move on.
            6. When done, hand off back to triage.

            Use the STAR method (Situation, Task, Action, Result) to guide your questions.
            Always maintain a supportive and encouraging tone.
            """,
        tools: [.. interviewDataTools]);

    // --- Technical Interviewer Agent ---
    // Conducts the technical part of the interview.
    var technicalAgent = new ChatClientAgent(
        chatClient: chatClient,
        name: "technical_interviewer",
        instructions: """
            You are the Technical Interviewer for an AI Interview Coach system.
            Your job is to conduct the technical part of the interview.

            Process:
            1. Fetch the interview session record to get the resume and job description context.
            2. Ask technical questions one at a time, tailored to the skills in the job description and resume.
            3. After each answer, provide constructive feedback, correct any misconceptions, and suggest improvements.
            4. Append all questions, answers, and analysis to the transcript by updating the session record.
            5. After a few questions (typically 3-5), ask if the user wants to continue or wrap up.
            6. When done, hand off back to triage.

            Focus on practical, real-world scenarios relevant to the job.
            Always maintain a supportive and encouraging tone.
            """,
        tools: [.. interviewDataTools]);

    // --- Summariser Agent ---
    // Generates the final interview summary.
    var summariserAgent = new ChatClientAgent(
        chatClient: chatClient,
        name: "summariser",
        instructions: """
            You are the Summariser for an AI Interview Coach system.
            Your job is to generate a comprehensive interview summary.

            Process:
            1. Fetch the interview session record to get the full transcript.
            2. Generate a summary that includes:
               - Overview of the interview session
               - Key highlights and strong answers
               - Areas for improvement
               - Specific recommendations for the user
               - Overall readiness assessment
            3. Update the session record with the summary in the transcript.
            4. Mark the interview session as complete.
            5. Present the summary to the user.
            6. Hand off back to triage in case the user wants to do anything else.

            Always maintain a supportive and encouraging tone.
            """,
        tools: [.. interviewDataTools]);

    // Build the handoff workflow — Triage is the entry point (hub).
    // All specialists can hand off back to Triage for re-routing.
    var workflow = AgentWorkflowBuilder
        .CreateHandoffBuilderWith(triageAgent)
        .WithHandoffs(triageAgent, [receptionistAgent, behaviouralAgent, technicalAgent, summariserAgent])
        .WithHandoff(receptionistAgent, triageAgent)
        .WithHandoff(behaviouralAgent, triageAgent)
        .WithHandoff(technicalAgent, triageAgent)
        .WithHandoff(summariserAgent, triageAgent)
        .Build();

    return WrapWithHandoffToolResultFix(workflow.AsAIAgent(name: "coach"));
}

// ============================================================================
// MODE 3: Multi-Agent Handoff (GitHub Copilot SDK)
// Same 5-agent handoff topology as Mode 2, but each agent is backed by
// the GitHub Copilot SDK instead of a cloud LLM provider.
//
// Prerequisites:
//   - GitHub Copilot CLI installed: https://github.com/github/copilot-sdk
//   - Authenticated via: gh auth login
//   - NuGet package: Microsoft.Agents.AI.GitHub.Copilot
//
// The agents use CopilotClient.AsAIAgent() which provides access to
// GitHub Copilot's AI capabilities including tool use and MCP integration.
// ============================================================================
static AIAgent CreateCopilotHandoffAgents(IServiceProvider sp, string key)
{
    var markitdown = sp.GetRequiredKeyedService<McpClient>("mcp-markitdown");
    var interviewData = sp.GetRequiredKeyedService<McpClient>("mcp-interview-data");

    var markitdownTools = markitdown.ListToolsAsync().GetAwaiter().GetResult();
    var interviewDataTools = interviewData.ListToolsAsync().GetAwaiter().GetResult();

    // Create a shared CopilotClient for all agents.
    // The GitHub token is passed from the Aspire AppHost as the GITHUB_TOKEN
    // environment variable. When provided, it authenticates the Copilot SDK
    // without requiring the user to be logged in via `gh auth login`.
    var githubToken = Environment.GetEnvironmentVariable("GITHUB_TOKEN");
    var copilotOptions = new CopilotClientOptions();
    if (!string.IsNullOrEmpty(githubToken))
    {
        copilotOptions.Environment = new Dictionary<string, string>
        {
            ["GITHUB_TOKEN"] = githubToken
        };
    }
    var copilotClient = new CopilotClient(copilotOptions);
    copilotClient.StartAsync().GetAwaiter().GetResult();

    // --- Triage Agent ---
    var triageAgent = copilotClient.AsAIAgent(
        name: "triage",
        instructions: """
            You are the Triage agent for an AI Interview Coach system.
            Your ONLY job is to analyze the user's message and hand off to the right specialist agent.
            You do NOT answer questions or conduct interviews yourself.

            Routing rules:
            - If the user wants to start a session, provide a resume, or provide a job description → hand off to "receptionist"
            - If the user is ready for or is in a behavioural interview → hand off to "behavioural_interviewer"
            - If the user is ready for or is in a technical interview → hand off to "technical_interviewer"
            - If the user wants a summary, wants to end the interview, or the interview is complete → hand off to "summariser"
            - If unclear, ask the user to clarify what they'd like to do.

            Always be brief and supportive. Let the specialists do the detailed work.
            """);

    // --- Receptionist Agent ---
    var receptionistAgent = copilotClient.AsAIAgent(
        name: "receptionist",
        instructions: """
            You are the Receptionist for an AI Interview Coach system.
            Your job is to set up the interview session and collect documents.

            Process:
            1. Fetch an existing interview session or create a new one. Let the user know their session ID.
            2. Ask the user to provide their resume (link or text). Use MarkItDown to parse document links into markdown.
            3. Ask the user to provide the job description (link or text). Use MarkItDown to parse document links into markdown.
            4. Store the resume and job description in the session record.
            5. Once document intake is complete, let the user know and hand off back to triage.

            The user may choose to proceed without a resume or job description — that's fine.
            Always maintain a supportive and encouraging tone.
            """,
        tools: [.. markitdownTools, .. interviewDataTools]);

    // --- Behavioural Interviewer Agent ---
    var behaviouralAgent = copilotClient.AsAIAgent(
        name: "behavioural_interviewer",
        instructions: """
            You are the Behavioural Interviewer for an AI Interview Coach system.
            Your job is to conduct the behavioural part of the interview.

            Process:
            1. Fetch the interview session record to get the resume and job description context.
            2. Ask behavioural questions one at a time, tailored to the job description and resume.
            3. After each answer, provide constructive feedback and analysis.
            4. Append all questions, answers, and analysis to the transcript by updating the session record.
            5. After a few questions (typically 3-5), ask if the user wants to continue or move on.
            6. When done, hand off back to triage.

            Use the STAR method (Situation, Task, Action, Result) to guide your questions.
            Always maintain a supportive and encouraging tone.
            """,
        tools: [.. interviewDataTools]);

    // --- Technical Interviewer Agent ---
    var technicalAgent = copilotClient.AsAIAgent(
        name: "technical_interviewer",
        instructions: """
            You are the Technical Interviewer for an AI Interview Coach system.
            Your job is to conduct the technical part of the interview.

            Process:
            1. Fetch the interview session record to get the resume and job description context.
            2. Ask technical questions one at a time, tailored to the skills in the job description and resume.
            3. After each answer, provide constructive feedback, correct any misconceptions, and suggest improvements.
            4. Append all questions, answers, and analysis to the transcript by updating the session record.
            5. After a few questions (typically 3-5), ask if the user wants to continue or wrap up.
            6. When done, hand off back to triage.

            Focus on practical, real-world scenarios relevant to the job.
            Always maintain a supportive and encouraging tone.
            """,
        tools: [.. interviewDataTools]);

    // --- Summariser Agent ---
    var summariserAgent = copilotClient.AsAIAgent(
        name: "summariser",
        instructions: """
            You are the Summariser for an AI Interview Coach system.
            Your job is to generate a comprehensive interview summary.

            Process:
            1. Fetch the interview session record to get the full transcript.
            2. Generate a summary that includes:
               - Overview of the interview session
               - Key highlights and strong answers
               - Areas for improvement
               - Specific recommendations for the user
               - Overall readiness assessment
            3. Update the session record with the summary in the transcript.
            4. Mark the interview session as complete.
            5. Present the summary to the user.
            6. Hand off back to triage in case the user wants to do anything else.

            Always maintain a supportive and encouraging tone.
            """,
        tools: [.. interviewDataTools]);

    var workflow = AgentWorkflowBuilder
        .CreateHandoffBuilderWith(triageAgent)
        .WithHandoffs(triageAgent, [receptionistAgent, behaviouralAgent, technicalAgent, summariserAgent])
        .WithHandoff(receptionistAgent, triageAgent)
        .WithHandoff(behaviouralAgent, triageAgent)
        .WithHandoff(technicalAgent, triageAgent)
        .WithHandoff(summariserAgent, triageAgent)
        .Build();

    return WrapWithHandoffToolResultFix(workflow.AsAIAgent(name: "coach"));
}

// ============================================================================
// Workaround for https://github.com/microsoft/agent-framework/issues/2775
// Handoff tools return plain string content (e.g. "Transferred.") which causes
// AGUIChatClient to throw JsonException in DeserializeResultIfAvailable.
// Fix: wrap string FunctionResultContent.Result values as JsonElement before
// the AGUI serialization pipeline processes them.
// Remove this once the upstream fix is released.
// ============================================================================
static AIAgent WrapWithHandoffToolResultFix(AIAgent agent)
{
    return new AIAgentBuilder(agent)
        .Use(
            runFunc: null,
            runStreamingFunc: static (messages, session, options, inner, ct) =>
                FixHandoffToolResults(inner.RunStreamingAsync(messages, session, options, ct)))
        .Build();
}

static async IAsyncEnumerable<AgentResponseUpdate> FixHandoffToolResults(
    IAsyncEnumerable<AgentResponseUpdate> updates,
    [EnumeratorCancellation] CancellationToken ct = default)
{
    await foreach (var update in updates.WithCancellation(ct))
    {
        foreach (var content in update.Contents)
        {
            if (content is FunctionResultContent frc && frc.Result is string s)
            {
                frc.Result = JsonSerializer.SerializeToElement(s);
            }
        }

        yield return update;
    }
}

static Uri GetMarkItDownMcpServerUrl()
{
    var markItDownMcpUrl = $"{Environment.GetEnvironmentVariable("MARKITDOWN_MCP_URL")}";
    return new Uri(markItDownMcpUrl);
}