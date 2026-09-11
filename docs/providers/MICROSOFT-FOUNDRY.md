# Microsoft Foundry configuration

Foundry is the default model provider. `LlmResourceFactory.AddMicrosoftFoundryResource` declares a Foundry resource and model deployment through Aspire. The agent service creates a local `ChatClientAgent` that calls that model.

**Starting the local AppHost can create billable Azure resources.** Confirm a development subscription, permitted region, model quota, provisioning permissions, and cleanup owner first. [Chapter 0](https://codemillmatt.github.io/interview-coach-agent-framework/workshop/00-orientation/#check-your-tools) covers the first-run checks. The learner starter remains cloud-free until model access is activated in the first-agent lesson.

## Authenticate

Install the Azure CLI, then sign in and check the account:

```bash
# Bash
az login
az account show --query "{subscription:name, subscriptionId:id, tenant:tenantId}" --output table
```

```powershell
# PowerShell
az login
az account show --query "{subscription:name, subscriptionId:id, tenant:tenantId}" --output table
```

Use `az login --tenant YOUR_TENANT_ID` and `az account set --subscription YOUR_SUBSCRIPTION_ID` when you need explicit selection. Replace the placeholders and keep account details out of published logs.

The completed `Program.cs` uses `DefaultAzureCredential` with the token scope `https://cognitiveservices.azure.com/.default`. In development it excludes the managed-identity probe so local developer credentials can be used. `AZURE_TENANT_ID` sets the credential tenant when present. This path uses identity-based authentication.

For a deployed application, check its managed identity and access to the actual model resource separately from local CLI authentication.

## Model settings

The checked-in `apphost.settings.json` requests:

```json
{
  "LlmProvider": "MicrosoftFoundry",
  "AgentMode": "HandOff",
  "MicrosoftFoundry": {
    "DeploymentName": "gpt-5-mini",
    "ModelVersion": "2025-08-07",
    "ModelFormat": "OpenAI",
    "SkuName": "GlobalStandard",
    "SkuCapacity": 100
  }
}
```

Confirm these sample values against [model availability](https://learn.microsoft.com/azure/ai-foundry/openai/concepts/models) and [quota](https://learn.microsoft.com/azure/ai-foundry/openai/quotas-limits) in your subscription. Keep an explicit model version: omitting it makes the factory request version `1`, which may be invalid for the selected model.

Aspire passes a `chat` connection string containing `Endpoint` and `Deployment` to the agent service. The Foundry branch uses those values to construct an OpenAI-compatible endpoint and register `client.AsIChatClient()`.

During the workshop, `WorkshopHosting.cs` supplies this source-derived setup so the first-agent lesson can focus on the `ChatClientAgent` constructor and interview instructions. Learners activate the helper after writing the agent. The capstone's declared support patch restores the completed `Program.cs` and removes the helper; see [scaffold finalization](../ARCHITECTURE.md#workshop-scaffold-and-finalization).

## Reuse an existing account and deployment

The standalone sample provisions by default. To reuse existing resources, set `MicrosoftFoundry:UseExisting` to `true` and provide all four values under `MicrosoftFoundry:Existing`: `Name`, `ResourceGroup`, `SubscriptionId`, and `DeploymentName`. The deployment name is the Azure resource name, often `chat`, rather than the model name in the normal provisioning settings.

For a local run, also set `Azure:AllowResourceGroupCreation` to `false` and configure the AppHost's normal `Azure:SubscriptionId`, `Azure:ResourceGroup`, and `Azure:Location` context. Keep these account-specific values in local user secrets or deployment configuration. Model version, SKU, and capacity settings are ignored while reusing a deployment.

`AddExistingMicrosoftFoundryResource` submits an ARM deployment containing only existing account and deployment references. It reads the endpoint and verifies the deployment exists. It does not create an account, model deployment, capability host, or role assignment. This requires permission to evaluate the ARM deployment and existing permission to call the model. Invalid settings, missing resources, or denied access fail explicitly; there is no automatic provisioning fallback.

The workshop's learner archives enable reuse from the start, with resource-group creation disabled. They remove the repository's inherited `UserSecretsId`, so each file-based learner AppHost uses its own path-specific store. Use `dotnet user-secrets set KEY VALUE --file ./apphost.cs` from that learner folder; file-based apps do not support `dotnet user-secrets init --file`. Copy only the resource identifiers from Chapter 0. Do not copy its secrets file, cached `Azure:Deployments` values, or a `ConnectionStrings:chat` override.

## Entry points and ownership

From the repository root, start the local file-based AppHost:

```bash
# Bash
aspire start --apphost ./apphost.cs
```

```powershell
# PowerShell
aspire start --apphost ./apphost.cs
```

The complete application also needs the container engine for Cosmos and MarkItDown. Review any Azure context and provisioning prompts before proceeding.

The project-based AppHost is `src/InterviewCoach.AppHost`; it uses its own `appsettings.json` and is the deployment target in `azure.yaml`. In the learner scaffold it stays in the starter state until capstone finalization. See [optional deployment](../DEPLOYMENT.md) before running `azd`.

Record the resources created by each AppHost. Reuse means the example and learner depend on the same model account; keep it until both are finished. Cloud resources remain after `aspire stop`, and `azd down` covers its selected environment. Review each scope in the [cleanup reference](../DEPLOYMENT.md#remove-only-the-resources-you-own).
