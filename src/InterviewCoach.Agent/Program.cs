using System.Reflection;

using Microsoft.Agents.AI;
using Microsoft.Agents.AI.DevUI;
using Microsoft.Agents.AI.Hosting;
using Microsoft.Agents.AI.Hosting.AGUI.AspNetCore;
using Microsoft.Agents.AI.Workflows;
using Microsoft.Extensions.AI;

using ModelContextProtocol.Client;
using ModelContextProtocol.Protocol;

using InterviewCoach.Agent.Services;
using InterviewCoach.Agent.Tools;

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
                 ? httpClient.BaseAddress!.ToString().Replace("https+", string.Empty).TrimEnd('/')
                 : httpClient.BaseAddress!.ToString().Replace("+http", string.Empty).TrimEnd('/');

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
        Endpoint = new Uri($"{httpClient.BaseAddress!.ToString().Replace("+http", string.Empty).TrimEnd('/')}/sse")
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

// Register services
builder.Services.AddSingleton<ISessionStateService, SessionStateService>();
builder.Services.AddSingleton<IMcpClientService, McpClientService>();
builder.Services.AddSingleton<TriageTools>();
builder.Services.AddSingleton<AnalysisTools>();
builder.Services.AddSingleton<InterviewTools>();
builder.Services.AddSingleton<SummaryTools>();

