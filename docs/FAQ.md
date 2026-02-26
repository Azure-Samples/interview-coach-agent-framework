# Frequently Asked Questions

Common questions about the Interview Coach application and related technologies.

## General Questions

### What is this sample for?

This sample teaches production-ready patterns for building AI agents:

- Microsoft Agent Framework for agent development
- Model Context Protocol (MCP) for extensibility
- .NET Aspire for multi-service orchestration
- Multi-provider LLM support

**[Read learning objectives →](LEARNING-OBJECTIVES.md)**

### Who is this sample for?

- **Developers** building AI agents and want to learn best practices
- **Architects** designing multi-service AI applications
- **.NET developers** exploring Agent Framework and Aspire
- **AI engineers** looking for production deployment patterns

### Can I use this in production?

**Yes**, but consider:

- ✅ The architecture patterns are production-ready
- ✅ Foundry provider is designed for production
- ⚠️ Review security settings (content filters, authentication)
- ⚠️ Scale SQLite to Azure SQL/Cosmos DB for production load
- ⚠️ Implement proper error handling and monitoring

### How is this different from other chatbot samples?

This sample emphasizes:

- **Production patterns** over quick demos
- **Extensibility** through MCP servers
- **Multi-provider** support (not locked to one LLM)
- **Educational content** explaining the "why"
- **Real deployment** with `azd up`

---

## Microsoft Agent Framework

### What is Microsoft Agent Framework?

A .NET library for building AI agents with:

- Structured instructions
- Tool/function calling
- Multi-agent orchestration
- OpenAI-compatible APIs

