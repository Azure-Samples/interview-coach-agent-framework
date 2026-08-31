using Microsoft.Agents.AI;
using Microsoft.Agents.AI.Workflows;
using Microsoft.Extensions.AI;

using Xunit;

namespace InterviewCoach.Agent.Tests;

public class CopilotAgentConfigurationTests
{
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

    private static AIFunction CreateTool(string name)
    {
        return AIFunctionFactory.Create(
            () => "ok",
            new AIFunctionFactoryOptions { Name = name });
    }
}
