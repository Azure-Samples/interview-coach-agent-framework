extern alias AppHostCore;

using Microsoft.Extensions.Configuration;

using Xunit;

using CoreAgentMode = AppHostCore::AgentMode;
using CoreLlmProvider = AppHostCore::LlmProvider;
using CoreLlmResourceFactory = AppHostCore::LlmResourceFactory;

namespace InterviewCoach.Agent.Tests;

public class LlmResourceFactoryTests
{
    [Fact]
    public void GetProviderAndAgentMode_CommandLineOverridesConfiguration()
    {
        var config = CreateConfiguration(CoreLlmProvider.MicrosoftFoundry, CoreAgentMode.Single);

        var (provider, mode) = CoreLlmResourceFactory.GetProviderAndAgentMode(
            config,
            ["--provider", "GitHubCopilot", "--mode", "HandOff"]);

        Assert.Equal(CoreLlmProvider.GitHubCopilot, provider);
        Assert.Equal(CoreAgentMode.HandOff, mode);
    }

    [Theory]
    [InlineData(CoreAgentMode.Single)]
    [InlineData(CoreAgentMode.HandOff)]
    public void GetProviderAndAgentMode_GitHubCopilotSupportsEveryMode(CoreAgentMode mode)
    {
        var config = CreateConfiguration(CoreLlmProvider.GitHubCopilot, mode);

        var result = CoreLlmResourceFactory.GetProviderAndAgentMode(config, []);

        Assert.Equal((CoreLlmProvider.GitHubCopilot, mode), result);
    }

    [Theory]
    [InlineData("LlmHandOff")]
    [InlineData("CopilotHandOff")]
    public void GetProviderAndAgentMode_RemovedModeIsRejected(string removedMode)
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["LlmProvider"] = "GitHubCopilot",
                ["AgentMode"] = removedMode,
            })
            .Build();

        var exception = Assert.Throws<InvalidOperationException>(
            () => CoreLlmResourceFactory.GetProviderAndAgentMode(config, []));

        Assert.Contains("AgentMode", exception.Message);
    }

    [Fact]
    public void GetProviderAndAgentMode_MissingCommandLineValueIsRejected()
    {
        var config = CreateConfiguration(CoreLlmProvider.MicrosoftFoundry, CoreAgentMode.Single);

        var exception = Assert.Throws<InvalidOperationException>(
            () => CoreLlmResourceFactory.GetProviderAndAgentMode(config, ["--provider"]));

        Assert.Contains("--provider", exception.Message);
    }

    [Fact]
    public void GetProviderAndAgentMode_RemovedAzureOpenAIProviderIsRejected()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["LlmProvider"] = "AzureOpenAI",
                ["AgentMode"] = "Single",
            })
            .Build();

        var exception = Assert.Throws<InvalidOperationException>(
            () => CoreLlmResourceFactory.GetProviderAndAgentMode(config, []));

        Assert.Contains("LlmProvider", exception.Message);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("{{GITHUB_PAT}}")]
    public void GetGitHubToken_MissingOrPlaceholderValueUsesAmbientAuthentication(string? token)
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["GitHubCopilot:Token"] = token,
            })
            .Build();

        Assert.Null(CoreLlmResourceFactory.GetGitHubToken(config));
    }

    [Fact]
    public void GetGitHubToken_ConfiguredValueIsReturned()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["GitHubCopilot:Token"] = "github_pat_test",
            })
            .Build();

        Assert.Equal("github_pat_test", CoreLlmResourceFactory.GetGitHubToken(config));
    }

    private static IConfiguration CreateConfiguration(CoreLlmProvider provider, CoreAgentMode mode)
    {
        return new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["LlmProvider"] = provider.ToString(),
                ["AgentMode"] = mode.ToString(),
            })
            .Build();
    }
}
