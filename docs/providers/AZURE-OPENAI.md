# Azure OpenAI Setup Guide

This guide shows how to configure the Interview Coach application to use Azure OpenAI directly.

## When to Use Azure OpenAI

**Choose Azure OpenAI over Foundry when:**

- You already have Azure OpenAI resources provisioned
- You need a specific model/version not available in Foundry
- You need regional deployment control for compliance/latency
- You're migrating existing Azure OpenAI applications

**Consider Foundry instead if:**

- Building a new application from scratch
- Want automatic model routing and cost optimization
- Need integrated evaluation and monitoring tools

[Compare providers →](README.md)

## Prerequisites

- Azure subscription ([Get one free](https://azure.microsoft.com/free))
- Azure Developer CLI installed ([Download](https://learn.microsoft.com/azure/developer/azure-developer-cli/install-azd))
- Azure CLI installed ([Download](https://docs.microsoft.com/cli/azure/install-azure-cli))

## Step 1: Create Azure OpenAI Resource

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
azd env get-value 'FOUNDRY_OPENAI_ENDPOINT'

# Get API key
az cognitiveservices account keys list -g rg-$(azd env get-value AZURE_ENV_NAME) -n $(azd env get-value FOUNDRY_NAME) --query "key1" -o tsv
```

## Step 3: Store Credentials Securely

```bash
dotnet user-secrets --file ./apphost.cs set Azure:OpenAI:Endpoint "{{AZURE_OPENAI_ENDPOINT}}"
dotnet user-secrets --file ./apphost.cs set Azure:OpenAI:ApiKey "{{AZURE_OPENAI_API_KEY}}"
```

## Step 4: Run the Application

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
