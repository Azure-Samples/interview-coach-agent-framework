# LLM Provider Options

The Interview Coach application supports multiple LLM providers through a configuration-based abstraction layer. This allows you to choose the best provider for your scenario without code changes.

## Quick Comparison

| Provider                                      | Best For                                  | Auth       | Cost               |
|-----------------------------------------------|-------------------------------------------|------------|--------------------|
| **[Microsoft Foundry](MICROSOFT-FOUNDRY.md)** | Production deployments with Agent Service | API Key    | Pay-per-use        |
| **[Azure OpenAI](AZURE-OPENAI.md)**           | Production deployments                    | API Key    | Pay-per-use        |
| **[GitHub Models](GITHUB-MODELS.md)**         | Local development and prototyping         | GitHub PAT | Free (with limits) |

## Getting Started

Choose your provider and follow the detailed guide:

- **[Microsoft Foundry Setup](MICROSOFT-FOUNDRY.md)** (Recommended)
- **[Azure OpenAI Setup](AZURE-OPENAI.md)**
- **[GitHub Models Setup](GITHUB-MODELS.md)**

## Switching Providers

All providers use the same application code. Switching is as simple as:

1. **Update configuration** (`apphost.settings.json`)
2. **Set credentials** (user secrets or environment variables)
3. **Restart application**

No code changes required!

### Configuration Examples

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

### Command-Line Parameter Examples

Instead of changing `apphost.settings.json`, pass the provider parameter when running the app.

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

## Next Steps

- **[Learning Objectives](LEARNING-OBJECTIVES.md)**: Understand what you'll learn
- **[Architecture Overview](ARCHITECTURE.md)**: Deep dive into system design
- **[Tutorials](TUTORIALS.md)**: Hands-on learning exercises
- **[FAQ](FAQ.md)**: Common questions answered
