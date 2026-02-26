# Azure OpenAI setup

How to configure the app to use Azure OpenAI directly.

## When to use Azure OpenAI

Pick Azure OpenAI over Foundry when you already have AOAI resources, need a specific model version, or need regional deployment control for compliance or latency.

If you're starting fresh and don't have a strong reason to use AOAI directly, [Foundry](MICROSOFT-FOUNDRY.md) is usually simpler.

[Compare providers](README.md)

## Prerequisites

- Azure subscription ([Get one free](https://azure.microsoft.com/free))
- Azure Developer CLI installed ([Download](https://learn.microsoft.com/azure/developer/azure-developer-cli/install-azd))
- Azure CLI installed ([Download](https://docs.microsoft.com/cli/azure/install-azure-cli))

## Step 1: Create Azure OpenAI resource

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
azd env get-value 'FOUNDRY_OPENAI_ENDPOINT'

# Get API key
az cognitiveservices account keys list -g rg-$(azd env get-value AZURE_ENV_NAME) -n $(azd env get-value FOUNDRY_NAME) --query "key1" -o tsv
```

## Step 3: Store credentials

```bash
dotnet user-secrets --file ./apphost.cs set Azure:OpenAI:Endpoint "{{AZURE_OPENAI_ENDPOINT}}"
dotnet user-secrets --file ./apphost.cs set Azure:OpenAI:ApiKey "{{AZURE_OPENAI_API_KEY}}"
```

## Step 4: Run the app

```bash
# Using file-based Aspire (recommended)
aspire run --file ./apphost.cs -- --provider AzureOpenAI

# Using project-based Aspire
aspire run --project ./src/InterviewCoach.AppHost -- --provider AzureOpenAI
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