// Interview Coach Agent - Handoff workflow (triage is user-facing)
builder.AddWorkflow(
    name: "interview-coach",
    createWorkflowDelegate: (sp, key) =>
    {
        IChatClient CreateNamedChatClient(string agentName)
            => new AuthorNameChatClient(sp.GetRequiredService<IChatClient>(), agentName);

        var triageTools = sp.GetRequiredService<TriageTools>();
        var analysisTools = sp.GetRequiredService<AnalysisTools>();
        var interviewTools = sp.GetRequiredService<InterviewTools>();
        var summaryTools = sp.GetRequiredService<SummaryTools>();

        var triageAgent = new ChatClientAgent(
            chatClient: CreateNamedChatClient("triage"),
            name: "triage",
            instructions: """
                You are the Triage Agent for an interview coaching system.

                Your role is to:
                1. Be the ONLY user-facing agent in the workflow
                2. Greet users warmly and explain the interview process
                3. Create a new interview session in the beginning and give the session ID back to the user
                4. Use the same session ID for all interactions in the interview session unless a new session ID is provided
                5. Gather missing inputs from the user (resume, job description, interview answers)
                6. Once you have user resume link and job description link, handoff to the analysis agent
                7. Once you have user resume text and job description text (or proceed without either), handoff to either the behavior agent or technical agent
                8. Once the user wants to complete the interview, handoff to the summary agent
                9. DO NOT ask the user to provide information that has already been provided
                10. DO NOT offer the user the interview options. Go straight to the interview questions with specialist agents.
                11. Coordinate the workflow by handing off to specialist agents as needed
                12. Relay specialist results back to the user in your own words
                
                Be friendly, professional, and guide users through the process.
                When a specialist completes their task, they will handoff back to you.
                Do not ask specialist agents to speak directly to the user.
                """,
            tools: [
                AIFunctionFactory.Create(triageTools.CreateSession),
                AIFunctionFactory.Create(triageTools.GetSession),
                // AIFunctionFactory.Create(triageTools.ClassifyIntent)
                AIFunctionFactory.Create(analysisTools.CaptureResumeLink),
                AIFunctionFactory.Create(analysisTools.CaptureResumeText),
                AIFunctionFactory.Create(analysisTools.ProceedWithoutResume),
                AIFunctionFactory.Create(analysisTools.CaptureJobDescriptionLink),
                AIFunctionFactory.Create(analysisTools.CaptureJobDescriptionText),
                AIFunctionFactory.Create(analysisTools.ProceedWithoutJobDescription),
            ]
        );

        var analysisAgent = new ChatClientAgent(
            chatClient: CreateNamedChatClient("analysis"),
            name: "analysis",
            instructions: """
                You are the Analysis Agent for an interview coaching system.
                Your role is to:
                1. Process and validate resume and job description inputs
                2. Store validated information in the database
                3. If required information is missing or invalid, handoff to triage with a concise request
                4. Once both resume and job description are validated (or explicitly skipped), handoff to triage with completion status
                
                Never speak directly to the user. Only communicate via handoff to triage.
                Always ask for explicit confirmation before proceeding without resume or job description (via triage).
                """,
            tools: [
                // AIFunctionFactory.Create(analysisTools.CaptureResumeLink),
                AIFunctionFactory.Create(analysisTools.CaptureResumeText),
                // AIFunctionFactory.Create(analysisTools.ProceedWithoutResume),
                // AIFunctionFactory.Create(analysisTools.CaptureJobDescriptionLink),
                AIFunctionFactory.Create(analysisTools.CaptureJobDescriptionText),
                // AIFunctionFactory.Create(analysisTools.ProceedWithoutJobDescription),
                AIFunctionFactory.Create(analysisTools.IsAnalysisComplete)
            ]
        );

        var behavioralAgent = new ChatClientAgent(
            chatClient: CreateNamedChatClient("behavioral"),
            name: "behavioral",
            instructions: """
                You are the Behavioral Interview Agent for an interview coaching system.
                Conduct behavioral interview questions and provide constructive feedback.
                Use the STAR method (Situation, Task, Action, Result) to evaluate answers.
                Ask 3-5 behavioral questions before offering to switch to technical interview or conclude.
                Focus on soft skills, teamwork, leadership, and problem-solving scenarios.

                Never speak directly to the user. Provide the next question or feedback to triage via handoff.
                When you finish a turn, ALWAYS handoff back to triage.
                """,
            tools: [
                AIFunctionFactory.Create(interviewTools.RecordTranscript),
                AIFunctionFactory.Create(interviewTools.SwitchToTechnicalInterview),
                AIFunctionFactory.Create(interviewTools.CompleteInterview)
            ]
        );

        var technicalAgent = new ChatClientAgent(
            chatClient: CreateNamedChatClient("technical"),
            name: "technical",
            instructions: """
                You are the Technical Interview Agent for an interview coaching system.
                Conduct technical interview questions based on the candidate's resume and job description.
                Provide detailed feedback on answers, including best practices and alternative approaches.
                Ask 3-5 technical questions before offering to conclude the interview.
                Adapt your questions to the candidate's experience level and the job requirements.

                Never speak directly to the user. Provide the next question or feedback to triage via handoff.
                When you finish a turn, ALWAYS handoff back to triage.
                """,
            tools: [
                AIFunctionFactory.Create(interviewTools.RecordTranscript),
                AIFunctionFactory.Create(interviewTools.SwitchToBehavioralInterview),
                AIFunctionFactory.Create(interviewTools.CompleteInterview)
            ]
        );

        var summaryAgent = new ChatClientAgent(
            chatClient: CreateNamedChatClient("summary"),
            name: "summary",
            instructions: """
                You are the Summary Agent for an interview coaching system.
                Review the complete interview transcript and generate a comprehensive summary in markdown format.
                Include these sections: Overview, Key Highlights, Areas for Improvement, and Recommendations.
                Be constructive, balanced, and provide specific, actionable feedback.

                Never speak directly to the user. Generate the summary and handoff back to triage.
                """,
            tools: [
                AIFunctionFactory.Create(summaryTools.GenerateSummary),
                AIFunctionFactory.Create(summaryTools.FormatSummary)
            ]
        );

        var workflow = AgentWorkflowBuilder
                       .CreateHandoffBuilderWith(triageAgent)
                       .WithHandoffs(triageAgent, [analysisAgent, behavioralAgent, technicalAgent, summaryAgent])
                       .WithHandoffs([analysisAgent, behavioralAgent, technicalAgent, summaryAgent], triageAgent)
                       .Build();

        EnsureWorkflowName(workflow, key);
        return workflow;

        static void EnsureWorkflowName(Workflow workflow, string name)
        {
            var type = workflow.GetType();
            var field = type.GetField("<Name>k__BackingField", BindingFlags.Instance | BindingFlags.NonPublic)
                        ?? type.GetField("_name", BindingFlags.Instance | BindingFlags.NonPublic);

            field?.SetValue(workflow, name);
        }
    }
).AddAsAIAgent();

builder.Services.AddOpenAIResponses();
builder.Services.AddOpenAIConversations();

builder.Services.AddAGUI();

var app = builder.Build();

app.MapDefaultEndpoints();

app.MapOpenAIResponses();
app.MapOpenAIConversations();

app.MapAGUI(
    pattern: "ag-ui",
    aiAgent: app.Services.GetRequiredKeyedService<AIAgent>("interview-coach")
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
