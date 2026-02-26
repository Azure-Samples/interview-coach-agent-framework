// ============================================================================
// Observability middleware for Copilot SDK–backed agents.
//
// The GitHub Copilot SDK wraps LLM calls internally, so the standard
// IChatClient/OpenTelemetry pipeline never sees them. This middleware sits
// at the AIAgent boundary (via AIAgentBuilder.Use) and emits:
//   • Structured log messages (ILogger) for every agent turn, tool call,
//     handoff, and text chunk.
//   • OpenTelemetry Activity spans so agent turns appear in the Aspire
//     dashboard alongside HTTP / ASP.NET Core traces.
// ============================================================================

using System.Diagnostics;
using System.Runtime.CompilerServices;

using Microsoft.Agents.AI;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.Logging;

namespace InterviewCoach.Agent;

internal static class CopilotSDKTracingMiddleware
{
    /// <summary>
    /// The <see cref="ActivitySource"/> used to create spans for Copilot SDK agent turns.
    /// Register this source name in the OpenTelemetry tracing configuration.
    /// </summary>
    internal static readonly ActivitySource ActivitySource = new("InterviewCoach.CopilotSDK");

    /// <summary>
    /// Wraps a Copilot SDK <see cref="AIAgent"/> with tracing and logging middleware
    /// so that agent turns, tool calls, and handoffs are visible in logs and traces.
    /// </summary>
    public static AIAgent CreateFixedCopilotSDKAgent(this AIAgent innerAgent, ILoggerFactory loggerFactory)
    {
        var logger = loggerFactory.CreateLogger("InterviewCoach.CopilotSDK");

        return new AIAgentBuilder(innerAgent)
            .Use(
                runFunc: null,
                runStreamingFunc: (messages, session, options, inner, ct) =>
                    TraceAgentStreaming(inner, messages, session, options, logger, ct))
            .Build();
    }

    private static async IAsyncEnumerable<AgentResponseUpdate> TraceAgentStreaming(
        AIAgent agent,
        IEnumerable<ChatMessage> messages,
        AgentSession? session,
        AgentRunOptions? options,
        ILogger logger,
        [EnumeratorCancellation] CancellationToken ct = default)
    {
        var agentName = agent.Name ?? "unknown";
        var messageCount = messages.Count();

        using var activity = ActivitySource.StartActivity($"CopilotSDK.Agent:{agentName}");
        activity?.SetTag("agent.name", agentName);
        activity?.SetTag("agent.message_count", messageCount);

        logger.LogInformation("[CopilotSDK] Agent '{AgentName}' starting turn (messages={MessageCount})",
            agentName, messageCount);

        var updateCount = 0;

        await foreach (var update in agent.RunStreamingAsync(messages, session, options, ct))
        {
            updateCount++;

            foreach (var content in update.Contents)
            {
                switch (content)
                {
                    case FunctionCallContent fcc:
                        logger.LogInformation("[CopilotSDK] Agent '{AgentName}' → tool call: {ToolName}({CallId})",
                            agentName, fcc.Name, fcc.CallId);
                        activity?.AddEvent(new ActivityEvent("ToolCall", tags: new ActivityTagsCollection
                        {
                            ["tool.name"] = fcc.Name,
                            ["tool.call_id"] = fcc.CallId
                        }));
                        break;

                    case FunctionResultContent frc:
                        logger.LogInformation("[CopilotSDK] Agent '{AgentName}' ← tool result: ({CallId})",
                            agentName, frc.CallId);
                        activity?.AddEvent(new ActivityEvent("ToolResult", tags: new ActivityTagsCollection
                        {
                            ["tool.call_id"] = frc.CallId
                        }));
                        break;

                    case TextContent tc when tc.Text?.Contains("transfer", StringComparison.OrdinalIgnoreCase) == true:
                        logger.LogInformation("[CopilotSDK] Agent '{AgentName}' handoff signal: {Text}",
                            agentName, tc.Text);
                        activity?.AddEvent(new ActivityEvent("Handoff", tags: new ActivityTagsCollection
                        {
                            ["handoff.text"] = tc.Text
                        }));
                        break;
                }
            }

            yield return update;
        }

        activity?.SetTag("agent.update_count", updateCount);
        logger.LogInformation("[CopilotSDK] Agent '{AgentName}' completed turn ({UpdateCount} updates)",
            agentName, updateCount);
    }
}
