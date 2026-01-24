using System.ComponentModel;

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

builder.Services.AddSingleton<McpClient>(sp =>
{
    var loggerFactory = sp.GetRequiredService<ILoggerFactory>();
    var httpClient = sp.GetRequiredService<IHttpClientFactory>()
                       .CreateClient("mcp-markitdown");

    var clientTransportOptions = new HttpClientTransportOptions()
    {
        Endpoint = new Uri($"{httpClient.BaseAddress!.ToString().Replace("+http", string.Empty).TrimEnd('/')}/mcp")
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

builder.Services.AddSingleton<McpClient>(sp =>
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

// Register services
builder.Services.AddSingleton<ISessionStateService, SessionStateService>();
builder.Services.AddSingleton<IMcpClientService, McpClientService>();
builder.Services.AddSingleton<TriageTools>();
builder.Services.AddSingleton<AnalysisTools>();
builder.Services.AddSingleton<InterviewTools>();
builder.Services.AddSingleton<SummaryTools>();

// Interview Coach Agent - Sequential workflow
builder.AddWorkflow(
    name: "interview-coach",
    createWorkflowDelegate: (sp, key) =>
    {
        var triageTools = sp.GetRequiredService<TriageTools>();
        var analysisTools = sp.GetRequiredService<AnalysisTools>();
        var interviewTools = sp.GetRequiredService<InterviewTools>();
        var summaryTools = sp.GetRequiredService<SummaryTools>();

        var triageAgent = new ChatClientAgent(
            chatClient: sp.GetRequiredService<IChatClient>(),
            name: "triage",
            instructions: """
                You are the Triage Agent for an interview coaching system.
                Your role is to:
                1. Greet users warmly and explain the interview process
                2. Create a new interview session when the user is ready to start
                3. Provide the session ID to the user
                
                Be friendly, professional, and guide users through the process.
                When the user wants to start, call CreateSession to begin.
                """,
            tools: [
                AIFunctionFactory.Create(triageTools.CreateSession),
                AIFunctionFactory.Create(triageTools.ClassifyIntent)
            ]
        );

        var analysisAgent = new ChatClientAgent(
            chatClient: sp.GetRequiredService<IChatClient>(),
            name: "analysis",
            instructions: """
                You are the Analysis Agent for an interview coaching system.
                Your role is to:
                1. Collect the candidate's resume (as a link or text) or confirm they want to proceed without it
                2. Collect the job description (as a link or text) or confirm they want to proceed without it
                3. Store all information in the database
                4. Once both resume and job description are captured (or explicitly skipped), confirm completion
                
                Always ask for explicit confirmation before proceeding without resume or job description.
                Be patient and clear in your instructions.
                """,
            tools: [
                AIFunctionFactory.Create(analysisTools.CaptureResumeLink),
                AIFunctionFactory.Create(analysisTools.CaptureResumeText),
                AIFunctionFactory.Create(analysisTools.ProceedWithoutResume),
                AIFunctionFactory.Create(analysisTools.CaptureJobDescriptionLink),
                AIFunctionFactory.Create(analysisTools.CaptureJobDescriptionText),
                AIFunctionFactory.Create(analysisTools.ProceedWithoutJobDescription),
                AIFunctionFactory.Create(analysisTools.IsAnalysisComplete)
            ]
        );

        var behavioralAgent = new ChatClientAgent(
            chatClient: sp.GetRequiredService<IChatClient>(),
            name: "behavioral",
            instructions: """
                You are the Behavioral Interview Agent for an interview coaching system.
                Conduct behavioral interview questions and provide constructive feedback.
                Use the STAR method (Situation, Task, Action, Result) to evaluate answers.
                Ask 3-5 behavioral questions before offering to switch to technical interview or conclude.
                Focus on soft skills, teamwork, leadership, and problem-solving scenarios.
                """,
            tools: [
                AIFunctionFactory.Create(interviewTools.RecordTranscript),
                AIFunctionFactory.Create(interviewTools.SwitchToTechnicalInterview),
                AIFunctionFactory.Create(interviewTools.CompleteInterview)
            ]
        );

        var technicalAgent = new ChatClientAgent(
            chatClient: sp.GetRequiredService<IChatClient>(),
            name: "technical",
            instructions: """
                You are the Technical Interview Agent for an interview coaching system.
                Conduct technical interview questions based on the candidate's resume and job description.
                Provide detailed feedback on answers, including best practices and alternative approaches.
                Ask 3-5 technical questions before offering to conclude the interview.
                Adapt your questions to the candidate's experience level and the job requirements.
                """,
            tools: [
                AIFunctionFactory.Create(interviewTools.RecordTranscript),
                AIFunctionFactory.Create(interviewTools.SwitchToBehavioralInterview),
                AIFunctionFactory.Create(interviewTools.CompleteInterview)
            ]
        );

        var summaryAgent = new ChatClientAgent(
            chatClient: sp.GetRequiredService<IChatClient>(),
            name: "summary",
            instructions: """
                You are the Summary Agent for an interview coaching system.
                Review the complete interview transcript and generate a comprehensive summary in markdown format.
                Include these sections: Overview, Key Highlights, Areas for Improvement, and Recommendations.
                Be constructive, balanced, and provide specific, actionable feedback.
                """,
            tools: [
                AIFunctionFactory.Create(summaryTools.GenerateSummary),
                AIFunctionFactory.Create(summaryTools.FormatSummary)
            ]
        );

        return AgentWorkflowBuilder.BuildSequential(
            workflowName: key,
            agents: [triageAgent, analysisAgent, behavioralAgent, summaryAgent]
        );
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