**[Official docs →](https://aka.ms/agent-framework)**

### How is this different from semantic-kernel or AutoGen?

| Feature | Agent Framework | Semantic Kernel | AutoGen |
|---------|----------------|-----------------|---------|
| Language | .NET | .NET, Python, Java | Python |
| Focus | Production agents | AI orchestration | Multi-agent research |
| Hosting | Web APIs | Embedded | Standalone |
| AGUI Protocol | Yes | No | No |

Agent Framework is optimized for deployable web services.

### Can I use multiple agents?

Yes! The framework supports multi-agent patterns:

- **Handoff orchestration** (sequential chain with specialists)
- **Agent-as-tools** (coordinator calls helpers)
- Single-agent mode for simplicity

Switch between modes via the `AgentMode` setting in `apphost.settings.json`.

**[Multi-agent guide →](MULTI-AGENT.md)**

### What's the AGUI protocol?

The **Agent UI (AGUI) protocol** is a standard for AI agent communication. It enables:

- Consistent interface across different agents
- Tool sharing between implementations
- Framework-agnostic agent development

**[Learn more →](https://docs.ag-ui.com)**

---

## Model Context Protocol (MCP)

### What is MCP and why should I care?

**MCP** is a protocol for connecting AI agents to external tools and data sources.

**Benefits**:

- ✅ Tools are reusable across agents and frameworks
- ✅ Language-agnostic (Python tools in .NET agents)
- ✅ Independent deployment and scaling
- ✅ Easier testing and maintenance

**[Deep dive →](MCP-SERVERS.md)**

### When should I use MCP vs. inline tools?

**Use MCP when**:

- Tool has broad applicability (many agents need it)
- Tool is complex and benefits from isolation
- You want language flexibility
- Multiple teams own different capabilities

**Use inline tools when**:

- Tool is agent-specific and trivial
- Performance is critical (no network hop)
- Rapid prototyping

### Can I use existing MCP servers?

Yes! Check the [MCP Server Registry](https://github.com/modelcontextprotocol/servers) for:

- Database connectors
- API integrations (Slack, GitHub, Jira)
- File system access
- And more...

### How do I build my own MCP server?

**[Follow the tutorial →](TUTORIALS.md#tutorial-2-creating-a-custom-mcp-server)**

Quick overview:

1. Create .NET project
2. Add `ModelContextProtocol.Server` package
3. Implement tools using `[McpServerToolType]` class with `[McpServerTool]` method attributes
4. Register with `AddMcpServer()`
5. Map endpoint with `app.MapMcp("/mcp")`

---

## LLM Providers

### Why is Foundry the recommended provider?

Microsoft Foundry provides:

- **Model Router**: Automatic model selection for cost/quality
- **Enterprise features**: Content safety, monitoring, evaluation
- **Integrated platform**: Single portal for AI services
- **Production SLA**: 99.9% uptime guarantee

**[Foundry setup guide →](providers/MICROSOFT-FOUNDRY.md)**

### Can I use Azure OpenAI instead?

Yes! Configuration change only:

```json
"LlmProvider": "AzureOpenAI"
```

**[Azure OpenAI setup guide →](providers/AZURE-OPENAI.md)**

### Can I use GitHub Models?

Yes, for **development only**:

```json
"LlmProvider": "GitHubModels"
```

**Not recommended for production** due to rate limits.

**[GitHub Models setup guide →](providers/GITHUB-MODELS.md)**

### Can I use OpenAI Platform (not Azure)?

Not currently supported, but adding it is straightforward:

1. Extend `LlmResourceFactory.cs`
2. Add OpenAI client configuration
3. Update configuration schema

### Can I use local models (Ollama, LM Studio)?

Not directly, but you can:

1. Point to OpenAI-compatible endpoint
2. Modify `LlmResourceFactory` to use local URL
3. Ensure model supports function calling

**Limitations**: Local models may not support tools as well as OpenAI models.

### How much does this cost to run?

**Development** (GitHub Models): Free (with rate limits)

**Production** (Foundry, estimated for 1000 interviews):

- model-router: ~$15-30 (optimized routing)
- gpt-4o-mini: ~$20-40
- gpt-4o: ~$100-200

**Azure hosting** (Container Apps, basic tier): ~$30-50/month

**[Provider comparison →](providers/README.md)**

---

## .NET Aspire

### What is .NET Aspire?

A framework for building **cloud-native applications** with:

- Service orchestration and discovery
- Built-in observability (logs, traces, metrics)
- Local dev experience matching production
- Easy Azure deployment via `azd`

**[Official docs →](https://aspire.dev)**

### Do I need Aspire to use Agent Framework?

**No**, but Aspire provides:

- Simplified multi-service development
- Automatic service discovery
- Observability out-of-the-box
- Production deployment patterns

You can run the agent standalone, but you'll need to manually:

- Manage MCP server connections
- Configure service URLs
- Set up monitoring

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

**One command**:

```bash
azd up
```

This provisions all resources and deploys the application.

**[Deployment guide →](../README.md#deploy-to-azure)**

### Can I deploy to AWS or GCP?

Not directly with `azd`, but you can:

- Package as Docker containers
- Deploy to AWS ECS/Fargate or GCP Cloud Run
- Configure service networking manually
- Set environment variables for endpoints

The application is cloud-agnostic; Aspire deployment targets Azure by default.

### How do I set up CI/CD?

Template includes GitHub Actions workflow:

```yaml
# .github/workflows/deploy.yml
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: azd auth login --client-id ${{ secrets.AZURE_CLIENT_ID }}
      - run: azd deploy
```

**[Azure DevOps Pipelines also supported →](https://learn.microsoft.com/azure/developer/azure-developer-cli/azd-in-ci-cd)**

### What about scaling?

**Container Apps auto-scaling**:

- Scales based on HTTP requests
- Min/max replicas configurable
- Scale to zero for cost savings

**Database**: Upgrade SQLite to Azure SQL for production scale.

**MCP Servers**: Each scales independently.

---

## Customization

### How do I change the interview flow?

Edit agent instructions in [src/InterviewCoach.Agent/AgentDelegateFactory.cs](../src/InterviewCoach.Agent/AgentDelegateFactory.cs):

```csharp
instructions: """
    Your custom flow here...
    """
```

**[Tutorial →](TUTORIALS.md#tutorial-3-customizing-the-agent)**

### Can I use this for other domains (not interviews)?

**Absolutely!** Change:

1. **Agent instructions** - Define new domain behavior
2. **MCP servers** - Replace with domain-specific tools
3. **UI** - Adjust prompts and branding

Examples:

- Customer support bot
- Sales assistant
- Educational tutor
- Healthcare intake

### How do I add new capabilities?

**Option 1: MCP Server** (recommended)

- Create new MCP server with tools
- Register in AppHost
- Connect from agent

**Option 2: Inline Tools**

- Define tools directly in agent code
- Use for simple, agent-specific functions

**[MCP tutorial →](TUTORIALS.md#tutorial-2-creating-a-custom-mcp-server)**

### Can I change the UI framework?

Yes, the agent exposes OpenAI-compatible APIs:

- Replace Blazor with React: Call `/conversations` endpoint
- Build mobile app: Use iOS/Android HTTP client
- Desktop app: Electron, WPF, etc.

Agent is UI-agnostic.

---

## Troubleshooting

### Where do I get help?

1. **[Check Troubleshooting Guide →](TROUBLESHOOTING.md)**
2. **[Search Issues](https://github.com/Azure-Samples/interview-coach-agent-framework/issues)**
3. **[Open New Issue](https://github.com/Azure-Samples/interview-coach-agent-framework/issues/new)**
4. **[Stack Overflow](https://stackoverflow.com/questions/tagged/microsoft-agent-framework)** (tag: `microsoft-agent-framework`)

### Common issues?

See **[Troubleshooting Guide](TROUBLESHOOTING.md)** for:

- Connection errors
- Provider configuration
- MCP server issues
- Deployment problems

---

## Contributing

### How can I contribute?

See **[CONTRIBUTING.md](../CONTRIBUTING.md)** for:

- Code contributions
- Documentation improvements
- Bug reports
- Feature requests

### Can I use this sample in my project?

Yes! Licensed under **MIT License**.

You can:

- ✅ Use in commercial projects
- ✅ Modify as needed
- ✅ Distribute modified versions

**Attribution appreciated but not required.**

---

## Learning Resources

### Where should I start?

1. **[Run the sample](../README.md)** - Get it working
2. **[Learning Objectives](LEARNING-OBJECTIVES.md)** - Understand what you'll learn
3. **[Architecture Guide](ARCHITECTURE.md)** - See how it works
4. **[Tutorials](TUTORIALS.md)** - Hands-on practice

### What should I learn next?

After mastering this sample:

- **Agent Framework** - Build multi-agent systems
- **Prompt Flow** - Advanced prompt engineering
- **Foundry Evaluation** - Measure agent quality
- **RAG patterns** - Add knowledge bases
- **Fine-tuning** - Custom model training

---

**Still have questions?** [Open an issue](https://github.com/Azure-Samples/interview-coach-agent-framework/issues/new) and we'll help!
