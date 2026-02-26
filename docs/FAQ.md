# Frequently asked questions

## General

### What is this sample for?

It teaches patterns for building AI agents with:

- Microsoft Agent Framework for agent logic
- MCP for tool extensibility
- .NET Aspire for multi-service orchestration
- Multiple LLM provider support

See [learning objectives](LEARNING-OBJECTIVES.md).

### Who is this for?

- .NET developers building AI agents
- Architects designing multi-service AI apps
- Anyone exploring Agent Framework or Aspire
- Engineers looking at deployment patterns for agent systems

### Can I use this in production?

The architecture patterns are solid for production. A few things to think about first:

- Review security settings (content filters, authentication)
- SQLite won't scale forever — plan for Azure SQL or Cosmos DB under load
- Add proper error handling and monitoring for your use case

### How is this different from other chatbot samples?

It goes further than a demo:

- Extensible via MCP (not hard-coded tools)
- Works with multiple LLM providers
- Explains the reasoning behind design choices
- Actually deploys to Azure with `azd up`

---

## Microsoft Agent Framework

### What is Microsoft Agent Framework?

A .NET library for building AI agents. Gives you structured instructions, tool calling, multi-agent orchestration, and OpenAI-compatible APIs.

[Official docs](https://aka.ms/agent-framework)

### How is this different from Semantic Kernel or AutoGen?

| Feature | Agent Framework | Semantic Kernel | AutoGen |
|---------|----------------|-----------------|---------|
| Language | .NET, Python | .NET, Python, Java | Python |
| Focus | Production agents | AI orchestration | Multi-agent research |
| Hosting | Web APIs | Embedded | Standalone |
| AG-UI Protocol | Yes | No | No |

Agent Framework is optimized for deployable web services. Semantic Kernel is more of a general orchestration library. AutoGen focuses on multi-agent research.

### Can I use multiple agents?

Yes. The framework supports handoff orchestration (sequential chain with specialists), agent-as-tools (coordinator calls helpers), and single-agent mode.

Switch between them with the `AgentMode` setting in `apphost.settings.json`.

See [multi-agent guide](MULTI-AGENT.md).

### What's the AG-UI protocol?

A standard for agent-to-UI communication. It means you can swap frontends or agent implementations without rewiring everything.

[Learn more](https://docs.ag-ui.com)

---

## Model Context Protocol (MCP)

### What is MCP and why use it?

MCP is a protocol for connecting AI agents to external tools and data sources. Tools become reusable across agents and frameworks, language-agnostic (Python tools in .NET agents), and independently deployable.

### When should I use MCP vs. inline tools?

Use MCP when the tool is complex, reusable, or owned by a different team. Use inline tools for trivial, agent-specific functions or when you need to avoid the network hop.

### Can I use existing MCP servers?

Yes. The [MCP Server Registry](https://github.com/modelcontextprotocol/servers) has database connectors, API integrations (Slack, GitHub, Jira), file system access, and more.

### How do I build my own MCP server?

See [Tutorial 2](TUTORIALS.md#tutorial-2-creating-a-custom-mcp-server). Short version: create a .NET project, add `ModelContextProtocol.Server`, implement tools with `[McpServerTool]` attributes, and map the `/mcp` endpoint.

---

## LLM providers

### Why is Foundry the recommended provider?

It bundles model routing (automatic model selection for cost/quality), content safety, monitoring, and evaluation into one platform. It also has a 99.9% uptime SLA.

See [Foundry setup](providers/MICROSOFT-FOUNDRY.md).

### Can I use Azure OpenAI instead?

Yes, just change the config:

```json
"LlmProvider": "AzureOpenAI"
```

See [Azure OpenAI setup](providers/AZURE-OPENAI.md).

### Can I use GitHub Models?

For development, yes:

```json
"LlmProvider": "GitHubModels"
```

Rate limits make it unsuitable for production.

See [GitHub Models setup](providers/GITHUB-MODELS.md).

### Can I use OpenAI Platform (not Azure)?

Not currently supported, but adding it is straightforward:

1. Extend `LlmResourceFactory.cs`
2. Add OpenAI client configuration
3. Update configuration schema

### Can I use local models (Ollama, LM Studio)?

Not directly. You could point to an OpenAI-compatible endpoint by modifying `LlmResourceFactory`, but local models often have weak tool-calling support.

---

## Aspire

### What is Aspire?

A .NET framework for building cloud-native apps. Handles service orchestration, discovery, observability (logs, traces, metrics), and deployment to Azure.

[Official docs](https://aspire.dev)

### Do I need Aspire to use Agent Framework?

No. Aspire makes multi-service dev easier (service discovery, observability), but you can run the agent standalone. You'd just need to manage MCP connections, service URLs, and monitoring yourself.

### Can I deploy without Aspire/azd?

Yes, deploy containers directly:

```bash
docker compose up  # Local development

# Or deploy to Azure manually
az containerapp create ...
```

But you'll lose Aspire's benefits (service discovery, observability).

---

## Deployment

### How do I deploy to Azure?

```bash
azd up
```

That's it. See the [README](../README.md#5-deploy-to-azure).

### Can I deploy to AWS or GCP?

Not with `azd`, but the app is just containers. You could deploy to ECS/Fargate or Cloud Run — you'd configure networking and environment variables manually.

### What about scaling?

Container Apps auto-scales on HTTP request count (including scale-to-zero). For storage, swap SQLite for Azure SQL. MCP servers scale independently.

---

## Customization

### How do I change the interview flow?

Edit the agent instructions in [AgentDelegateFactory.cs](../src/InterviewCoach.Agent/AgentDelegateFactory.cs). See [Tutorial 3](TUTORIALS.md#tutorial-3-customizing-the-agent).

### Can I use this for other domains?

Yes. Change the agent instructions, swap in domain-specific MCP servers, and adjust the UI. The same patterns work for support bots, sales assistants, tutors, or intake forms.

### How do I add new capabilities?

Preferred: create a new MCP server with tools, register it in AppHost, and connect it from the agent. For trivial agent-specific functions, define them inline.

See [Tutorial 2](TUTORIALS.md#tutorial-2-creating-a-custom-mcp-server).

### Can I change the UI framework?

Yes. The agent exposes standard APIs, so you can replace Blazor with React, build a mobile app, or use Electron. The agent doesn't care about the frontend.

---

## Troubleshooting

### Where do I get help?

2. **[Search Issues](https://github.com/Azure-Samples/interview-coach-agent-framework/issues)**
3. **[Open New Issue](https://github.com/Azure-Samples/interview-coach-agent-framework/issues/new)**
4. **[Stack Overflow](https://stackoverflow.com/questions/tagged/microsoft-agent-framework)** (tag: `microsoft-agent-framework`)

---

## Contributing

### How can I contribute?

See [CONTRIBUTING.md](./CONTRIBUTING.md).

### Can I use this in my project?

Yes, MIT licensed. Use it, modify it, ship it. Attribution is appreciated but not required.

---

## Learning resources

### Where should I start?

1. [Run the sample](../README.md)
2. [Learning objectives](LEARNING-OBJECTIVES.md)
3. [Architecture overview](ARCHITECTURE.md)
4. [Tutorials](TUTORIALS.md)

---

Still stuck? [Open an issue](https://github.com/Azure-Samples/interview-coach-agent-framework/issues/new).
