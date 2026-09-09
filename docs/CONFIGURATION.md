# Configuration reference

## Entry points and precedence

The root `apphost.cs` loads `apphost.settings.json` and user secrets. The project-based AppHost uses its project configuration and is the deployment target in `azure.yaml`.

`LlmResourceFactory.GetProviderAndAgentMode` reads configuration, then applies `--provider`/`-p` and `--mode`/`-m` arguments. Missing or invalid provider/mode values are rejected.

```sh
aspire start --apphost ./apphost.cs -- --provider MicrosoftFoundry --mode Single
```

## Settings

| Key | Values / purpose |
| --- | --- |
| `LlmProvider` | `MicrosoftFoundry` or `GitHubCopilot` |
| `AgentMode` | `Single` or `HandOff` |
| `MicrosoftFoundry:DeploymentName` | Model/deployment name supplied to the Aspire deployment integration |
| `MicrosoftFoundry:ModelVersion` | Requested model version |
| `MicrosoftFoundry:ModelFormat` | Model format, currently `OpenAI` |
| `MicrosoftFoundry:SkuName` | Requested SKU |
| `MicrosoftFoundry:SkuCapacity` | Requested capacity; validate quota and suitability for your environment |
| `GitHubCopilot:Model` | Copilot model selection |
| `GitHubCopilot:Token` | Optional token, kept in private configuration |
| `COPILOT_GITHUB_TOKEN` | Alternative optional token setting |

The checked-in Foundry settings use `gpt-5-mini`, model version `2025-08-07`, `OpenAI`, `GlobalStandard`, and capacity `100`. The factory's fallback model version is `1`, not the checked-in version; do not remove model settings and assume that fallback is valid for the same deployment.

## Agent-side configuration

Aspire supplies provider/mode environment variables and the `chat` connection string. The Foundry branch extracts `Endpoint` and `Deployment`, creates the OpenAI-compatible client, and requests a token for `https://cognitiveservices.azure.com/.default`.

`AZURE_TENANT_ID` can set the credential tenant. The development path excludes the managed-identity probe and uses available developer credentials. Deployed identity access must be verified for the actual provisioned resources.

## Service references

The UI references `agent`. The agent references `mcp-markitdown` and `mcp-interview-data`. InterviewData references the Cosmos database. Prefer these resource references over hard-coded local ports.

No workshop website setting is an application secret. Never put a model token, subscription credential, or personal document in static website content.
