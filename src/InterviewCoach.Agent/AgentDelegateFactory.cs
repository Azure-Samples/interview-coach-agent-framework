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

    // ============================================================================
    // MODE 1: Single Agent
    // The original monolithic agent that handles the entire interview process.
    // It has access to all MCP tools (MarkItDown for document parsing and
    // InterviewData for session management) and follows a linear interview flow.
    // ============================================================================
    private static AIAgent CreateSingleAgent(IServiceProvider sp, string key)
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
    // Topology (sequential chain with Triage as fallback):
    //   User → Triage → Receptionist → BehaviouralInterviewer → TechnicalInterviewer → Summariser
    //          Triage ← (any specialist, for out-of-order requests)
    //
    // Each agent has scoped tools and focused instructions. Specialists hand
    // off directly to the next agent in sequence for the happy path, avoiding
    // a stateless Triage re-routing loop. Triage acts as the initial entry
    // point and fallback for out-of-order user requests.
    // ============================================================================
    private static Workflow CreateLlmHandOffWorkflow(IServiceProvider sp, string key)
    {
        var chatClient = sp.GetRequiredService<IChatClient>();
        var markitdown = sp.GetRequiredKeyedService<McpClient>("mcp-markitdown");
        var interviewData = sp.GetRequiredKeyedService<McpClient>("mcp-interview-data");

        var markitdownTools = markitdown.ListToolsAsync().GetAwaiter().GetResult();
        var interviewDataTools = interviewData.ListToolsAsync().GetAwaiter().GetResult();

        // --- Triage Agent ---
        // Routes user messages to the correct specialist. No tools — pure routing.
        // FIX: Made state-aware to prevent re-routing loops. The old instructions
        // were purely keyword-driven, causing Triage to repeatedly send users back
        // to the Receptionist when the original message mentioned "resume" or "job
        // description" — even after document intake was already complete.
        var triageAgent = new ChatClientAgent(
            chatClient: chatClient,
            name: "triage",
            instructions: """
                You are the Triage agent for an AI Interview Coach system.
                Your ONLY job is to analyze the conversation and hand off to the right specialist agent.
                You do NOT answer questions or conduct interviews yourself.

                IMPORTANT: Before routing, review the FULL conversation history to determine
                which phases have already been completed. Do NOT re-route to an agent that
                has already finished its work. The interview follows this sequence:
                  1. Receptionist (session setup, document intake)
                  2. Behavioural Interviewer
                  3. Technical Interviewer
                  4. Summariser

                Routing rules (apply in order, skipping completed phases):
                - If the receptionist has NOT yet collected the resume and job description
                  → hand off to "receptionist"
                - If document intake is complete and behavioural interview has NOT started
                  → hand off to "behavioural_interviewer"
                - If behavioural interview is complete and technical interview has NOT started
                  → hand off to "technical_interviewer"
                - If technical interview is complete or the user wants to end
                  → hand off to "summariser"
                - If the user explicitly requests a specific phase, honour that request.
                - If unclear, ask the user to clarify what they'd like to do.

                When a specialist hands back to you, they have COMPLETED their phase.
                Advance to the next phase in the sequence.

                Always be brief and supportive. Let the specialists do the detailed work.
                """);

        // --- Receptionist Agent ---
        // Handles session creation and document intake. Has all MCP tools.
        // FIX: Now hands off directly to behavioural_interviewer (next phase)
        // instead of back to Triage, to avoid the re-routing loop.
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
                5. Once document intake is complete, let the user know and hand off directly to "behavioural_interviewer"
                   to begin the interview. Only hand off to "triage" if the user wants to do something unexpected.

                The user may choose to proceed without a resume or job description — that's fine.
                Always maintain a supportive and encouraging tone.
                """,
            tools: [.. markitdownTools, .. interviewDataTools]);

        // --- Behavioural Interviewer Agent ---
        // Conducts the behavioural part of the interview.
        // FIX: Now hands off directly to technical_interviewer (next phase)
        // instead of back to Triage.
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
                6. When done, hand off directly to "technical_interviewer" to continue the interview.
                   Only hand off to "triage" if the user wants to do something unexpected.

                Use the STAR method (Situation, Task, Action, Result) to guide your questions.
                Always maintain a supportive and encouraging tone.
                """,
            tools: [.. interviewDataTools]);

        // --- Technical Interviewer Agent ---
        // Conducts the technical part of the interview.
        // FIX: Now hands off directly to summariser (next phase)
        // instead of back to Triage.
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
                6. When done, hand off directly to "summariser" to generate the interview summary.
                   Only hand off to "triage" if the user wants to do something unexpected.

                Focus on practical, real-world scenarios relevant to the job.
                Always maintain a supportive and encouraging tone.
                """,
            tools: [.. interviewDataTools]);

        // --- Summariser Agent ---
        // Generates the final interview summary.
        // Hands back to Triage only after summary — this is the end of the sequence.
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

        // Build the handoff workflow — sequential chain with Triage as fallback.
        // FIX: Changed from pure hub-and-spoke (every specialist → Triage → next)
        // to a sequential chain (Receptionist → Behavioural → Technical → Summariser).
        // This prevents the stateless Triage from re-routing to an already-completed
        // phase based on keywords in the original user message.
        // Each specialist can still fall back to Triage for out-of-order requests.
        var workflow = AgentWorkflowBuilder
                       .CreateHandoffBuilderWith(triageAgent)
                       .WithHandoffs(triageAgent, [receptionistAgent, behaviouralAgent, technicalAgent, summariserAgent])
                       .WithHandoffs(receptionistAgent, [behaviouralAgent, triageAgent])
                       .WithHandoffs(behaviouralAgent, [technicalAgent, triageAgent])
                       .WithHandoffs(technicalAgent, [summariserAgent, triageAgent])
                       .WithHandoff(summariserAgent, triageAgent)
                       .Build();

        return workflow.SetName(key);
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
    private static Workflow CreateCopilotHandOffWorkflow(IServiceProvider sp, string key)
    {
        var markitdown = sp.GetRequiredKeyedService<McpClient>("mcp-markitdown");
        var interviewData = sp.GetRequiredKeyedService<McpClient>("mcp-interview-data");

        var markitdownTools = markitdown.ListToolsAsync().GetAwaiter().GetResult();
        var interviewDataTools = interviewData.ListToolsAsync().GetAwaiter().GetResult();

        var copilotClient = new CopilotClient();
        copilotClient.StartAsync().GetAwaiter().GetResult();

        // --- Triage Agent ---
        // FIX: Made state-aware to prevent re-routing loops (see Mode 2 comments).
        var triageAgent = copilotClient.AsAIAgent(
            name: "triage",
            instructions: """
                You are the Triage agent for an AI Interview Coach system.
                Your ONLY job is to analyze the conversation and hand off to the right specialist agent.
                You do NOT answer questions or conduct interviews yourself.

                IMPORTANT: Before routing, review the FULL conversation history to determine
                which phases have already been completed. Do NOT re-route to an agent that
                has already finished its work. The interview follows this sequence:
                  1. Receptionist (session setup, document intake)
                  2. Behavioural Interviewer
                  3. Technical Interviewer
                  4. Summariser

                Routing rules (apply in order, skipping completed phases):
                - If the receptionist has NOT yet collected the resume and job description
                  → hand off to "receptionist"
                - If document intake is complete and behavioural interview has NOT started
                  → hand off to "behavioural_interviewer"
                - If behavioural interview is complete and technical interview has NOT started
                  → hand off to "technical_interviewer"
                - If technical interview is complete or the user wants to end
                  → hand off to "summariser"
                - If the user explicitly requests a specific phase, honour that request.
                - If unclear, ask the user to clarify what they'd like to do.

                When a specialist hands back to you, they have COMPLETED their phase.
                Advance to the next phase in the sequence.

                Always be brief and supportive. Let the specialists do the detailed work.
                """);

        // --- Receptionist Agent ---
        // FIX: Now hands off directly to behavioural_interviewer (see Mode 2 comments).
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
                5. Once document intake is complete, let the user know and hand off directly to "behavioural_interviewer"
                   to begin the interview. Only hand off to "triage" if the user wants to do something unexpected.

                The user may choose to proceed without a resume or job description — that's fine.
                Always maintain a supportive and encouraging tone.
                """,
            tools: [.. markitdownTools, .. interviewDataTools]);

        // --- Behavioural Interviewer Agent ---
        // FIX: Now hands off directly to technical_interviewer (see Mode 2 comments).
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
                6. When done, hand off directly to "technical_interviewer" to continue the interview.
                   Only hand off to "triage" if the user wants to do something unexpected.

                Use the STAR method (Situation, Task, Action, Result) to guide your questions.
                Always maintain a supportive and encouraging tone.
                """,
            tools: [.. interviewDataTools]);

        // --- Technical Interviewer Agent ---
        // FIX: Now hands off directly to summariser (see Mode 2 comments).
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
                6. When done, hand off directly to "summariser" to generate the interview summary.
                   Only hand off to "triage" if the user wants to do something unexpected.

                Focus on practical, real-world scenarios relevant to the job.
                Always maintain a supportive and encouraging tone.
                """,
            tools: [.. interviewDataTools]);

        // --- Summariser Agent ---
        // Hands back to Triage only after summary — end of the sequence.
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

        // Build the handoff workflow — sequential chain with Triage as fallback.
        // FIX: Same topology change as Mode 2 (see comments above).
        var workflow = AgentWorkflowBuilder
                       .CreateHandoffBuilderWith(triageAgent)
                       .WithHandoffs(triageAgent, [receptionistAgent, behaviouralAgent, technicalAgent, summariserAgent])
                       .WithHandoffs(receptionistAgent, [behaviouralAgent, triageAgent])
                       .WithHandoffs(behaviouralAgent, [technicalAgent, triageAgent])
                       .WithHandoffs(technicalAgent, [summariserAgent, triageAgent])
                       .WithHandoff(summariserAgent, triageAgent)
                       .Build();

        return workflow.SetName(key);
    }
}

