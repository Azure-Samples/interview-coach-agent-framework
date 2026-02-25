// ============================================================================
// TEMPORARY WORKAROUND — Remove when upstream fix is released.
//
// Upstream issues:
//   https://github.com/microsoft/agent-framework/issues/2775
//   https://github.com/microsoft/agent-framework/issues/3962
//
// Problem:
//   Handoff tools return plain string content (e.g. "Transferred.") which
//   causes AGUIChatClient to throw JsonException in DeserializeResultIfAvailable.
//
// Fix:
//   Wraps the workflow AIAgent with a streaming middleware that converts any
//   plain-string FunctionResultContent.Result values to JsonElement before
//   the AGUI serialization pipeline processes them.
// ============================================================================

using System.Runtime.CompilerServices;
using System.Text.Json;

using Microsoft.Agents.AI;
using Microsoft.Extensions.AI;

namespace InterviewCoach.Agent;

/// <summary>
/// Temporary workaround for microsoft/agent-framework#2775.
/// Wraps a handoff workflow <see cref="AIAgent"/> so that plain-string tool
/// results are serialized to <see cref="JsonElement"/> before the AG-UI
/// pipeline processes them. Safe to remove once the upstream fix ships.
/// </summary>
internal static class HandoffToolResultFix
{
    public static AIAgent CreateFixedAgent(this AIAgent innerAgent)
    {
        return Apply(innerAgent);
    }

    /// <summary>
    /// Wraps the given <paramref name="agent"/> with a streaming middleware
    /// that fixes plain-string <see cref="FunctionResultContent.Result"/>
    /// values by converting them to <see cref="JsonElement"/>.
    /// </summary>
    internal static AIAgent Apply(AIAgent agent)
    {
        return new AIAgentBuilder(agent)
            .Use(
                runFunc: null,
                runStreamingFunc: static (messages, session, options, inner, ct) =>
                    FixToolResults(inner.RunStreamingAsync(messages, session, options, ct)))
            .Build();
    }

    private static async IAsyncEnumerable<AgentResponseUpdate> FixToolResults(
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
}
