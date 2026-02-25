using System.Text.Json;

using Microsoft.Agents.AI;
using Microsoft.Extensions.AI;

using Xunit;

namespace InterviewCoach.Agent.Tests;

public class HandoffToolResultFixTests
{
    [Theory]
    [InlineData("Transferred.")]
    [InlineData("Exception thrown in tool.")]
    public async Task Apply_StringToolResult_ConvertedToJsonElement(string result)
    {
        // Arrange — create a mock agent that yields one update with a string tool result
        var innerAgent = CreateMockAgent(
            new AgentResponseUpdate(ChatRole.Tool,
            [
                new FunctionResultContent("call_1", result)
            ]));

        // Act
        var fixedAgent = HandoffToolResultFix.Apply(innerAgent);
        var updates = new List<AgentResponseUpdate>();
        await foreach (var update in fixedAgent.RunStreamingAsync([], cancellationToken: CancellationToken.None))
        {
            updates.Add(update);
        }

        // Assert
        var frc = updates.SelectMany(u => u.Contents).OfType<FunctionResultContent>().Single();
        Assert.IsType<JsonElement>(frc.Result);
        Assert.Equal(result, ((JsonElement)frc.Result!).GetString());
    }

    [Fact]
    public async Task Apply_JsonElementToolResult_PassesThrough()
    {
        var jsonResult = JsonSerializer.SerializeToElement(new { status = "ok" });
        var innerAgent = CreateMockAgent(
            new AgentResponseUpdate(ChatRole.Tool,
            [
                new FunctionResultContent("call_1", jsonResult)
            ]));

        var fixedAgent = HandoffToolResultFix.Apply(innerAgent);
        var updates = new List<AgentResponseUpdate>();
        await foreach (var update in fixedAgent.RunStreamingAsync([], cancellationToken: CancellationToken.None))
        {
            updates.Add(update);
        }

        var frc = updates.SelectMany(u => u.Contents).OfType<FunctionResultContent>().Single();
        Assert.IsType<JsonElement>(frc.Result);
        Assert.Equal("ok", ((JsonElement)frc.Result!).GetProperty("status").GetString());
    }

    [Fact]
    public async Task Apply_NullToolResult_PassesThrough()
    {
        var innerAgent = CreateMockAgent(
            new AgentResponseUpdate(ChatRole.Tool,
            [
                new FunctionResultContent("call_1", result: null)
            ]));

        var fixedAgent = HandoffToolResultFix.Apply(innerAgent);
        var updates = new List<AgentResponseUpdate>();
        await foreach (var update in fixedAgent.RunStreamingAsync([], cancellationToken: CancellationToken.None))
        {
            updates.Add(update);
        }

        var frc = updates.SelectMany(u => u.Contents).OfType<FunctionResultContent>().Single();
        Assert.Null(frc.Result);
    }

    [Fact]
    public async Task Apply_TextContentOnly_PassesThrough()
    {
        var innerAgent = CreateMockAgent(
            new AgentResponseUpdate(ChatRole.Assistant, "Hello, I'm the interview coach!"));

        var fixedAgent = HandoffToolResultFix.Apply(innerAgent);
        var updates = new List<AgentResponseUpdate>();
        await foreach (var update in fixedAgent.RunStreamingAsync([], cancellationToken: CancellationToken.None))
        {
            updates.Add(update);
        }

        Assert.Single(updates);
        Assert.Equal("Hello, I'm the interview coach!", updates[0].Text);
    }

    [Theory]
    [InlineData("Transferred.")]
    [InlineData("Exception thrown in tool.")]
    public async Task Apply_MixedContent_OnlyFixesStringResults(string result)
    {
        var innerAgent = CreateMockAgent(
            new AgentResponseUpdate(ChatRole.Tool,
            [
                new TextContent("some text"),
                new FunctionResultContent("call_1", result)
            ]));

        var fixedAgent = HandoffToolResultFix.Apply(innerAgent);
        var updates = new List<AgentResponseUpdate>();
        await foreach (var update in fixedAgent.RunStreamingAsync([], cancellationToken: CancellationToken.None))
        {
            updates.Add(update);
        }

        var contents = updates.SelectMany(u => u.Contents).ToList();
        var textContent = contents.OfType<TextContent>().Single();
        Assert.Equal("some text", textContent.Text);

        var frc = contents.OfType<FunctionResultContent>().Single();
        Assert.IsType<JsonElement>(frc.Result);
        Assert.Equal(result, ((JsonElement)frc.Result!).GetString());
    }

    [Fact]
    public async Task Apply_EmptyStream_CompletesWithoutError()
    {
        var innerAgent = CreateMockAgent(); // no updates

        var fixedAgent = HandoffToolResultFix.Apply(innerAgent);
        var updates = new List<AgentResponseUpdate>();
        await foreach (var update in fixedAgent.RunStreamingAsync([], cancellationToken: CancellationToken.None))
        {
            updates.Add(update);
        }

        Assert.Empty(updates);
    }

    /// <summary>
    /// Helper: creates a mock AIAgent that yields the given updates when streamed.
    /// Uses AIAgentBuilder with a runStreamingFunc delegate.
    /// </summary>
    private static AIAgent CreateMockAgent(params AgentResponseUpdate[] updates)
    {
        // Create a minimal "inner" agent that does nothing
        var noop = new AIAgentBuilder(
            new AnonymousAIAgent())
            .Use(
                runFunc: null,
                runStreamingFunc: (messages, session, options, inner, ct) =>
                    ToAsyncEnumerable(updates))
            .Build();
        return noop;
    }

    private static async IAsyncEnumerable<AgentResponseUpdate> ToAsyncEnumerable(
        AgentResponseUpdate[] items)
    {
        foreach (var item in items)
        {
            yield return item;
        }
        await Task.CompletedTask;
    }

    /// <summary>
    /// Minimal AIAgent implementation for testing. All operations throw.
    /// Only used as an "inner" agent seed for AIAgentBuilder.
    /// </summary>
    private sealed class AnonymousAIAgent : AIAgent
    {
        protected override Task<AgentResponse> RunCoreAsync(
            IEnumerable<ChatMessage> messages,
            AgentSession? session = null,
            AgentRunOptions? options = null,
            CancellationToken cancellationToken = default)
            => throw new NotImplementedException();

        protected override IAsyncEnumerable<AgentResponseUpdate> RunCoreStreamingAsync(
            IEnumerable<ChatMessage> messages,
            AgentSession? session = null,
            AgentRunOptions? options = null,
            CancellationToken cancellationToken = default)
            => throw new NotImplementedException();

        protected override ValueTask<AgentSession> CreateSessionCoreAsync(
            CancellationToken cancellationToken = default)
            => throw new NotImplementedException();

        protected override ValueTask<JsonElement> SerializeSessionCoreAsync(
            AgentSession session,
            JsonSerializerOptions? options = null,
            CancellationToken cancellationToken = default)
            => throw new NotImplementedException();

        protected override ValueTask<AgentSession> DeserializeSessionCoreAsync(
            JsonElement data,
            JsonSerializerOptions? options = null,
            CancellationToken cancellationToken = default)
            => throw new NotImplementedException();
    }
}
