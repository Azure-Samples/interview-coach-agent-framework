# LLM Provider Options

The Interview Coach application supports multiple LLM providers through a configuration-based abstraction layer. This allows you to choose the best provider for your scenario without code changes.

## Quick Comparison

| Provider                                      | Best For                                  | Auth       | Cost               |
|-----------------------------------------------|-------------------------------------------|------------|--------------------|
| **[GitHub Models](GITHUB-MODELS.md)**         | Local development and prototyping         | GitHub PAT | Free (with limits) |
| **[Azure OpenAI](AZURE-OPENAI.md)**           | Production deployments                    | API Key    | Pay-per-use        |
| **[Microsoft Foundry](MICROSOFT-FOUNDRY.md)** | Production deployments with Agent Service | API Key    | Pay-per-use        |
| **[GitHub Copilot](../MULTI-AGENT.md#mode-3-multi-agent-handoff-github-copilot-sdk)** | Local development with GitHub Copilot     | GitHub PAT | Free (with limits) |

## When to Use Each Provider

### Microsoft Foundry (Recommended for Production)

**Use when:**

- Deploying to Azure production environments
- Want intelligent model routing for cost optimization
- Need integrated Azure AI services (evaluation, monitoring)
- Building enterprise applications with governance requirements
- Want automatic fallback between models

**Advantages:**

- ✅ **Model Router**: Automatically routes requests to optimal model
- ✅ **Built-in Monitoring**: Integrated with Azure AI Foundry Portal
- ✅ **Enterprise Features**: Content safety, PII detection, evaluation tools
- ✅ **Managed Identity**: No API key management in production
- ✅ **Cost Optimization**: Smart routing minimizes costs

**Learn more:** [MICROSOFT-FOUNDRY.md](MICROSOFT-FOUNDRY.md)

---

### Azure OpenAI

**Use when:**

- Already have Azure OpenAI resource provisioned
- Need specific model/region not available in Foundry
- Want direct control over model selection
- Legacy applications migrating to Agent Framework

**Advantages:**

- ✅ **Model Control**: Fixed model per request
- ✅ **Regional Deployment**: Choose specific Azure regions
- ✅ **Existing Investment**: Use current AOAI subscriptions
- ✅ **Well-Understood**: Familiar to many developers

**Considerations:**

- ⚠️ Requires pre-provisioned deployment
- ⚠️ Manual model management
- ⚠️ No automatic fallback

**Learn more:** [AZURE-OPENAI.md](AZURE-OPENAI.md)

---


## Switching Providers

All providers use the same application code. Switching is as simple as:

1. **Update configuration** (`apphost.settings.json`)
2. **Set credentials** (user secrets or environment variables)
3. **Restart application**

No code changes required!

### Configuration Examples

**Foundry:**

```json
{
  "LlmProvider": "MicrosoftFoundry",
  "MicrosoftFoundry": {
    "Project": {
      "Endpoint": "https://your-project.azure.ai",
      "ApiKey": "{{SECRET}}",
      "DeploymentName": "model-router"
    }
  }
}
```

**Azure OpenAI:**

```json
{
  "LlmProvider": "AzureOpenAI",
  "Azure": {
    "OpenAI": {
      "Endpoint": "https://your-openai.openai.azure.com/",
      "ApiKey": "{{SECRET}}",
      "DeploymentName": "gpt-4o"
    }
  }
}
```

**GitHub Models:**

```json
{
  "LlmProvider": "GitHubModels",
  "GitHub": {
    "Token": "{{SECRET}}",
    "Model": "openai/gpt-4o-mini"
  }
}
```

## Architecture Details

The provider abstraction is implemented in [src/InterviewCoach.AppHost/LlmResourceFactory.cs](../../src/InterviewCoach.AppHost/LlmResourceFactory.cs).

The factory pattern:

1. Reads `LlmProvider` and `AgentMode` from configuration (also supports `--provider` / `--mode` CLI args)
2. Loads provider-specific settings
3. Creates appropriate OpenAI client
4. Registers with dependency injection
5. Sets `AgentMode` and `LlmProvider` environment variables for the agent
6. Agent receives `IChatClient` (provider-agnostic)

This means the agent code is identical regardless of provider:

```csharp
// Agent doesn't know or care which provider it's using
var chatClient = sp.GetRequiredService<IChatClient>();
var agent = new ChatClientAgent(chatClient: chatClient, ...);
```

## Cost Considerations

### Estimated Costs (per 1000 interviews)

| Provider | Configuration | Est. Cost* |
|----------|--------------|-----------|
| GitHub Models | Free tier | $0 (rate-limited) |
| Foundry | model-router | $15-30 (optimized routing) |
| Azure OpenAI | gpt-4o-mini | $20-40 |
| Azure OpenAI | gpt-4o | $100-200 |

*Estimates assume ~5000 tokens per interview. Actual costs vary based on conversation length and model selection.

### Cost Optimization Tips

1. **Use model-router in Foundry** - Automatically uses cheaper models when appropriate
2. **Start with mini models** - gpt-4o-mini is often sufficient for interviews
3. **Monitor token usage** - Use Aspire/Foundry telemetry to track costs
4. **Set max_tokens limits** - Prevent runaway generation
5. **Cache common responses** - For repeated questions

## Performance Comparison

| Provider | Latency (p95) | Throughput | Availability SLA |
|----------|---------------|------------|------------------|
| GitHub Models | 2-5s | Low (rate-limited) | Non-production |
| Foundry | 1-3s | High | 99.9% |
| Azure OpenAI | 1-3s | High | 99.9% |

## Getting Started

Choose your provider and follow the detailed guide:

- 🚀 **[Microsoft Foundry Setup](MICROSOFT-FOUNDRY.md)** (Recommended)
- 🔷 **[Azure OpenAI Setup](AZURE-OPENAI.md)**
- 🐙 **[GitHub Models Setup](GITHUB-MODELS.md)**

---

## FAQ

**Q: Can I use multiple providers simultaneously?**  
A: Not in the current implementation. The application uses one provider at a time based on configuration. However, you could extend `LlmResourceFactory` to support failover logic.

**Q: Which provider has the best quality?**  
A: Quality is comparable across providers when using the same underlying model (e.g., gpt-4o). Foundry's model-router intelligently selects models, often providing the best quality-to-cost ratio.

**Q: Can I use local models (Ollama, LM Studio)?**  
A: Not directly, but you can add support by extending `LlmResourceFactory` with an OpenAI-compatible client pointing to your local endpoint.

**Q: What about OpenAI Platform (not Azure)?**  
A: Currently not supported, but could be added similarly to the existing providers. The `IChatClient` abstraction makes this straightforward.

**Q: Will my data be shared with model providers?**  
A:

- **Foundry/Azure OpenAI**: Data stays in your Azure tenant. Not used for training.
- **GitHub Models**: Subject to GitHub's terms. Not recommended for sensitive data.

---

**Next Steps:**

- 📖 [Main README](../../README.md) - Get started with Foundry
- 🏗️ [Architecture Overview](../ARCHITECTURE.md) - Understand the system
- ❓ [FAQ](../FAQ.md) - Common questions
