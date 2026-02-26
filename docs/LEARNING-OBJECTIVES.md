# Learning Objectives

This sample demonstrates production-ready patterns for building AI agents with [Microsoft Agent Framework](https://aka.ms/agent-framework). Whether you're new to AI development or experienced with chatbots, this application teaches modern architectural patterns that scale from prototype to production.

## What This Sample Teaches

### 1. Building Production AI Agents

Learn how to create AI agents using [Microsoft Agent Framework](https://aka.ms/agent-framework) with:

- Structured instruction design for consistent agent behavior
- Tool/function calling patterns for extending agent capabilities
- Stateful conversation management across sessions
- Error handling and graceful degradation

**See it in action**: [src/InterviewCoach.Agent/AgentDelegateFactory.cs](../src/InterviewCoach.Agent/AgentDelegateFactory.cs) contains the complete agent instructions, tool registration, and multi-agent mode selection.

### 2. Model Context Protocol (MCP) Integration

Understand how MCP servers provide modular, reusable capabilities:

- Separating agent logic from tool implementation
- Creating language-agnostic tool interfaces
- Enabling tool reuse across different agents and applications
- Building custom MCP servers for domain-specific needs

**Example implementations:**

- [MarkItDown MCP](https://github.com/microsoft/markitdown/tree/main/packages/markitdown-mcp) - External document parsing
- [InterviewData MCP](../src/InterviewCoach.Mcp.InterviewData/) - Custom session management server

### 3. Cloud-Native Container Orchestration with Aspire

Master service orchestration patterns:

- Coordinating multiple services (agent, UI, MCP servers, databases)
- Managing dependencies and startup order
- Local development with production parity
- Environment-specific configuration

**See it in action**: [src/InterviewCoach.AppHost/AppHost.cs](../src/InterviewCoach.AppHost/AppHost.cs) orchestrates all components.

### 4. Multi-Provider LLM Integration

Implement provider abstraction for flexibility:

- Single codebase supporting multiple LLM providers
- Runtime provider selection via configuration
- Environment-specific provider strategies (dev vs. prod)
- Avoiding vendor lock-in

**See it in action**: [src/InterviewCoach.AppHost/LlmResourceFactory.cs](../src/InterviewCoach.AppHost/LlmResourceFactory.cs)

### 5. Stateful Conversation Management

Build agents that maintain context across sessions:

- Persistent session storage with SQLite
- Resume/job description attachment handling
- Conversation transcript recording
- Multi-turn interview flow management

**See it in action**: [src/InterviewCoach.Mcp.InterviewData/InterviewSessionRepository.cs](../src/InterviewCoach.Mcp.InterviewData/InterviewSessionRepository.cs)

### 6. Agent Instruction Engineering

Craft effective agent instructions:

- Clear role definition and boundaries
- Step-by-step process guidelines
- Tool usage instructions
- Tone and personality specification

**Best practices example:** The interview coach agent instructions demonstrate progressive disclosure (behavioral → technical questions), user control (stopping mid-interview), and structured output (summaries).

## Why These Patterns Matter

### 1. Extensibility Without Modification

MCP servers let you add capabilities (email, calendar, document processing) without touching agent code. This follows the Open-Closed Principle and enables teams to work independently on tools and agents.

### 2. Provider Flexibility

The multi-provider pattern means you can:

- Use GitHub Models for rapid prototyping (free)
- Switch to Azure OpenAI for enterprise features
- Deploy to Foundry for integrated Azure AI services
- All without rewriting application logic

### 3. Production-Ready Architecture

Aspire orchestration provides:

- Service discovery and health checks
- Observability with OpenTelemetry built-in
- Configuration management across environments
- Seamless Azure deployment with `azd`

### 4. Separation of Concerns

Each component has a single responsibility:

- **WebUI**: User interface and interaction
- **Agent**: Interview orchestration and conversation management
- **MCP Servers**: Specific capabilities (document parsing, data storage)
- **Aspire**: Service orchestration and configuration

This makes the codebase maintainable, testable, and easy to extend.

## Skills You'll Gain

By studying and modifying this sample, you'll develop expertise in:

✅ **Microsoft Agent Framework**: Building production AI agents  
✅ **Model Context Protocol**: Creating and integrating MCP servers  
✅ **Aspire**: Cloud-native container orchestration architecture  
✅ **Agent Instruction Design**: Crafting effective AI behaviors  
✅ **Tool/Function Calling**: Extending agents with capabilities  
✅ **State Management**: Handling conversational context  
✅ **Azure Deployment**: Production deployment with `azd`  
✅ **Provider Abstraction**: Multi-vendor LLM integration  

## Learning Path

We recommend this progression:

1. **Run the sample**: Get it working to understand the end-to-end flow
2. **Read [architecture overview](ARCHITECTURE.md)**: Understand the system design
3. **Study the agent instructions**: See how behavior is defined
5. **Follow [tutorials](TUTORIALS.md)**: Hands-on modifications
6. **Build your own**: Apply patterns to your domain

## Next Steps

- **[Architecture Overview](ARCHITECTURE.md)**: Deep dive into system design
- **[Tutorials](TUTORIALS.md)**: Hands-on learning exercises
- **[FAQ](FAQ.md)**: Common questions answered
