# Configuration reference

## Entry points and precedence

Use this reference for the completed application. Workshop `02-starter` is cloud-free: the supplied `WorkshopHosting.cs` helper is inactive, and the model reference is added in the first-agent lesson.

The root `apphost.cs` loads `apphost.settings.json` and user secrets. The project-based AppHost uses `src/InterviewCoach.AppHost/appsettings.json` and is the deployment target in `azure.yaml`. Configure each entry point through its own settings.

Core workshop orchestration edits use root `apphost.cs`. The learner's project-based AppHost and settings stay in their starter state until the capstone support patch restores the completed deployment graph. The repository source already contains both completed entry points. See [scaffold finalization](ARCHITECTURE.md#workshop-scaffold-and-finalization).

`LlmResourceFactory.GetProviderAndAgentMode` reads configuration, then applies `--provider`/`-p` and `--mode`/`-m` arguments. Missing or invalid provider/mode values are rejected.

```bash
# Bash
aspire start --apphost ./apphost.cs -- --provider MicrosoftFoundry --mode Single
```

```powershell
# PowerShell
aspire start --apphost ./apphost.cs -- --provider MicrosoftFoundry --mode Single
```

## Settings

| Key | Values / purpose |
| --- | --- |
| `LlmProvider` | `MicrosoftFoundry` or `GitHubCopilot` |
| `AgentMode` | `Single` or `HandOff` |
| `MicrosoftFoundry:DeploymentName` | Model name supplied when provisioning; the Azure deployment is named `chat` |
| `MicrosoftFoundry:ModelVersion` | Requested model version |
| `MicrosoftFoundry:ModelFormat` | Model format, currently `OpenAI` |
| `MicrosoftFoundry:SkuName` | Requested SKU |
| `MicrosoftFoundry:SkuCapacity` | Requested capacity; validate quota and suitability for your environment |
| `MicrosoftFoundry:UseExisting` | `true` selects existing-resource references and disables the model-provisioning path |
| `MicrosoftFoundry:Existing:Name` | Existing Foundry account name |
| `MicrosoftFoundry:Existing:ResourceGroup` | Resource group containing that account |
| `MicrosoftFoundry:Existing:SubscriptionId` | Subscription GUID containing that account |
| `MicrosoftFoundry:Existing:DeploymentName` | Actual Azure deployment name, often `chat`; all four existing identifiers are required together |
| `Azure:AllowResourceGroupCreation` | Must be `false` for local Foundry reuse |
| `GitHubCopilot:Model` | Copilot model selection |
| `GitHubCopilot:Token` | Optional token, kept in private configuration |
| `COPILOT_GITHUB_TOKEN` | Alternative optional token setting |

The checked-in Foundry settings use `gpt-5-mini`, model version `2025-08-07`, `OpenAI`, `GlobalStandard`, and capacity `100`. Confirm availability, quota, and approval for those values in your environment. The factory falls back to model version `1` when the setting is omitted, so keep the explicit version and verify it for the selected model.

## Agent-side configuration

Aspire supplies provider/mode environment variables and the `chat` connection string. The Foundry branch extracts `Endpoint` and `Deployment`, creates the OpenAI-compatible client, and requests a token for `https://cognitiveservices.azure.com/.default`.

`AZURE_TENANT_ID` can set the credential tenant. The development path excludes the managed-identity probe and uses available developer credentials. Check the deployed identity's access separately against the actual provisioned resources. The [Foundry authentication reference](providers/MICROSOFT-FOUNDRY.md#authenticate) describes this path.

## Service references

The UI references `agent`. The agent references `mcp-markitdown` and `mcp-interview-data`. InterviewData references the Cosmos database. Prefer these resource references over hard-coded local ports.

Keep application credentials in private configuration. Static website content is public; use fictional documents in examples.

## Provisioning scope

The standalone repository's default `WithLlmReference` path provisions Foundry resources. With explicit reuse enabled, it resolves an existing account and deployment through a reference-only ARM template. It does not create model resources, modify capacity, or assign roles; missing settings or failed resolution stop the app without a provisioning fallback. See [existing-resource configuration](providers/MICROSOFT-FOUNDRY.md#reuse-an-existing-account-and-deployment).

Learner archives require reuse and remove the repository's inherited user-secrets ID. Their file-based AppHost gets a stable, path-specific store. Configure a newly extracted folder separately rather than copying the example's secrets file or cached deployment state. The example and learner share model-resource ownership; cloud resources remain until [cleanup](DEPLOYMENT.md#remove-only-the-resources-you-own).
