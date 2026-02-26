# Microsoft Foundry Setup Guide

This is the **recommended configuration** for production deployments of the Interview Coach application.

## What is Microsoft Foundry?

[Microsoft Foundry](https://learn.microsoft.com/en-us/azure/ai-foundry/what-is-foundry?view=foundry) is a comprehensive platform for building, deploying, and managing AI applications on Azure. It provides:

- **Unified Portal**: Single interface for model management, evaluation, and monitoring
- **Enterprise Features**: Content safety, PII detection, responsible AI tools
- **Cost Optimization**: Automatic selection between models to balance quality and cost
- **Integrated Tools**: Prompt flow, evaluation datasets, fine-tuning, and more

## Prerequisites

- Azure subscription ([Get one free](https://azure.microsoft.com/free))
- Azure Developer CLI installed ([Download](https://learn.microsoft.com/azure/developer/azure-developer-cli/install-azd))
- Azure CLI installed ([Download](https://docs.microsoft.com/cli/azure/install-azure-cli))

## Step 1: Create Foundry Resource

```bash
# Navigate to the resource directory
cd resources-foundry

# Login to Azure
azd auth login

# Provision resources
azd up
```

## Step 2: Get Resource Endpoint and API Key

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

## Step 3: Store Credentials Securely

```bash
dotnet user-secrets --file ./apphost.cs set MicrosoftFoundry:Project:Endpoint "{{MICROSOFT_FOUNDRY_PROJECT_ENDPOINT}}"
dotnet user-secrets --file ./apphost.cs set MicrosoftFoundry:Project:ApiKey "{{MICROSOFT_FOUNDRY_API_KEY}}"
```

## Step 4: Run the Application

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

## Step 6: Clean Up Resources

When finished, remove all Azure resources:

```bash
azd down --force --purge
```

## Next Steps

- **[Learning Objectives](LEARNING-OBJECTIVES.md)**: Understand what you'll learn
- **[Architecture Overview](ARCHITECTURE.md)**: Deep dive into system design
- **[Tutorials](TUTORIALS.md)**: Hands-on learning exercises
- **[FAQ](FAQ.md)**: Common questions answered

## Resources

- [Microsoft Foundry Portal](https://ai.azure.com)
- [Microsoft Foundry Documentation](https://learn.microsoft.com/en-us/azure/ai-foundry/what-is-foundry?view=foundry)
- [Foundry Agent Service](https://learn.microsoft.com/en-us/azure/ai-foundry/agents/overview?view=foundry)
