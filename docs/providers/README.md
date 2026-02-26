# LLM provider options

The app supports multiple LLM backends. Pick one in config and go — no code changes.

## Quick comparison

| Provider                                      | Best For                                  | Auth       | Cost               |
|-----------------------------------------------|-------------------------------------------|------------|--------------------|
| **[Microsoft Foundry](MICROSOFT-FOUNDRY.md)** | Production deployments with Agent Service | API Key    | Pay-per-use        |
| **[Azure OpenAI](AZURE-OPENAI.md)**           | Production deployments                    | API Key    | Pay-per-use        |
| **[GitHub Models](GITHUB-MODELS.md)**         | Local development and prototyping         | GitHub PAT | Free (with limits) |

## Getting started

Pick a provider and follow the guide:

- [Microsoft Foundry](MICROSOFT-FOUNDRY.md) (recommended)
- [Azure OpenAI](AZURE-OPENAI.md)
- [GitHub Models](GITHUB-MODELS.md)

## Switching providers

All providers use the same code. To switch:

1. Update configuration (`apphost.settings.json`)
2. Set credentials (user secrets or environment variables)
3. Restart

### Configuration examples

**Microsoft Foundry:**

```json
{
  "LlmProvider": "MicrosoftFoundry",

  "MicrosoftFoundry": {
    "Project": {
      "Endpoint": "{{MICROSOFT_FOUNDRY_PROJECT_ENDPOINT}}",
      "ApiKey": "{{MICROSOFT_FOUNDRY_API_KEY}}",
      "DeploymentName": "gpt-5-mini"
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
      "Endpoint": "{{AZURE_OPENAI_ENDPOINT}}",
      "ApiKey": "{{AZURE_OPENAI_API_KEY}}",
      "DeploymentName": "gpt-5-mini"
    }
  }
}
```

**GitHub Models:**

```json
{
  "LlmProvider": "GitHubModels",

  "GitHub": {
    "Token": "{{GITHUB_PAT}}",
    "Model": "openai/gpt-5-mini"
  }
}
```

### Command-line examples

You can also pass the provider as a flag instead of editing config:

**Microsoft Foundry:**

```bash
aspire run --file ./apphost.cs -- --provider MicrosoftFoundry
```

**Azure OpenAI:**

```bash
aspire run --file ./apphost.cs -- --provider AzureOpenAI
```

**GitHub Models:**

```bash
aspire run --file ./apphost.cs -- --provider GitHubModels
```

## Next steps

- [Learning objectives](../LEARNING-OBJECTIVES.md)
- [Architecture overview](../ARCHITECTURE.md)
- [Tutorials](../TUTORIALS.md)
- [FAQ](../FAQ.md)
