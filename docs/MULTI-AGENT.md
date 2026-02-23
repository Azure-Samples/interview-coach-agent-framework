# Multi-Agent Architecture

This project demonstrates three approaches to building AI agents with [Microsoft Agent Framework](https://aka.ms/agent-framework). All three modes live in `src/InterviewCoach.Agent/Program.cs` and can be switched with a single line change.

## Overview

| Mode | Approach | Agent Count | LLM Backend | Best For |
|------|----------|-------------|-------------|----------|
| **1** | Single Agent | 1 | Foundry / Azure OpenAI / GitHub Models | Simple deployments, getting started |
| **2** | Multi-Agent Handoff (ChatClient) | 5 | Foundry / Azure OpenAI / GitHub Models | Production multi-agent with cloud LLMs |
| **3** | Multi-Agent Handoff (GitHub Copilot) | 5 | GitHub Copilot SDK | Local development with Copilot |

## How to Switch Modes

Open `src/InterviewCoach.Agent/Program.cs` and find the **Agent Mode Toggle** section. Uncomment exactly one line:

```csharp
// ============================================================================
// AGENT MODE TOGGLE
// Uncomment exactly ONE of the following lines to select the agent mode.
// ============================================================================

builder.AddAIAgent("coach", createAgentDelegate: CreateSingleAgent);              // Mode 1: Single agent
// builder.AddAIAgent("coach", createAgentDelegate: CreateHandoffAgents);         // Mode 2: Multi-agent handoff (ChatClient)
// builder.AddAIAgent("coach", createAgentDelegate: CreateCopilotHandoffAgents);  // Mode 3: Multi-agent handoff (GitHub Copilot)
```

All three modes share the same MCP client setup, hosting pipeline, and API endpoints. No other code changes are needed.

---

## Mode 1: Single Agent

The simplest approach — one `ChatClientAgent` handles the entire interview process.

```
User ←→ Interview Coach Agent ←→ MCP Tools
```

The agent has a comprehensive instruction prompt covering session management, document intake, behavioural questions, technical questions, and summarization. All MCP tools (MarkItDown + InterviewData) are available to the single agent.

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
│  Behavioural  │←──→│    Triage     │←──→│    Technical     │
│  Interviewer  │    │   (router)    │    │   Interviewer    │
└───────────────┘    └───────┬───────┘    └──────────────────┘
                             │
                    ┌────────┴────────┐
                    │   Summariser    │
                    │  (wrap-up)      │
                    └─────────────────┘
```

**Triage** is the hub. All user messages first go to Triage, which routes to the appropriate specialist. Each specialist hands back to Triage when done.

### The 5 Agents

| Agent | Role | MCP Tools |
|-------|------|-----------|
| **Triage** | Routes messages to the right specialist | None (pure routing) |
| **Receptionist** | Creates sessions, collects resume & job description | MarkItDown + InterviewData |
| **Behavioural Interviewer** | Conducts behavioural questions using STAR method | InterviewData |
| **Technical Interviewer** | Conducts technical questions for the role | InterviewData |
| **Summariser** | Generates comprehensive interview summary | InterviewData |

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

The handoff workflow is built using `AgentWorkflowBuilder`:

```csharp
var workflow = AgentWorkflowBuilder
    .CreateHandoffBuilderWith(triageAgent)
    .WithHandoffs(triageAgent, [receptionistAgent, behaviouralAgent, technicalAgent, summariserAgent])
    .WithHandoff(receptionistAgent, triageAgent)
    .WithHandoff(behaviouralAgent, triageAgent)
    .WithHandoff(technicalAgent, triageAgent)
    .WithHandoff(summariserAgent, triageAgent)
    .Build();

return workflow.AsAIAgent(name: "coach");
```

**Key APIs:**
- `AgentWorkflowBuilder.CreateHandoffBuilderWith(agent)` — starts a handoff workflow with the given entry agent
- `.WithHandoffs(from, [to1, to2, ...])` — the `from` agent can hand off to any of the `to` agents
- `.WithHandoff(from, to)` — single handoff rule
- `.Build()` — returns a `Workflow`
- `.AsAIAgent(name)` — converts the workflow into an `AIAgent` that plugs into the hosting pipeline

**When to use:** Production scenarios where you want specialized agents with a cloud LLM provider.

---

## Mode 3: Multi-Agent Handoff (GitHub Copilot SDK)

Same 5-agent handoff topology as Mode 2, but each agent is backed by the **GitHub Copilot SDK** instead of a cloud LLM provider.

### Prerequisites

- [GitHub Copilot CLI](https://github.com/github/copilot-sdk) installed
- Authenticated via `gh auth login`
- NuGet package: `Microsoft.Agents.AI.GitHub.Copilot`

### How It Differs from Mode 2

| Aspect | Mode 2 (ChatClient) | Mode 3 (Copilot) |
|--------|---------------------|-------------------|
| Agent creation | `new ChatClientAgent(chatClient, ...)` | `copilotClient.AsAIAgent(...)` |
| LLM backend | Cloud provider (Foundry/Azure OpenAI/GitHub Models) | GitHub Copilot |
| Configuration | Requires provider setup in Aspire | Requires Copilot CLI + authentication |
| Tool passing | `AITool` instances from MCP clients | Same `AITool` instances |

### How It Works in Code

```csharp
var copilotClient = new CopilotClient();
await copilotClient.StartAsync();

var triageAgent = copilotClient.AsAIAgent(
    name: "triage",
    instructions: "You are the Triage agent...");

var receptionistAgent = copilotClient.AsAIAgent(
    name: "receptionist",
    instructions: "You are the Receptionist...",
    tools: [.. markitdownTools, .. interviewDataTools]);

// Same handoff workflow builder as Mode 2
var workflow = AgentWorkflowBuilder
    .CreateHandoffBuilderWith(triageAgent)
    // ... same handoff rules ...
    .Build();
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
