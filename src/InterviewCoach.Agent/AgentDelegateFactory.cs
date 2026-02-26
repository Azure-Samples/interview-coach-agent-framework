using GitHub.Copilot.SDK;

using InterviewCoach.Agent;

using Microsoft.Agents.AI;
using Microsoft.Agents.AI.Hosting;
using Microsoft.Agents.AI.Workflows;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.Logging;

using ModelContextProtocol.Client;

public enum AgentMode
{
    Single,
    LlmHandOff,
    CopilotHandOff
}

public static class AgentDelegateFactory
{
    public static IHostedAgentBuilder AddAIAgent(this IHostApplicationBuilder builder, string name)
    {
        var mode = Enum.TryParse<AgentMode>(builder.Configuration[Constants.AgentMode], ignoreCase: true, out var parsed)
                 ? parsed
                 : throw new InvalidOperationException($"Agent mode not specified or invalid. Please set the '{Constants.AgentMode}' configuration value.");

        var logger = LoggerFactory.Create(b => b.AddConsole()).CreateLogger(nameof(AgentDelegateFactory));
        logger.LogInformation("Agent mode: {AgentMode}", mode);

        IHostedAgentBuilder agentBuilder = mode switch
        {
            AgentMode.Single => builder.AddAIAgent(name, CreateSingleAgent),
            AgentMode.LlmHandOff => builder.AddHandOffWorkflow(name, CreateLlmHandOffWorkflow),
            AgentMode.CopilotHandOff => builder.AddHandOffWorkflow(name, CreateCopilotHandOffWorkflow),
            _ => throw new NotSupportedException($"The specified agent mode '{mode}' is not supported.")
        };

        return agentBuilder;
    }

    private static IHostedAgentBuilder AddHandOffWorkflow(this IHostApplicationBuilder builder, string key, Func<IServiceProvider, string, Workflow> createWorkflowDelegate)
    {
        builder.AddWorkflow(key, createWorkflowDelegate);

        return builder.AddAIAgent(key, (sp, name) =>
        {
            var workflow = sp.GetRequiredKeyedService<Workflow>(key);

            return workflow.AsAIAgent(name: key)
                           .CreateFixedAgent();
        });
    }

    private static (IList<AITool> markitdownTools, IList<AITool> interviewDataTools) GetMcpTools(IServiceProvider sp)
    {
        var markitdown = sp.GetRequiredKeyedService<McpClient>("mcp-markitdown");
        var interviewData = sp.GetRequiredKeyedService<McpClient>("mcp-interview-data");
        return (
            markitdown.ListToolsAsync().GetAwaiter().GetResult().Cast<AITool>().ToList(),
            interviewData.ListToolsAsync().GetAwaiter().GetResult().Cast<AITool>().ToList()
        );
    }

    // ============================================================================
    // MODE 1: Single Agent
    // The original monolithic agent that handles the entire interview process.
    // It has access to all MCP tools (MarkItDown for document parsing and
    // InterviewData for session management) and follows a linear interview flow.
    // ============================================================================
    private static AIAgent CreateSingleAgent(IServiceProvider sp, string key)
    {
        var chatClient = sp.GetRequiredService<IChatClient>();
        var (markitdownTools, interviewDataTools) = GetMcpTools(sp);

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
    // Uses shared agent definitions from WorkflowDefinitions. Each agent is
    // backed by a ChatClientAgent connected to the configured LLM provider.
    // ============================================================================
    private static Workflow CreateLlmHandOffWorkflow(IServiceProvider sp, string key)
    {
        var chatClient = sp.GetRequiredService<IChatClient>();
        var (markitdownTools, interviewDataTools) = GetMcpTools(sp);
        var agentDefinitions = WorkflowDefinitions.GetAgentDefinitions(markitdownTools, interviewDataTools);

        var agents = agentDefinitions.Select(agentDef =>
            (AIAgent)new ChatClientAgent(
                chatClient: chatClient,
                name: agentDef.Name,
                instructions: agentDef.Instructions,
                tools: agentDef.Tools ?? [])
        ).ToArray();

        return WorkflowDefinitions.BuildHandOffWorkflow(
            agents[0], agents[1], agents[2], agents[3], agents[4], key);
    }

    // ============================================================================
    // MODE 3: Multi-Agent Handoff (GitHub Copilot SDK)
    // Uses shared agent definitions from WorkflowDefinitions. Each agent is
    // backed by CopilotClient.AsAIAgent() via the GitHub Copilot SDK.
    //
    // Prerequisites:
    //   - GitHub Copilot CLI installed: https://github.com/github/copilot-sdk
    //   - Authenticated via: gh auth login
    //   - or using a GitHub Token, defined as a secret (see repo documentation)
    //   - NuGet package: Microsoft.Agents.AI.GitHub.Copilot
    // ============================================================================
    private static Workflow CreateCopilotHandOffWorkflow(IServiceProvider sp, string key)
    {
        var (markitdownTools, interviewDataTools) = GetMcpTools(sp);
        var agentDefinitions = WorkflowDefinitions.GetAgentDefinitions(markitdownTools, interviewDataTools);
        var loggerFactory = sp.GetRequiredService<ILoggerFactory>();

        var githubToken = Environment.GetEnvironmentVariable(Constants.GitHubToken);
        var copilotOptions = new CopilotClientOptions();
        if (!string.IsNullOrEmpty(githubToken))
        {
            copilotOptions.Environment = new Dictionary<string, string>
            {
                [Constants.GitHubToken] = githubToken
            };
        }
        var copilotClient = new CopilotClient(copilotOptions);
        copilotClient.StartAsync().GetAwaiter().GetResult();

        var agents = agentDefinitions.Select(agentDef =>
            copilotClient.AsAIAgent(
                name: agentDef.Name,
                instructions: agentDef.Instructions,
                tools: agentDef.Tools ?? [])
            .CreateFixedCopilotSDKAgent(loggerFactory)
        ).ToArray();

        return WorkflowDefinitions.BuildHandOffWorkflow(
            agents[0], agents[1], agents[2], agents[3], agents[4], key);
    }
}

