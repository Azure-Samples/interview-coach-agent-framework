# Build an AI Interview Coach with Microsoft Agent Framework, MCP, and Aspire

Building AI agents is getting easier. Deploying them as part of a real application, with multiple services, persistent state, and production infrastructure, is where things get complicated.

We built an open-source Interview Coach sample to show how [Microsoft Agent Framework](https://aka.ms/agent-framework), [Microsoft Foundry](https://learn.microsoft.com/azure/foundry/what-is-foundry), [Model Context Protocol (MCP)](https://modelcontextprotocol.io/), and [Aspire](https://aspire.dev) fit together in a production-style application. It's a working interview simulator where an AI coach walks you through behavioral and technical questions, then delivers a summary of your performance.

This post covers the patterns we used and the problems they solve.

Here's the link to visit the [Interview Coach demo app](https://aka.ms/agentframework/interviewcoach).

## Why Microsoft Agent Framework?

If you've been building AI agents with .NET, you've probably used Semantic Kernel, AutoGen, or both. [Microsoft Agent Framework](https://aka.ms/agent-framework) is the next step. It's built by the same teams and combines what worked from both projects into a single framework.

It takes AutoGen's agent abstractions and Semantic Kernel's enterprise features (state management, type safety, middleware, telemetry) and puts them under one roof. It also adds graph-based workflows for multi-agent orchestration.

For .NET developers, this means:

- **One framework instead of two.** No more choosing between Semantic Kernel and AutoGen.
- **Familiar patterns.** Agents use dependency injection, `IChatClient`, and the same hosting model as ASP.NET apps.
- **Built for production.** OpenTelemetry, middleware pipelines, and Aspire integration are included.
- **Multi-agent orchestration.** Sequential workflows, concurrent execution, handoff patterns, and group chat are all supported.

The Interview Coach puts all of this into a real application, not just a Hello World.

## Why Microsoft Foundry?

AI agents need more than a model. They need infrastructure. [Microsoft Foundry](https://learn.microsoft.com/azure/foundry/what-is-foundry) is Azure's platform for building and managing AI applications, and it's the recommended backend for Microsoft Agent Framework.

Foundry gives you a single portal for:

- **Model access.** A catalog of models from OpenAI, Meta, Mistral, and others, all through one endpoint.
- **Content safety.** Built-in moderation and PII detection so your agents don't go off the rails.
- **Cost-optimized routing.** Requests get routed to the best model for the job automatically.
- **Evaluation and fine-tuning.** Measure agent quality and improve it over time.
- **Enterprise governance.** Identity, access control, and compliance through Entra ID and Microsoft Defender.

For the Interview Coach, Foundry provides the model endpoint that powers the agents. Because the agent code uses the `IChatClient` interface, Foundry is just a configuration choice, but it's the one that gives you the most tooling out of the box.

The sample also supports [GitHub Models](https://github.com/marketplace/models) as a free alternative for prototyping.

## What does the Interview Coach do?

The Interview Coach is a conversational AI that runs a mock job interview. You provide a resume and a job description, and the agent takes it from there:

1. **Intake.** Collects your resume and the target job description.
2. **Behavioral interview.** Asks STAR-method questions tailored to your experience.
3. **Technical interview.** Asks role-specific technical questions.
4. **Summary.** Generates a performance review with specific feedback.

You interact with it through a Blazor web UI that streams responses in real time.

## Architecture at a glance

The application is split into several services, all orchestrated by Aspire:

- **LLM Provider.** Microsoft Foundry (recommended) or GitHub Models for prototyping.
- **WebUI.** Blazor chat interface for the interview conversation.
- **Agent.** The interview logic, built on Microsoft Agent Framework.
- **MarkItDown MCP Server.** Parses resumes (PDF, DOCX) into markdown via Microsoft's MarkItDown.
- **InterviewData MCP Server.** A .NET MCP server that stores sessions in SQLite.

![Overall architecture](./images/architecture.png)

Aspire handles service discovery, health checks, and telemetry. Each component runs as a separate process, and you start the whole thing with a single command.

## Pattern 1: Pluggable LLM providers via IChatClient

The agent code doesn't know or care which LLM it's talking to. Every agent is built on the `IChatClient` interface from [Microsoft.Extensions.AI](https://learn.microsoft.com/dotnet/ai/microsoft-extensions-ai), so the model provider is a configuration choice, not a code change.

The Interview Coach supports two providers:

- **Microsoft Foundry** (recommended). Content safety, model routing, and enterprise governance included.
- **GitHub Models.** Free tier, good for prototyping without an Azure subscription.

Switching is a one-line config change in `apphost.settings.json`:

```jsonc
{
  // To use Microsoft Foundry as an LLM provider
  "LlmProvider": "MicrosoftFoundry"
}
```

Or pass it as a command-line flag:

```bash
# To use Microsoft Foundry as an LLM provider
aspire run --file ./apphost.cs -- --provider MicrosoftFoundry

# To use GitHub Models as an LLM provider
aspire run --file ./apphost.cs -- --provider GitHubModels
```

Under the hood, the Aspire app host uses a provider factory that wires up the right resource based on the provider setting. The agent project receives an `IChatClient` through dependency injection and never references a specific provider SDK directly. This means you can prototype on GitHub Models for free, then switch to Foundry for production without touching agent code. And when a new provider shows up, you just add it to the factory.

## Pattern 2: Multi-agent handoff

The handoff pattern is where this sample gets interesting. Instead of one agent doing everything, the interview is split across five specialized agents:

| Agent | Role | Tools |
|-------|------|-------|
| **Triage** | Routes messages to the right specialist | None (pure routing) |
| **Receptionist** | Creates sessions, collects resume and job description | MarkItDown + InterviewData |
| **Behavioral Interviewer** | Conducts behavioral questions using the STAR method | InterviewData |
| **Technical Interviewer** | Asks role-specific technical questions | InterviewData |
| **Summarizer** | Generates the final interview summary | InterviewData |

In the handoff pattern, one agent transfers full control of the conversation to the next. The receiving agent takes over entirely. This is different from "agent-as-tools," where a primary agent calls others as helpers but retains control.

Here's how the handoff workflow is wired up:

```csharp
var workflow = AgentWorkflowBuilder
               .CreateHandoffBuilderWith(triageAgent)
               .WithHandoffs(triageAgent, [receptionistAgent, behaviouralAgent, technicalAgent, summariserAgent])
               .WithHandoffs(receptionistAgent, [behaviouralAgent, triageAgent])
               .WithHandoffs(behaviouralAgent, [technicalAgent, triageAgent])
               .WithHandoffs(technicalAgent, [summariserAgent, triageAgent])
               .WithHandoff(summariserAgent, triageAgent)
               .Build();
```

The happy path is sequential: Receptionist → Behavioral → Technical → Summarizer. Each specialist hands off directly to the next. If something goes off-script, agents fall back to Triage for re-routing.

The sample also includes a single-agent mode for simpler deployments, so you can compare the two approaches side by side.

## Pattern 3: MCP for tool integration

Tools in this project don't live inside the agent. They live in their own MCP (Model Context Protocol) servers. The same MarkItDown server could power a completely different agent project, and tool teams can ship independently of agent teams. MCP is also language-agnostic, which is how MarkItDown runs as a Python server while the agent is .NET.

The agent discovers tools at startup through MCP clients and passes them to the appropriate agents:

```csharp
var receptionistAgent = new ChatClientAgent(
    chatClient: chatClient,
    name: "receptionist",
    instructions: "You are the Receptionist. Set up sessions and collect documents...",
    tools: [.. markitdownTools, .. interviewDataTools]);
```

Each agent only gets the tools it needs. Triage gets none (it just routes), interviewers get session access, and the Receptionist gets document parsing plus session access. This follows the principle of least privilege.

## Pattern 4: Aspire orchestration

Aspire ties everything together. The app host defines the service topology: which services exist, how they depend on each other, and what configuration they receive. You get:

- **Service discovery.** Services find each other by name, not hardcoded URLs.
- **Health checks.** The Aspire dashboard shows the status of every component.
- **Distributed tracing.** OpenTelemetry wired up through shared service defaults.
- **One-command startup.** `aspire run --file ./apphost.cs` launches everything.

For deployment, `azd up` pushes the entire application to Azure Container Apps.

## Get started

### Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0) or later
- [Azure Subscription](https://azure.microsoft.com/free)
- [Microsoft Foundry](https://ai.azure.com) project (or use [GitHub Models](https://github.com/marketplace/models) for free prototyping)

### Run it locally

```bash
git clone https://github.com/Azure-Samples/interview-coach-agent-framework.git
cd interview-coach-agent-framework

# Configure credentials
dotnet user-secrets --file ./apphost.cs set MicrosoftFoundry:Project:Endpoint "<your-endpoint>"
dotnet user-secrets --file ./apphost.cs set MicrosoftFoundry:Project:ApiKey "<your-key>"

# Start all services
aspire run --file ./apphost.cs
```

Open the Aspire Dashboard, wait for all services to show as Running, and click the WebUI endpoint to start your mock interview.

![Aspire Dashboard](./images/aspire-dashboard.png)

Here's how the handoff pattern works - visualized on DevUI.

![Agent Framework Dev UI](./images/devui.png)

You can use this chat UI to interact with the agent as the interview candidate.

![Chat UI](./images/chat-ui.png)

### Deploy to Azure

```bash
azd auth login
azd up
```

That's it. Aspire and `azd` handle the rest. Once you complete, you can safely delete all the resources by running:

```bash
azd down --force --purge
```

## What you'll learn from this sample

After working through the Interview Coach, you'll have seen:

- Using Microsoft Foundry as the model backend
- Building single-agent and multi-agent systems with Microsoft Agent Framework
- Splitting workflows across specialized agents with handoff orchestration
- Creating and consuming MCP tool servers independently of agent code
- Orchestrating multi-service applications with Aspire
- Writing prompts that produce consistent, structured behavior
- Deploying everything with `azd up`

## Try it out

The full source is on GitHub: [Azure-Samples/interview-coach-agent-framework](https://aka.ms/agentframework/interviewcoach)

If you're new to Microsoft Agent Framework, start with the [framework documentation](https://aka.ms/agent-framework) and the [Hello World sample](https://aka.ms/dotnet/agent-framework/helloworld). Then come back here to see how the pieces fit in a larger project.

If you build something with these patterns, [open an issue](https://github.com/Azure-Samples/interview-coach-agent-framework/issues) and tell us about it.

## What's next?

We're working on more integrations: [Microsoft Foundry Agent Service](https://learn.microsoft.com/agent-framework/agents/providers/azure-ai-foundry?pivots=programming-language-csharp), [GitHub Copilot](https://learn.microsoft.com/agent-framework/agents/providers/github-copilot?pivots=programming-language-csharp), and [A2A](https://learn.microsoft.com/en-us/agent-framework/integrations/a2a?pivots=programming-language-csharp). We'll update the sample as they ship.

## Resources

- [Microsoft Agent Framework documentation](https://aka.ms/agent-framework)
- [Introducing Microsoft Agent Framework preview](https://devblogs.microsoft.com/dotnet/introducing-microsoft-agent-framework-preview/)
- [Microsoft Agent Framework Reaches Release Candidate](https://devblogs.microsoft.com/foundry/microsoft-agent-framework-reaches-release-candidate/)
- [Microsoft Foundry documentation](https://learn.microsoft.com/azure/foundry/what-is-foundry)
- [Microsoft Foundry Agent Service](https://learn.microsoft.com/en-us/azure/foundry/agents/overview)
- [Microsoft Foundry Portal](https://ai.azure.com)
- [Model Context Protocol specification](https://modelcontextprotocol.io)
- [Aspire documentation](https://aspire.dev)
