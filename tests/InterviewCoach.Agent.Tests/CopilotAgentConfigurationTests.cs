using GitHub.Copilot;

using Microsoft.Agents.AI;
using Microsoft.Agents.AI.Workflows;
using Microsoft.Extensions.AI;

using Xunit;

namespace InterviewCoach.Agent.Tests;

public class CopilotAgentConfigurationTests
{
    [Theory]
    [InlineData("coach")]
    [InlineData("triage")]
    [InlineData("receptionist")]
    [InlineData("behavioural_interviewer")]
    [InlineData("technical_interviewer")]
    [InlineData("summariser")]
    public void WithResponseLanguageInstructions_PreservesRoleAndAddsSharedPolicy(string role)
    {
        var roleInstructions = $"You are the {role}.";

        var instructions = AgentDelegateFactory.WithResponseLanguageInstructions(roleInstructions);

        Assert.StartsWith(roleInstructions, instructions);
        Assert.EndsWith(AgentDelegateFactory.ResponseLanguageInstructions, instructions);
        Assert.Contains("explicit response-language request", instructions);
        Assert.Contains("user's own conversational messages", instructions);
        Assert.Contains("documents, URLs, quotations, or tool results", instructions);
        Assert.Contains("short or language-ambiguous", instructions, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("across handoffs", instructions);
        Assert.Contains("not tool names, structured arguments, or stored source documents", instructions);
    }

    [Fact]
    public void CreateCopilotSessionConfig_PreservesSharedPolicyAndRuntimeHandoffInstructions()
    {
        var instructions = AgentDelegateFactory.WithResponseLanguageInstructions("You are the triage agent.");
        var options = new ChatClientAgentRunOptions(new ChatOptions
        {
            Instructions = "Call a handoff tool to transfer control.",
        });

        var config = AgentDelegateFactory.CreateCopilotSessionConfig(
            null, AgentDelegateFactory.MergeCopilotInstructions(instructions, options), null);

        Assert.Contains("You are the triage agent.", config.SystemMessage!.Content);
        Assert.Contains(AgentDelegateFactory.ResponseLanguageInstructions, config.SystemMessage.Content);
        Assert.Contains("Call a handoff tool to transfer control.", config.SystemMessage.Content);
    }

    [Fact]
    public async Task CreateCopilotRunAgent_PreservesIdentityAcrossInvocations()
    {
        await using var client = new CopilotClient(new CopilotClientOptions
        {
            Mode = CopilotClientMode.Empty,
            BaseDirectory = Path.Combine(Path.GetTempPath(), "interview-coach-copilot-tests"),
        });
        var handoffTool = AIFunctionFactory.CreateDeclaration(
            $"{HandoffWorkflowBuilder.FunctionPrefix}1",
            "Transfer to the receptionist",
            CreateTool("handoff_schema").JsonSchema);

        var original = AgentDelegateFactory.CreateCopilotRunAgent(
            client, "triage", "Routes interviews.", null, "Route the user.", null);
        var invocation = AgentDelegateFactory.CreateCopilotRunAgent(
            client, "triage", "Routes interviews.", null, "Route the user.", [handoffTool]);

        Assert.Equal("triage", original.Id);
        Assert.Equal(original.Id, invocation.Id);
    }

    [Fact]
    public void CreateCopilotSessionConfig_AllowListsOnlyConfiguredTools()
    {
        var tool = CreateTool("interview_lookup");

        var config = AgentDelegateFactory.CreateCopilotSessionConfig(
            model: "gpt-5",
            instructions: "Test instructions",
            tools: [tool]);

        Assert.Equal(["custom:interview_lookup"], config.AvailableTools);
        Assert.Single(config.Tools!);
        Assert.Equal("gpt-5", config.Model);
        Assert.NotNull(config.OnPermissionRequest);
    }

    [Fact]
    public void CreateCopilotSessionConfig_ToollessAgentHasEmptyAllowList()
    {
        var config = AgentDelegateFactory.CreateCopilotSessionConfig(
            model: null,
            instructions: "Test instructions",
            tools: null);

        Assert.Empty(config.AvailableTools!);
        Assert.Empty(config.Tools!);
        Assert.Equal("gpt-5-mini", config.Model);
    }

    [Fact]
    public void MergeCopilotTools_AddsRunTimeHandoffToolsWithoutDuplicates()
    {
        var configuredTool = CreateTool("interview_lookup");
        var handoffTool = AIFunctionFactory.CreateDeclaration(
            $"{HandoffWorkflowBuilder.FunctionPrefix}1",
            "Transfer to the receptionist",
            CreateTool("handoff_schema").JsonSchema);
        var options = new ChatClientAgentRunOptions(new ChatOptions
        {
            Tools = [configuredTool, handoffTool],
        });

        var tools = AgentDelegateFactory.MergeCopilotTools([configuredTool], options);
        var config = AgentDelegateFactory.CreateCopilotSessionConfig(null, "Test instructions", tools);

        Assert.Equal(["interview_lookup", "handoff_to_1"], tools.Select(tool => tool.Name));
        Assert.IsAssignableFrom<AIFunction>(config.Tools!.ElementAt(1));
        Assert.Equal(["custom:interview_lookup", "custom:handoff_to_1"], config.AvailableTools);
    }

    [Fact]
    public void MergeCopilotInstructions_AppendsRunTimeHandoffInstructions()
    {
        var options = new ChatClientAgentRunOptions(new ChatOptions
        {
            Instructions = "Call a handoff tool to transfer control.",
        });

        var instructions = AgentDelegateFactory.MergeCopilotInstructions(
            "You are the triage agent.",
            options);

        Assert.Contains("You are the triage agent.", instructions);
        Assert.Contains("Call a handoff tool to transfer control.", instructions);
    }

    [Fact]
    public async Task PreserveCopilotHandoffAsync_LeavesTransferUnresolvedAndDrainsTurn()
    {
        var lookupCall = new AgentResponseUpdate(ChatRole.Assistant,
            [new FunctionCallContent("lookup", "get_interview_session")]);
        var lookupResult = new AgentResponseUpdate(ChatRole.Tool,
            [new FunctionResultContent("lookup", "Session found.")]);
        var transferCall = new AgentResponseUpdate(ChatRole.Assistant,
            [new FunctionCallContent("transfer", "handoff_to_1")]);
        var drained = false;

        async IAsyncEnumerable<AgentResponseUpdate> CopilotTurn()
        {
            yield return lookupCall;
            yield return lookupResult;
            yield return transferCall;
            yield return new AgentResponseUpdate(ChatRole.Tool,
                [new FunctionResultContent("transfer", "Transferred.")]);
            yield return new AgentResponseUpdate(ChatRole.Assistant, "I've routed your request.");
            await Task.CompletedTask;
            drained = true;
        }

        var updates = await CollectAsync(AgentDelegateFactory.PreserveCopilotHandoffAsync(
            CopilotTurn(), new HashSet<string> { "handoff_to_1" }, TestContext.Current.CancellationToken));

        Assert.Equal([lookupCall, lookupResult, transferCall], updates);
        Assert.True(drained);
        Assert.DoesNotContain(updates.SelectMany(update => update.Contents),
            content => content is FunctionResultContent { CallId: "transfer" });
    }

    [Fact]
    public async Task PreserveCopilotHandoffAsync_OrdinaryToolsAndRepliesPassThrough()
    {
        var updates = new[]
        {
            new AgentResponseUpdate(ChatRole.Assistant,
                [new FunctionCallContent("save", "add_interview_session")]),
            new AgentResponseUpdate(ChatRole.Tool,
                [new FunctionResultContent("save", "Saved.")]),
            new AgentResponseUpdate(ChatRole.Assistant, "Your session is saved."),
        };

        var result = await CollectAsync(AgentDelegateFactory.PreserveCopilotHandoffAsync(
            ToAsyncEnumerable(updates), new HashSet<string> { "handoff_to_1" }, TestContext.Current.CancellationToken));

        Assert.Equal(updates, result);
    }

    [Fact]
    public async Task PreserveCopilotHandoffAsync_UnregisteredTransferNamePassesThrough()
    {
        var updates = new[]
        {
            new AgentResponseUpdate(ChatRole.Assistant,
                [new FunctionCallContent("other", "handoff_to_2")]),
            new AgentResponseUpdate(ChatRole.Tool,
                [new FunctionResultContent("other", "Transferred.")]),
        };

        var result = await CollectAsync(AgentDelegateFactory.PreserveCopilotHandoffAsync(
            ToAsyncEnumerable(updates), new HashSet<string> { "handoff_to_1" }, TestContext.Current.CancellationToken));

        Assert.Equal(updates, result);
    }

    [Fact]
    public async Task PreserveCopilotHandoffAsync_ErrorAfterTransferIsNotHidden()
    {
        async IAsyncEnumerable<AgentResponseUpdate> FailingTurn()
        {
            yield return new AgentResponseUpdate(ChatRole.Assistant,
                [new FunctionCallContent("transfer", "handoff_to_1")]);
            await Task.CompletedTask;
            throw new InvalidOperationException("Copilot turn failed.");
        }

        var error = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            CollectAsync(AgentDelegateFactory.PreserveCopilotHandoffAsync(
                FailingTurn(), new HashSet<string> { "handoff_to_1" }, TestContext.Current.CancellationToken)));

        Assert.Equal("Copilot turn failed.", error.Message);
    }

    private static async Task<List<AgentResponseUpdate>> CollectAsync(
        IAsyncEnumerable<AgentResponseUpdate> updates)
    {
        var result = new List<AgentResponseUpdate>();
        await foreach (var update in updates)
        {
            result.Add(update);
        }

        return result;
    }

    private static async IAsyncEnumerable<AgentResponseUpdate> ToAsyncEnumerable(
        IEnumerable<AgentResponseUpdate> updates)
    {
        foreach (var update in updates)
        {
            yield return update;
        }

        await Task.CompletedTask;
    }

    private static AIFunction CreateTool(string name)
    {
        return AIFunctionFactory.Create(
            () => "ok",
            new AIFunctionFactoryOptions { Name = name });
    }
}
