# Microsoft Foundry setup

Recommended for production.

## What is Microsoft Foundry?

[Microsoft Foundry](https://learn.microsoft.com/en-us/azure/ai-foundry/what-is-foundry?view=foundry) is Azure's platform for building and managing AI applications. It gives you a single portal for model management, content safety, PII detection, cost-optimized model routing, evaluation, and fine-tuning.

## Prerequisites

- Azure subscription ([Get one free](https://azure.microsoft.com/free))
- Azure Developer CLI installed ([Download](https://learn.microsoft.com/azure/developer/azure-developer-cli/install-azd))
- Azure CLI installed ([Download](https://docs.microsoft.com/cli/azure/install-azure-cli))

## Step 1: Create Foundry resource

```bash
# Navigate to the resource directory
cd resources-foundry

# Login to Azure
azd auth login

# Provision resources
azd up
```

## Step 2: Get endpoint and API key

```bash
# Navigate to the resource directory
cd resources-foundry

# Login to Azure
az login

# Get endpoint
azd env get-value 'FOUNDRY_PROJECT_ENDPOINT'

# Get API key
az cognitiveservices account keys list -g rg-$(azd env get-value AZURE_ENV_NAME) -n $(azd env get-value FOUNDRY_NAME) --query "key1" -o tsv
```

## Step 3: Store credentials

```bash
dotnet user-secrets --file ./apphost.cs set MicrosoftFoundry:Project:Endpoint "{{MICROSOFT_FOUNDRY_PROJECT_ENDPOINT}}"
dotnet user-secrets --file ./apphost.cs set MicrosoftFoundry:Project:ApiKey "{{MICROSOFT_FOUNDRY_API_KEY}}"
```

## Step 4: Run the app

```bash
# Using file-based Aspire (recommended)
aspire run --file ./apphost.cs

# Using project-based Aspire
aspire run --project ./src/InterviewCoach.AppHost
```
## Step 5: Deploy to Azure

```bash
# Login to Azure
azd auth login

# Provision + deploy
azd up
```

## Step 6: Clean up

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
