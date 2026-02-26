# Learning objectives

What this sample actually teaches, and where to find each pattern in the code.

## What this sample covers

### 1. Building agents with Microsoft Agent Framework

How to set up an AI agent with structured instructions, tool calling, session state, and error handling.

The agent definition lives in [AgentDelegateFactory.cs](../src/InterviewCoach.Agent/AgentDelegateFactory.cs) — instructions, tool registration, and multi-agent mode selection are all there.

### 2. Model Context Protocol (MCP)

MCP lets you break tool implementations out of the agent into separate servers. Tools become reusable, language-agnostic, and independently deployable.

Two examples in this repo:

- [MarkItDown MCP](https://github.com/microsoft/markitdown/tree/main/packages/markitdown-mcp) — external Python server for document parsing
- [InterviewData MCP](../src/InterviewCoach.Mcp.InterviewData/) — custom .NET server for session management

### 3. Service orchestration with Aspire

Coordinating multiple services (agent, UI, MCP servers, database) with dependency ordering, service discovery, and config management. Local dev that looks like production.

See [AppHost.cs](../src/InterviewCoach.AppHost/AppHost.cs) for the service topology.

### 4. Multi-provider LLM support

One codebase, multiple LLM backends. Pick a provider in config and go — no code changes. Use GitHub Models while prototyping, then switch to Foundry or Azure OpenAI for production.

The abstraction is in [LlmResourceFactory.cs](../src/InterviewCoach.AppHost/LlmResourceFactory.cs).

### 5. Stateful conversations

Sessions persist to SQLite. Resume text, job descriptions, and transcripts survive across turns. Users can pause and pick up later.

See [InterviewSessionRepository.cs](../src/InterviewCoach.Mcp.InterviewData/InterviewSessionRepository.cs).

### 6. Instruction engineering

Writing agent prompts that actually work: defining the role, setting boundaries, specifying step-by-step process, describing tool usage, and setting tone.

The interview coach instructions show progressive disclosure (behavioral then technical), user control (stop anytime), and structured output (summaries).

## Why these patterns are worth learning

**You can add tools without modifying the agent.** MCP servers mean you can bolt on new capabilities (email, calendar, whatever) independently. Teams can work on tools and agents in parallel.

**You can swap providers without rewriting anything.** Prototype on GitHub Models for free, ship on Azure OpenAI or Foundry. The `IChatClient` interface makes the switch a config change.

**You get observability for free.** Aspire gives you service discovery, health checks, distributed tracing, and structured logging out of the box. Deploying to Azure Container Apps with `azd` is one command.

**Each piece does one thing.** The agent handles conversation logic. MCP servers handle tools. The UI handles rendering. Aspire handles wiring. This makes it easier to test, replace, and extend individual parts.

## What you'll walk away with

After working through this sample:

- Microsoft Agent Framework — building and deploying agents
- MCP — creating and consuming MCP servers
- Aspire — orchestrating multi-service apps
- Instruction design — writing prompts that produce consistent behavior
- Tool/function calling — giving agents abilities beyond text generation
- State management — persisting context across conversation turns
- Azure deployment — shipping with `azd`
- Provider abstraction — avoiding LLM vendor lock-in

## Suggested order

1. Run the sample and go through a full interview
2. Read the [architecture overview](ARCHITECTURE.md)
3. Look at the agent instructions in `AgentDelegateFactory.cs`
4. Work through the [tutorials](TUTORIALS.md)
5. Start adapting the patterns for your own use case

## Next steps

- [Architecture overview](ARCHITECTURE.md)
- [Tutorials](TUTORIALS.md)
- [FAQ](FAQ.md)
