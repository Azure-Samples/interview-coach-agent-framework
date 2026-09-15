using System.ClientModel.Primitives;
using System.ComponentModel;
using Azure.Identity;
using Microsoft.Agents.AI;
using Microsoft.Extensions.AI;
using OpenAI;
using OpenAI.Chat;

string endpoint = Environment.GetEnvironmentVariable("FOUNDRY_OPENAI_ENDPOINT")
    ?? throw new InvalidOperationException("Set FOUNDRY_OPENAI_ENDPOINT before running.");
string deployment = Environment.GetEnvironmentVariable("FOUNDRY_DEPLOYMENT")
    ?? throw new InvalidOperationException("Set FOUNDRY_DEPLOYMENT before running.");

if (!Uri.TryCreate(endpoint, UriKind.Absolute, out Uri? modelEndpoint)
    || modelEndpoint.Scheme != Uri.UriSchemeHttps
    || modelEndpoint.AbsolutePath != "/openai/v1/"
    || !string.IsNullOrEmpty(modelEndpoint.Query)
    || !string.IsNullOrEmpty(modelEndpoint.Fragment))
{
    throw new InvalidOperationException(
        "FOUNDRY_OPENAI_ENDPOINT must be an HTTPS endpoint ending in /openai/v1/ with no query or fragment.");
}
if (string.IsNullOrWhiteSpace(deployment))
{
    throw new InvalidOperationException("FOUNDRY_DEPLOYMENT must contain the existing deployment name.");
}

BearerTokenPolicy authentication = new(
    new AzureCliCredential(),
    "https://cognitiveservices.azure.com/.default");

#pragma warning disable OPENAI001
ChatClient modelClient = new(
    authenticationPolicy: authentication,
    model: deployment,
    options: new OpenAIClientOptions { Endpoint = modelEndpoint });
#pragma warning restore OPENAI001

using IChatClient chatClient = modelClient.AsIChatClient();
AIAgent agent = new ChatClientAgent(
    chatClient,
    name: "release-reviewer",
    instructions: """
        Help a developer understand a fictional team's release checks.
        Use get_release_check when the user asks about an API or database release.
        Explain the returned check, then ask one question about how to verify it.
        If the tool rejects an input, explain the supported choices.
        You cannot inspect a real deployment or approve a release.
        """,
    tools: [AIFunctionFactory.Create(GetReleaseCheck, new AIFunctionFactoryOptions
    {
        Name = "get_release_check",
        Description = "Returns a fictional team's release check for api or database."
    })]);

AgentSession session = await agent.CreateSessionAsync();
Console.WriteLine(await agent.RunAsync(
    "Use get_release_check for api. Explain the returned check.", session));
Console.WriteLine(await agent.RunAsync(
    "Which check did we just discuss? Restate it as one question.", session));

static string GetReleaseCheck([Description("One of: api, database")] string area)
    => area.ToLowerInvariant() switch
    {
        "api" => "Check that the integration tests cover a failed downstream request.",
        "database" => "Check that a migration can be rehearsed against fictional data.",
        _ => throw new ArgumentException("Choose api or database.", nameof(area))
    };
