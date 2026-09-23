# Model providers

The reference application implements Microsoft Foundry and GitHub Copilot. Select one with `LlmProvider`; select single-agent or handoff orchestration separately with `AgentMode`.

| Provider | Application path | Access |
| --- | --- | --- |
| [Microsoft Foundry](MICROSOFT-FOUNDRY.md) | OpenAI-compatible client, `IChatClient`, `ChatClientAgent` | Azure identity, resource permissions, model deployment/quota |
| [GitHub Copilot](GITHUB-COPILOT.md) | `CopilotClient` and Agent Framework adapter | Copilot-enabled account and supported authentication |

The workshop uses only Foundry and omits the alternative implementation from its downloads. To use the Copilot path, run the standalone repository using the main README rather than a workshop checkpoint.

## Select the implemented provider

In `apphost.settings.json`, keep the model-specific section and set both selections:

```json
{
  "LlmProvider": "MicrosoftFoundry",
  "AgentMode": "Single"
}
```

Or override them from the root AppHost:

```bash
# Bash
aspire start --apphost ./apphost.cs -- --provider GitHubCopilot --mode HandOff
```

```powershell
# PowerShell
aspire start --apphost ./apphost.cs -- --provider GitHubCopilot --mode HandOff
```

Authenticate for the chosen provider before starting. Restart and create a new chat after switching. Follow the provider-specific reference for model selection and authentication; the available models depend on your account and configuration.

These settings apply to the completed root AppHost. Optional deployment uses the project-based AppHost's own settings. In learner projects, prepare that separate AppHost only if you choose optional deployment. See [entry points and precedence](../CONFIGURATION.md#entry-points-and-precedence).

Both provider paths use the same interview roles and MCP services. Check each provider's actual tool calls and saved records when comparing behavior. Additional providers require code changes to model setup and agent construction.
