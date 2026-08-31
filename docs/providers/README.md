# LLM provider options

The app supports multiple LLM backends. Pick one in config and go — no code changes.

## Quick comparison

| Provider                                      | Best for                                      | Authentication | Billing |
|-----------------------------------------------|-----------------------------------------------|----------------|---------|
| **[Microsoft Foundry](MICROSOFT-FOUNDRY.md)** | Azure deployments with managed identity       | Azure RBAC     | Azure consumption |
| **[GitHub Copilot](GITHUB-COPILOT.md)**       | Running without an Azure model deployment     | GitHub token   | Copilot plan usage |

## Getting started

Pick a provider and follow the guide:

- [Microsoft Foundry](MICROSOFT-FOUNDRY.md) (recommended)
- [GitHub Copilot](GITHUB-COPILOT.md)

## Switching providers

All providers use the same code. To switch:

1. Update configuration (`apphost.settings.json`)
2. Authenticate with Azure or configure the GitHub token
3. Restart

### Configuration examples

**Microsoft Foundry:**

```json
{
  "LlmProvider": "MicrosoftFoundry",

  "MicrosoftFoundry": {
    "DeploymentName": "gpt-5-mini",
    "ModelVersion": "2025-08-07",
    "ModelFormat": "OpenAI"
  }
}
```

**GitHub Copilot:**

```json
{
  "AgentMode": "HandOff",

  "LlmProvider": "GitHubCopilot",

  "GitHubCopilot": {
    "Model": "gpt-5-mini"
  }
}
```

If `Model` is omitted, the app still uses `gpt-5-mini`.

### Command-line examples

You can also pass the provider as a flag instead of editing config:

**Microsoft Foundry:**

```bash
aspire start --apphost ./apphost.cs -- --provider MicrosoftFoundry
```

**GitHub Copilot:**

```bash
aspire start --apphost ./apphost.cs -- --provider GitHubCopilot --mode HandOff
```

## Next steps

- [Learning objectives](../LEARNING-OBJECTIVES.md)
- [Architecture overview](../ARCHITECTURE.md)
- [Tutorials](../TUTORIALS.md)
- [FAQ](../FAQ.md)
