# Multi-Agent Architecture

This project demonstrates three approaches to building AI agents with [Microsoft Agent Framework](https://aka.ms/agent-framework). All three modes are implemented in `src/InterviewCoach.Agent/AgentDelegateFactory.cs` and can be switched via configuration.

## Overview

| Mode | Approach | Agent Count | LLM Backend | Best For |
|------|----------|-------------|-------------|----------|
| **Single** | Single Agent | 1 | Foundry / Azure OpenAI / GitHub Models | Simple deployments, getting started |
| **LlmHandOff** | Multi-Agent Handoff (ChatClient) | 5 | Foundry / Azure OpenAI / GitHub Models | Production multi-agent with cloud LLMs |
| **CopilotHandOff** | Multi-Agent Handoff (GitHub Copilot) | 5 | GitHub Copilot SDK | Local development with Copilot |

## How to Switch Modes

The agent mode is controlled by the `AgentMode` setting in `apphost.settings.json`:

```json
{
  "AgentMode": "Single",       // Mode 1: Single agent
  // "AgentMode": "LlmHandOff",   // Mode 2: Multi-agent handoff (ChatClient)
  // "AgentMode": "CopilotHandOff" // Mode 3: Multi-agent handoff (GitHub Copilot)
}
```

You can also pass the mode as a CLI argument:

```bash
aspire run --file ./apphost.cs -- --mode LlmHandOff
```

The `AgentDelegateFactory.AddAIAgent()` method in `src/InterviewCoach.Agent/AgentDelegateFactory.cs` reads this configuration and creates the appropriate agent(s):

```csharp
IHostedAgentBuilder agentBuilder = mode switch
{
    AgentMode.Single => builder.AddAIAgent(name, CreateSingleAgent),
    AgentMode.LlmHandOff => builder.AddHandOffWorkflow(name, CreateLlmHandOffWorkflow),
    AgentMode.CopilotHandOff => builder.AddHandOffWorkflow(name, CreateCopilotHandOffWorkflow),
    _ => throw new NotSupportedException($"The specified agent mode '{mode}' is not supported.")
};
```

All three modes share the same MCP client setup, hosting pipeline, and API endpoints. No code changes are needed.

---

## Mode 1: Single Agent

The simplest approach — one `ChatClientAgent` handles the entire interview process.

```
User ←→ Interview Coach Agent ←→ MCP Tools
```

The agent has a comprehensive instruction prompt covering session management, document intake, behavioural questions, technical questions, and summarization. All MCP tools (MarkItDown + InterviewData) are available to the single agent.
See `CreateSingleAgent()` in [AgentDelegateFactory.cs](../src/InterviewCoach.Agent/AgentDelegateFactory.cs) for the implementation.
**When to use:** Getting started, simple deployments, or when multi-agent complexity isn't needed.

---

## Mode 2: Multi-Agent Handoff (ChatClient + LLM Provider)

Splits the interview coach into **5 specialized agents** connected via the [handoff orchestration pattern](https://learn.microsoft.com/en-us/agent-framework/workflows/orchestrations/handoff).

### What is Handoff?

In the handoff pattern, agents transfer **full control** of the conversation to one another. Unlike "agent-as-tools" (where a primary agent calls others as helpers), handoff means the receiving agent takes over entirely. This is ideal for the interview flow where each phase has distinct responsibilities.

### Agent Topology

```
                    ┌─────────────────┐
                    │  Receptionist   │
                    │  (docs + setup) │
                    └────────┬────────┘
                             │
┌───────────────┐    ┌───────┴───────┐    ┌──────────────────┐
│  Behavioural  │←───│    Triage     │───→│    Technical     │
│  Interviewer  │    │   (router)    │    │   Interviewer    │
└───────────────┘    └───────┬───────┘    └──────────────────┘
                             │
                    ┌────────┴────────┐
                    │   Summariser    │
                    │  (wrap-up)      │
                    └─────────────────┘
```

**Triage** is the entry point and fallback. The happy-path flow is sequential: Receptionist → Behavioural Interviewer → Technical Interviewer → Summariser. Each specialist hands off directly to the next agent in sequence. Specialists can fall back to Triage for out-of-order requests.

### The 5 Agents

| Agent | Role | MCP Tools |
|-------|------|-----------|
| **Triage** (`triage`) | Routes messages to the right specialist | None (pure routing) |
| **Receptionist** (`receptionist`) | Creates sessions, collects resume & job description | MarkItDown + InterviewData |
| **Behavioural Interviewer** (`behavioural_interviewer`) | Conducts behavioural questions using STAR method | InterviewData |
| **Technical Interviewer** (`technical_interviewer`) | Conducts technical questions for the role | InterviewData |
| **Summariser** (`summariser`) | Generates comprehensive interview summary | InterviewData |

### How It Works in Code

Each agent is a `ChatClientAgent` with scoped instructions and tools:

```csharp
var triageAgent = new ChatClientAgent(
    chatClient: chatClient,
    name: "triage",
    instructions: "You are the Triage agent. Route messages to the right specialist...");

var receptionistAgent = new ChatClientAgent(
    chatClient: chatClient,
    name: "receptionist",
    instructions: "You are the Receptionist. Set up sessions and collect documents...",
    tools: [.. markitdownTools, .. interviewDataTools]);
```

The handoff workflow uses a **sequential chain** topology with Triage as fallback. Each specialist hands off directly to the next phase (not back to Triage), preventing re-routing loops:

```csharp
var workflow = AgentWorkflowBuilder
    .CreateHandoffBuilderWith(triageAgent)
    .WithHandoffs(triageAgent, [receptionistAgent, behaviouralAgent, technicalAgent, summariserAgent])
    .WithHandoffs(receptionistAgent, [behaviouralAgent, triageAgent])
    .WithHandoffs(behaviouralAgent, [technicalAgent, triageAgent])
    .WithHandoffs(technicalAgent, [summariserAgent, triageAgent])
    .WithHandoff(summariserAgent, triageAgent)
    .Build();

return workflow.SetName(key);
```

**Key APIs:**
- `AgentWorkflowBuilder.CreateHandoffBuilderWith(agent)` — starts a handoff workflow with the given entry agent
- `.WithHandoffs(from, [to1, to2, ...])` — the `from` agent can hand off to any of the `to` agents
- `.WithHandoff(from, to)` — single handoff rule
- `.Build()` — returns a `Workflow`
- `workflow.SetName(key)` — sets the workflow name (custom extension in `WorkflowExtensions.cs`)
- `workflow.AsAIAgent(name)` — converts the workflow into an `AIAgent` for the hosting pipeline

**When to use:** Production scenarios where you want specialized agents with a cloud LLM provider.

---

## Mode 3: Multi-Agent Handoff (GitHub Copilot SDK)

Same 5-agent handoff topology as Mode 2, but each agent is backed by the **GitHub Copilot SDK** instead of a cloud LLM provider.

### Prerequisites

- NuGet package: `GitHub.Copilot.SDK`
- A **GitHub Personal Access Token (PAT)** with Copilot access, **or** authenticated via `gh auth login`

### Setting Up the GitHub Token

Mode 3 requires a GitHub token to authenticate the Copilot SDK. The token is configured via the `GitHubCopilot:Token` setting and passed to the Agent project as the `GITHUB_TOKEN` environment variable.

#### 1. Create a GitHub Personal Access Token

1. Go to [github.com/settings/tokens](https://github.com/settings/tokens)
2. Click **Generate new token (classic)** or **Fine-grained token**
3. Select the **copilot** scope (for classic tokens) or appropriate permissions
4. Copy the generated token

#### 2. Set the Token Value

You have two options:

**Option A: `apphost.settings.json`**

Add the token to `apphost.settings.json`:

```json
{
  "GitHubCopilot": {
    "Token": "ghp_your_token_here"
  }
}
```

> ⚠️ Do not commit this file with a real token. It is listed in `.gitignore`.

**Option B: .NET User Secrets**

```bash
dotnet user-secrets --file ./apphost.cs set "GitHubCopilot:Token" "ghp_your_token_here"
```

### How It Differs from Mode 2

| Aspect | Mode 2 (ChatClient) | Mode 3 (Copilot) |
|--------|---------------------|-------------------|
| Agent creation | `new ChatClientAgent(chatClient, ...)` | `copilotClient.AsAIAgent(...)` |
| LLM backend | Cloud provider (Foundry/Azure OpenAI/GitHub Models) | GitHub Copilot |
| Configuration | Requires LLM provider setup in `apphost.settings.json` | Requires `GitHubCopilot:Token` in config |
| Tool passing | `AITool` instances from MCP clients | Same `AITool` instances |

### How It Works in Code

```csharp
// Create the Copilot client and start it
var copilotClient = new CopilotClient();
await copilotClient.StartAsync();

var triageAgent = copilotClient.AsAIAgent(
    name: "triage",
    instructions: "You are the Triage agent...");

var receptionistAgent = copilotClient.AsAIAgent(
    name: "receptionist",
    instructions: "You are the Receptionist...",
    tools: [.. markitdownTools, .. interviewDataTools]);

// Same sequential-chain handoff workflow as Mode 2
var workflow = AgentWorkflowBuilder
    .CreateHandoffBuilderWith(triageAgent)
    .WithHandoffs(triageAgent, [receptionistAgent, behaviouralAgent, technicalAgent, summariserAgent])
    .WithHandoffs(receptionistAgent, [behaviouralAgent, triageAgent])
    .WithHandoffs(behaviouralAgent, [technicalAgent, triageAgent])
    .WithHandoffs(technicalAgent, [summariserAgent, triageAgent])
    .WithHandoff(summariserAgent, triageAgent)
    .Build();

return workflow.SetName(key);
```

**When to use:** Local development when you have GitHub Copilot access but don't want to configure a cloud LLM provider.

---

## Key Concepts

### Tool Scoping

Each agent only gets the MCP tools it needs:

- **Triage**: No tools (pure routing via handoff)
- **Receptionist**: MarkItDown (document parsing) + InterviewData (session management)
- **Interviewers**: InterviewData only (read/update sessions and transcripts)
- **Summariser**: InterviewData only (read sessions, mark complete)

This follows the principle of least privilege — agents can only access what they need.

### Shared Session State

All agents share the same interview session via the InterviewData MCP server. The session record (resume, job description, transcript) persists in SQLite and is accessible to all agents through MCP tool calls. No agent has direct database access — they all go through the MCP tools.

### The Handoff Pattern vs Agent-as-Tools

| Pattern | Control | Context | Use Case |
|---------|---------|---------|----------|
| **Handoff** | Full transfer — receiving agent owns the conversation | Shared via handoff context | Distinct phases with specialized expertise |
| **Agent-as-Tools** | Central agent retains control, calls others as helpers | Central agent manages context | Helper agents for specific sub-tasks |

This project uses **handoff** because the interview flow has clear phases (intake → behavioural → technical → summary) where each specialist should fully own the conversation during their phase.

## Resources

- [Microsoft Agent Framework — Handoff Orchestration](https://learn.microsoft.com/en-us/agent-framework/workflows/orchestrations/handoff)
- [Microsoft Agent Framework — Workflow Orchestrations](https://learn.microsoft.com/en-us/agent-framework/workflows/orchestrations/)
- [GitHub Copilot Agent Provider](https://learn.microsoft.com/en-us/agent-framework/agents/providers/github-copilot)
- [Agent Framework Samples — Workflows](https://github.com/microsoft/Agent-Framework-Samples/tree/main/07.Workflow)
