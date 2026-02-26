# Interview Coach with Microsoft Agent Framework

An AI-powered interview preparation application demonstrating production-ready patterns with [Microsoft Agent Framework](https://aka.ms/agent-framework), [Model Context Protocol (MCP)](https://modelcontextprotocol.io) integration, and [Aspire](https://aspire.dev) orchestration.

## What You'll Learn

This sample teaches modern AI agent development patterns:

- ✅ **Building production-ready AI agents** with Microsoft Agent Framework
- ✅ **Multi-agent handoff orchestration** — single agent vs 5 specialized agents ([learn more](docs/MULTI-AGENT.md))
- ✅ **Model Context Protocol (MCP)** for extensible agent capabilities
- ✅ **Multi-service orchestration** with Aspire
- ✅ **Stateful conversation management** across sessions
- ✅ **Multi-provider LLM support** (Microsoft Foundry, Azure OpenAI, GitHub Models and GitHub Copilot)
- ✅ **Azure deployment** with one command using `azd`

**[Read more about learning objectives →](docs/LEARNING-OBJECTIVES.md)**

## Architecture

![Overall architecture](./assets/architecture.png)

The application uses a **microservices architecture** with:

- **Aspire**: Cloud-native container orchestration
- **Frontend Web UI**: Blazor-based chat interface
- **Backend Agent**: Multi-agent orchestration using Microsoft Agent Framework
- **MCP Servers**: Tools for document parsing and session management
- **Microsoft Foundry**: Production-ready AI service with Azure OpenAI

**[Explore the architecture in detail →](docs/ARCHITECTURE.md)**

## Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0) or later
- [Visual Studio 2026](https://visualstudio.microsoft.com/downloads/) or [VS Code](https://code.visualstudio.com/download) + [C# Dev Kit](https://marketplace.visualstudio.com/items?itemName=ms-dotnettools.csdevkit)
- [Azure Subscription](https://azure.microsoft.com/free)
- [Microsoft Foundry](https://ai.azure.com)

**[Explore the different LLM provider →](docs/providers/README.md)**

## Getting Started

### 1. Clone Repository

```bash
git clone https://github.com/Azure-Samples/interview-coach-agent-framework.git
cd interview-coach-agent-framework
```

### 2. Configure Microsoft Foundry

1. Create a new Microsoft Foundry project on Foundry Portal or command line.

   **[Detailed Foundry setup guide →](docs/providers/MICROSOFT-FOUNDRY.md)**

### 3. Store Credentials

Use .NET user secrets to keep credentials secure:

```bash
dotnet user-secrets --file ./apphost.cs set MicrosoftFoundry:Project:Endpoint "{{MICROSOFT_FOUNDRY_PROJECT_ENDPOINT}}"
dotnet user-secrets --file ./apphost.cs set MicrosoftFoundry:Project:ApiKey "{{MICROSOFT_FOUNDRY_API_KEY}}"
```

### 4. Run the Application

Start all services with .NET Aspire:

```bash
aspire run --file ./apphost.cs
```

**What happens next:**

1. Open Aspire Dashboard (URL shown in terminal output).
1. All services start (Agent, WebUI, MCP servers, SQLite).
1. Look for ✅ "Running" status on all resources.
1. Click the **webui** endpoint to open the interview coach.

**Having issues?** See [Troubleshooting Guide](docs/TROUBLESHOOTING.md)

### 5. Deploy to Azure

Deploy the entire application to Azure Container Apps with one command:

```bash
# Login to Azure
azd auth login

# Provision resources and deploy
azd up
```

### 6. Clean Up Resources

When finished, remove all Azure resources:

```bash
azd down --force --purge
```
## Next Steps

### Learn

- **[Learning Objectives](docs/LEARNING-OBJECTIVES.md)**: Understand what you'll learn
- **[Architecture Overview](docs/ARCHITECTURE.md)**: Deep dive into system design
- **[Tutorials](docs/TUTORIALS.md)**: Hands-on learning exercises
- **[FAQ](docs/FAQ.md)**: Common questions answered

### Alternative LLM Providers

This sample defaults to Microsoft Foundry (recommended for production), but also supports:

- **[Azure OpenAI](docs/providers/AZURE-OPENAI.md)** - Direct AOAI integration
- **[GitHub Models](docs/providers/GITHUB-MODELS.md)** - Free tier for prototyping
- **[GitHub Copilot](docs/providers/GITHUB-COPILOT.md)** - GitHub Copilot as agent

## Additional Resources

### Microsoft Foundry

- [What is Microsoft Foundry?](https://learn.microsoft.com/azure/ai-foundry/what-is-foundry?view=foundry)
- [Foundry Agent Service](https://learn.microsoft.com/azure/ai-foundry/agents/overview?view=foundry)

### Microsoft Agent Framework

- [Framework Documentation](https://aka.ms/agent-framework)
- [Multi-Agent Orchestration](https://learn.microsoft.com/agent-framework/user-guide/workflows/orchestrations/overview)
- [AG-UI Protocol](https://docs.ag-ui.com/introduction)

### Model Context Protocol

- [MarkItDown MCP Server](https://github.com/microsoft/markitdown/tree/main/packages/markitdown-mcp)
- [MCP Specification](https://modelcontextprotocol.io)
- [MCP Server Registry](https://github.com/modelcontextprotocol/servers)

### Aspire

- [Aspire Documentation](https://aspire.dev)
- [Integrations](https://aspire.dev/integrations/overview/)
- [Deployment](https://aspire.dev/deployment/overview/)

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](docs/CONTRIBUTING.md) for guidelines.

## License

This project is licensed under the MIT License - see [LICENSE.md](LICENSE.md) for details.

---

**Built with ❤️ by the CoreAI DevRel** | **Questions?** Check the [FAQ](docs/FAQ.md) or open an [issue](../../issue).
