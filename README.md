# Interview Coach with Microsoft Agent Framework

An AI-powered interview preparation application demonstrating production-ready patterns with [Microsoft Agent Framework](https://aka.ms/agent-framework), Model Context Protocol (MCP) integration, and .NET Aspire orchestration.

## What You'll Learn

This sample teaches modern AI agent development patterns:

- ✅ **Building production AI agents** with Microsoft Agent Framework
- ✅ **Multi-agent handoff orchestration** — single agent vs 5 specialized agents ([learn more](docs/MULTI-AGENT.md))
- ✅ **Model Context Protocol (MCP)** for extensible agent capabilities
- ✅ **Multi-service orchestration** with .NET Aspire
- ✅ **Stateful conversation management** across sessions
- ✅ **Multi-provider LLM support** (Microsoft Foundry, Azure OpenAI, GitHub Models)
- ✅ **Azure deployment** with one command using `azd`

**[Read more about learning objectives →](docs/LEARNING-OBJECTIVES.md)**

## Architecture

![Overall architecture](./assets/architecture.png)

The application uses a **microservices architecture** with:

- **Interview Coach Agent**: Conducts interviews using Microsoft Agent Framework
- **MCP Servers**: Extensible tools for document parsing and session management
- **Web UI**: Blazor-based chat interface
- **.NET Aspire**: Service orchestration and local development
- **Microsoft Foundry**: Production AI service with model-router

**[Explore the architecture in detail →](docs/ARCHITECTURE.md)**

## Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0) or later
- [Visual Studio 2026](https://visualstudio.microsoft.com/downloads/) or [VS Code](http://code.visualstudio.com/download) + [C# Dev Kit](https://marketplace.visualstudio.com/items?itemName=ms-dotnettools.csdevkit)
- [Azure Subscription](http://azure.microsoft.com/free) (free account works)
- [Microsoft Foundry Project](https://ai.azure.com) (create free at ai.azure.com)

**Using a different LLM provider?** See [Provider Setup Guides](docs/providers/README.md) for Azure OpenAI or GitHub Models.

## Getting Started

### 1. Clone Repository

```bash
git clone https://github.com/Azure-Samples/interview-coach-agent-framework.git
cd interview-coach-agent-framework
```

### 2. Configure Microsoft Foundry

#### Create Foundry Project on Foundry Portal

1. Navigate to [Azure AI Foundry Portal](https://ai.azure.com).
2. Sign in with your Azure account.
3. Click **New project** and follow the wizard.
4. Note your **Project Endpoint** and **API Key** from Project Settings.

**[Detailed Foundry setup guide →](docs/providers/MICROSOFT-FOUNDRY.md)**

#### Create Foundry Project with `azd`

1. Navigate to the `resources-foundry` directory.
1. Login to Azure by `azd auth login`.
1. Run `azd up`.
1. Note your **Project Endpoint** and **API Key** from Project Settings.

#### Store Credentials

Use .NET user secrets to keep credentials secure:

```bash
dotnet user-secrets --file ./apphost.cs set MicrosoftFoundry:Project:Endpoint "{{MICROSOFT_FOUNDRY_PROJECT_ENDPOINT}}"
dotnet user-secrets --file ./apphost.cs set MicrosoftFoundry:Project:ApiKey "{{MICROSOFT_FOUNDRY_API_KEY}}"
```

#### Verify Configuration

Ensure `apphost.settings.json` contains:

```json
{
  "AgentMode": "Single",
  "LlmProvider": "MicrosoftFoundry",
  "MicrosoftFoundry": {
    "Project": {
      "Endpoint": "{{MICROSOFT_FOUNDRY_PROJECT_ENDPOINT}}",
      "ApiKey": "{{MICROSOFT_FOUNDRY_PROJECT_API_KEY}}",
      // "DeploymentName": "model-router"
      "DeploymentName": "gpt-5-mini"
    }
  }
}
```

<!-- The `model-router` automatically selects optimal models for cost/quality balance. **[Learn about Model Router →](https://learn.microsoft.com/azure/ai-foundry/openai/concepts/model-router)** -->

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

## Deploy to Azure

Deploy the entire application to Azure Container Apps with one command:

```bash
# Login to Azure
azd auth login

# Provision resources and deploy
azd up
```

This will:

- ✅ Create Azure Container Apps Environment
- ✅ Deploy all services as containers
- ✅ Configure Foundry connection with Managed Identity
- ✅ Set up observability (Application Insights, Log Analytics)
- ✅ Output public URL for your application

**Deployment details:** The `azd up` command reads `azure.yaml` and provisions infrastructure defined in the `infra/` directory.

### Clean Up Resources

When finished, remove all Azure resources:

```bash
azd down --force --purge
```

## Understanding This Sample

### What Makes This Sample Valuable?

This isn't just a chatbot—it's a **reference implementation** of production patterns:

1. **MCP Architecture**: Learn how to extend agents without modifying code
2. **Aspire Orchestration**: Multi-service development with production parity
3. **Provider Abstraction**: Switch between Foundry, Azure OpenAI, or GitHub Models via configuration
4. **Stateful Sessions**: Manage conversational context across interactions
5. **Tool Integration**: Give agents capabilities through function calling

**[Deep dive into learning objectives →](docs/LEARNING-OBJECTIVES.md)**

### Key Code Locations

| What | Where | Why It Matters |
|------|-------|----------------|
| Agent Configuration | [src/InterviewCoach.Agent/AgentDelegateFactory.cs](src/InterviewCoach.Agent/AgentDelegateFactory.cs) | Defines agent behavior, instructions, and multi-agent modes |
| MCP Integration | [src/InterviewCoach.Agent/Program.cs](src/InterviewCoach.Agent/Program.cs) | Shows how to connect external MCP tools |
| Provider Factory | [src/InterviewCoach.AppHost/LlmResourceFactory.cs](src/InterviewCoach.AppHost/LlmResourceFactory.cs) | Demonstrates multi-provider abstraction |
| Service Orchestration | [src/InterviewCoach.AppHost/AppHost.cs](src/InterviewCoach.AppHost/AppHost.cs) | Aspire dependency management |
| Custom MCP Server | [src/InterviewCoach.Mcp.InterviewData/](src/InterviewCoach.Mcp.InterviewData/) | Build your own MCP tools |

**[Explore architecture details →](docs/ARCHITECTURE.md)**

### Real-World Applications

These patterns apply to:

- 🎯 Customer service automation
- 🔧 Technical support agents
- 📚 Educational tutoring systems
- 🏥 Healthcare intake interviews
- 💼 Sales assistant bots
- 🔬 Research assistants

## Next Steps

### 📖 Learn

- **[User Manual](docs/USER-MANUAL.md)** - Step-by-step guide to using the app once it's running
- **[Learning Objectives](docs/LEARNING-OBJECTIVES.md)** - What you'll master by studying this sample
- **[Architecture Guide](docs/ARCHITECTURE.md)** - Deep dive into system design
- **[MCP Servers Explained](docs/MCP-SERVERS.md)** - Understanding extensibility patterns
- **[Tutorials](docs/TUTORIALS.md)** - Hands-on customization exercises

### 🔧 Customize

- **[Tutorial 1: Understanding Interview Flow](docs/TUTORIALS.md#tutorial-1-understanding-the-interview-flow)** - Trace agent behavior
- **[Tutorial 2: Creating Custom MCP Server](docs/TUTORIALS.md#tutorial-2-creating-a-custom-mcp-server)** - Build your own tools
- **[Tutorial 3: Customizing the Agent](docs/TUTORIALS.md#tutorial-3-customizing-the-agent)** - Modify interview behavior
- **[FAQ](docs/FAQ.md)** - Common questions answered

### 🔄 Alternative Providers

This sample defaults to Microsoft Foundry (recommended for production), but also supports:

- **[Azure OpenAI](docs/providers/AZURE-OPENAI.md)** - Direct AOAI integration
- **[GitHub Models](docs/providers/GITHUB-MODELS.md)** - Free tier for prototyping

**[Compare providers →](docs/providers/README.md)**

## Additional Resources

### Microsoft Foundry

- [What is Microsoft Foundry?](https://learn.microsoft.com/azure/ai-foundry/what-is-foundry)
- [Foundry Agent Service](https://learn.microsoft.com/azure/ai-foundry/agents/overview)
- [Model Router Deep Dive](https://learn.microsoft.com/azure/ai-foundry/openai/concepts/model-router)

### Microsoft Agent Framework

- [Framework Documentation](https://aka.ms/agent-framework)
- [Multi-Agent Orchestration](https://learn.microsoft.com/agent-framework/user-guide/workflows/orchestrations/overview)
- [AG-UI Protocol](https://docs.ag-ui.com/introduction)

### Model Context Protocol

- [MarkItDown MCP Server](https://github.com/microsoft/markitdown/tree/main/packages/markitdown-mcp) (used in this sample)
- [MCP Specification](https://modelcontextprotocol.io)
- [MCP Server Registry](https://github.com/modelcontextprotocol/servers)

### .NET Aspire

- [Aspire Documentation](https://aspire.dev)
- [Service Discovery](https://learn.microsoft.com/dotnet/aspire/service-discovery/overview)
- [Deployment with azd](https://learn.microsoft.com/dotnet/aspire/deployment/azure/aca-deployment)

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

This project is licensed under the MIT License - see [LICENSE.md](LICENSE.md) for details.

---

**Built with ❤️ by the Azure Samples team** | **Questions?** Check the [FAQ](docs/FAQ.md) or open an issue
