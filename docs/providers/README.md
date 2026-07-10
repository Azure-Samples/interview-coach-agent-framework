# LLM provider options

The app supports multiple LLM backends. Pick one in config and go — no code changes.

## Quick comparison

| Provider                                      | Best For                                              | Auth       | Cost               |
|-----------------------------------------------|-------------------------------------------------------|------------|--------------------|
| **[Microsoft Foundry](MICROSOFT-FOUNDRY.md)** | Production deployments with Agent Service             | Azure RBAC | Pay-per-use        |
| **[Azure OpenAI](AZURE-OPENAI.md)**           | Production deployments                                | API Key    | Pay-per-use        |
<!-- | **[GitHub Copilot](GITHUB-COPILOT.md)**        | Local development and prototyping with GitHub Copilot | GitHub PAT | Free (with limits) | -->

## Getting started

Pick a provider and follow the guide:

- [Microsoft Foundry](MICROSOFT-FOUNDRY.md) (recommended)
- [Azure OpenAI](AZURE-OPENAI.md)
<!-- - [GitHub Copilot](GITHUB-COPILOT.md) -->

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
    "DeploymentName": "gpt-5-mini",
    "ModelVersion": "1",
    "ModelFormat": "OpenAI"
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

<!-- **GitHub Copilot:**

```json
{
  "AgentMode": "CopilotHandOff",

  "LlmProvider": "GitHubCopilot",

  "GitHubCopilot": {
    "Token": "{{GITHUB_PAT}}"
  }
}
```

> **NOTE**: Choosing `GitHubCopilot` as an LLM provider only allows the agent mode of `CopilotHandOff`. -->

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

<!-- **GitHub Copilot:**

```bash
aspire run --file ./apphost.cs -- --provider GitHubCopilot --mode CopilotHandOff
```

> **NOTE**: Choosing `GitHubCopilot` as an LLM provider only allows the agent mode of `CopilotHandOff`. -->

## Next steps

- [Learning objectives](../LEARNING-OBJECTIVES.md)
- [Architecture overview](../ARCHITECTURE.md)
- [Tutorials](../TUTORIALS.md)
- [FAQ](../FAQ.md)
