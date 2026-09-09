# Microsoft Foundry setup

Microsoft Foundry is the default LLM provider. Aspire provisions the Foundry resource and model deployment as part of the application.

The agents execute in the .NET service; this is a Foundry-hosted model connection, not a Foundry Agent Service hosting implementation. Local runs can provision billable Azure resources.

## Prerequisites

- An [Azure subscription](https://azure.microsoft.com/free)
- The [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli)
- The [Azure Developer CLI](https://learn.microsoft.com/azure/developer/azure-developer-cli/install-azd) for deployment

## Authenticate

Sign in with the Azure CLI:

```bash
az login
```

The agent uses `DefaultAzureCredential`. It reads Azure CLI credentials during local development and uses managed identity after deployment. No Foundry API key is required.

If your account belongs to more than one tenant, select the tenant explicitly:

```bash
az login --tenant "{{AZURE_TENANT_ID}}"
```

## Configure the model

Both providers default to `gpt-5-mini`. Foundry also needs the model version, format, SKU, and capacity:

```json
{
  "LlmProvider": "MicrosoftFoundry",
  "MicrosoftFoundry": {
    "DeploymentName": "gpt-5-mini",
    "ModelVersion": "2025-08-07",
    "ModelFormat": "OpenAI",
    "SkuName": "GlobalStandard",
    "SkuCapacity": 100
  }
}
```

`DeploymentName` falls back to `gpt-5-mini` when omitted. Model availability, versions, and quota vary by Azure region.

## Run locally

File-based AppHost:

```bash
aspire start --apphost ./apphost.cs
```

Project-based AppHost:

```bash
aspire start --apphost ./src/InterviewCoach.AppHost
```

On the first run, Aspire asks for any missing Azure context, then provisions the Foundry resource and deployment. The local Cosmos DB emulator and MarkItDown container still require Docker.

## Deploy to Azure

```bash
azd auth login
azd up
```

Inspect the deployed application identity and its access to the provisioned resources. Successful local Azure CLI authentication does not prove that the deployed identity has the required permissions.

## Clean up

```bash
azd down
```

Review the selected environment and removal scope before confirming. This does not necessarily remove resources provisioned by a separate local Aspire run. Keep an inventory and remove only workshop-owned resources.

## Resources

- [Microsoft Foundry](https://learn.microsoft.com/azure/ai-foundry/what-is-foundry)
- [Foundry models](https://learn.microsoft.com/azure/ai-foundry/foundry-models/overview)
- [DefaultAzureCredential](https://learn.microsoft.com/dotnet/api/azure.identity.defaultazurecredential)
