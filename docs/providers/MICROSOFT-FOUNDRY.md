# Microsoft Foundry setup

Recommended for production.

## What is Microsoft Foundry?

[Microsoft Foundry](https://learn.microsoft.com/en-us/azure/ai-foundry/what-is-foundry?view=foundry) is Azure's platform for building and managing AI applications. It gives you a single portal for model management, content safety, PII detection, cost-optimized model routing, evaluation, and fine-tuning.

## Prerequisites

- Azure subscription ([Get one free](https://azure.microsoft.com/free))
- Azure Developer CLI installed ([Download](https://learn.microsoft.com/azure/developer/azure-developer-cli/install-azd))
- Azure CLI installed ([Download](https://docs.microsoft.com/cli/azure/install-azure-cli))

## Step 1: Configure Azure provisioning

The Aspire AppHost auto-provisions the Foundry resource using your Azure subscription. Set the required provisioning settings in user secrets:

```bash
dotnet user-secrets --file ./apphost.cs set Azure:SubscriptionId "{{YOUR_AZURE_SUBSCRIPTION_ID}}"
dotnet user-secrets --file ./apphost.cs set Azure:ResourceGroupPrefix "{{YOUR_RESOURCE_GROUP_PREFIX}}"
dotnet user-secrets --file ./apphost.cs set Azure:Location "{{YOUR_AZURE_LOCATION}}"
```

## Step 2: Configure the model deployment (optional)

The default model is `gpt-5-mini` with OpenAI format. To change it, update `apphost.settings.json`:

```json
{
  "MicrosoftFoundry": {
    "DeploymentName": "gpt-5-mini",
    "ModelVersion": "1",
    "ModelFormat": "OpenAI"
  }
}
```

## Step 3: Run the app

```bash
# Using file-based Aspire (recommended)
aspire run --file ./apphost.cs

# Using project-based Aspire
aspire run --project ./src/InterviewCoach.AppHost
```

Aspire will automatically provision the Foundry resource and model deployment on first run.

## Step 4: Deploy to Azure

```bash
# Login to Azure
azd auth login

# Provision + deploy
azd up
```

## Step 5: Clean up

When finished, remove all Azure resources:

```bash
azd down --force --purge
```

## Next steps

- [Learning objectives](../LEARNING-OBJECTIVES.md)
- [Architecture overview](../ARCHITECTURE.md)
- [Tutorials](../TUTORIALS.md)
- [FAQ](../FAQ.md)

## Resources

- [Microsoft Foundry Portal](https://ai.azure.com)
- [Microsoft Foundry Documentation](https://learn.microsoft.com/en-us/azure/ai-foundry/what-is-foundry?view=foundry)
- [Foundry Agent Service](https://learn.microsoft.com/en-us/azure/ai-foundry/agents/overview?view=foundry)
