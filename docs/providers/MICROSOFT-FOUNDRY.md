# Microsoft Foundry Setup Guide

This is the **recommended configuration** for production deployments of the Interview Coach application.

## What is Microsoft Foundry?

[Microsoft Foundry](https://learn.microsoft.com/azure/ai-foundry/what-is-foundry) (formerly Azure AI Studio) is a comprehensive platform for building, deploying, and managing AI applications on Azure. It provides:

- **Model Router**: Intelligent routing to optimal models based on request complexity
- **Unified Portal**: Single interface for model management, evaluation, and monitoring
- **Enterprise Features**: Content safety, PII detection, responsible AI tools
- **Cost Optimization**: Automatic selection between models to balance quality and cost
- **Integrated Tools**: Prompt flow, evaluation datasets, fine-tuning, and more

## Prerequisites

- Azure subscription ([Get one free](https://azure.microsoft.com/free))
- Azure CLI installed ([Download](https://docs.microsoft.com/cli/azure/install-azure-cli))
- .NET 10 SDK ([Download](https://dotnet.microsoft.com/download/dotnet/10.0))

## Step 1: Create Foundry Project

### Option A: Via Azure Portal (Recommended for First-Time Users)

1. Navigate to [Azure AI Foundry Portal](https://ai.azure.com)
2. Sign in with your Azure account
3. Click **New project**
4. Fill in project details:
   - **Project name**: `interview-coach` (or your preferred name)
   - **Subscription**: Select your Azure subscription
   - **Resource group**: Create new or select existing
   - **Location**: Choose a region (e.g., East US 2, West Europe)
5. Click **Create**
6. Wait for deployment to complete (~2-3 minutes)

### Option B: Via Azure CLI

```bash
# Login to Azure
az login

# Set your subscription (if you have multiple)
az account set --subscription "Your Subscription Name"

# Create resource group
az group create \
  --name rg-interview-coach \
  --location eastus2

# Create AI Foundry project (using Azure AI CLI extension)
az extension add --name ml
az ml workspace create \
  --name interview-coach \
  --resource-group rg-interview-coach \
  --location eastus2 \
  --kind project
```

## Step 2: Get Project Endpoint and API Key

### Via Azure AI Foundry Portal

1. Open your project at [ai.azure.com](https://ai.azure.com)
2. In the left navigation, click **Project settings** (gear icon)
3. Find the **Project connection string** section
4. Copy the following values:
   - **Endpoint**: `https://your-project-name.azure.ai`
   - **API Key**: Click **Show** and copy the key

### Via Azure CLI

```bash
# Get workspace details
az ml workspace show \
  --name interview-coach \
  --resource-group rg-interview-coach

# Get endpoint (look for "mlflow_tracking_uri" or "discovery_url")
# API key retrieval via CLI may require additional steps depending on auth setup
```

## Step 3: Configure Application

### Store Credentials Securely

**For Local Development** (recommended):

Use .NET user secrets to keep credentials out of source control:

```bash
# Navigate to repository root
cd /path/to/interview-coach-agent-framework

# Store endpoint
dotnet user-secrets --file ./apphost.cs set MicrosoftFoundry:Project:Endpoint "https://your-project.azure.ai"

# Store API key
dotnet user-secrets --file ./apphost.cs set MicrosoftFoundry:Project:ApiKey "your-api-key-here"
```

**For Production Deployment**:

Use Azure Key Vault or Managed Identity (configured automatically by `azd up`).

### Update Configuration File

Edit `apphost.settings.json` (or create if it doesn't exist):

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },

  "LlmProvider": "MicrosoftFoundry",

  "MicrosoftFoundry": {
    "Project": {
      "Endpoint": "{{MICROSOFT_FOUNDRY_PROJECT_ENDPOINT}}",
      "ApiKey": "{{MICROSOFT_FOUNDRY_PROJECT_API_KEY}}",
      "DeploymentName": "model-router"
    }
  }
}
```

**Note**: The `{{...}}` placeholders are automatically replaced with user secrets during local development or environment variables during deployment.

## Step 4: Understanding Model Router

The default `DeploymentName` is set to `model-router`, which is a special Foundry feature.

### What is Model Router?

[Model Router](https://learn.microsoft.com/azure/ai-foundry/openai/concepts/model-router) automatically:

- Analyzes request complexity
- Routes to the most cost-effective model that meets quality requirements
- Falls back to more capable models when needed
- Balances performance, quality, and cost

### Model Router Behavior

```
Simple request (e.g., "Hello") 
    → Routes to gpt-4o-mini (fast, cheap)

Complex request (e.g., detailed code review)
    → Routes to gpt-4o (higher quality)

All requests appear identical to your application!
```

### Using Specific Models Instead

If you prefer to control model selection:

```json
{
  "MicrosoftFoundry": {
    "Project": {
      "Endpoint": "...",
      "ApiKey": "...",
      "DeploymentName": "gpt-4o"  // or "gpt-4o-mini", "gpt-4", etc.
    }
  }
}
```

Available models in Foundry:

- `gpt-4o` - Latest GPT-4 Optimized (best quality)
- `gpt-4o-mini` - Smaller, faster, cheaper
- `gpt-4-turbo` - Previous generation (still excellent)
- `gpt-3.5-turbo` - Fastest, most economical

Check the [Foundry Portal](https://ai.azure.com) for the latest available models in your project.

## Step 5: Run the Application

```bash
# Using file-based Aspire (recommended)
aspire run --file ./apphost.cs

# OR using project-based Aspire
aspire run --project ./src/InterviewCoach.AppHost
```

### Verify Configuration

1. Aspire Dashboard will open automatically (usually `https://localhost:17XXX`)
2. Check the **Console Logs** for the Agent service
3. Look for confirmation:

   ```
   info: Using MicrosoftFoundry: model-router
   ```

4. Navigate to the **webui** endpoint
5. Start a conversation to test the agent

## Step 6: Deploy to Azure

The application is configured for one-command deployment with Azure Developer CLI (`azd`).

### Initial Deployment

```bash
# Install azd if you haven't already
# Windows: winget install microsoft.azd
# macOS: brew install azure/azd

# Login to Azure
azd auth login

# Provision + deploy
azd up
```

The `azd up` command will:

1. Provision Azure Container Apps environment
2. Create container registry
3. Build and push container images
4. Deploy all services (agent, webui, MCP servers)
5. Configure Foundry connection automatically
6. Output the public URL

### Subsequent Deployments

```bash
# Deploy code changes
azd deploy

# OR update infrastructure + deploy
azd up
```

### Deployment Configuration

The deployment uses Managed Identity for authentication to Foundry in production. This means:

- ✅ No API keys stored in environment variables
- ✅ Automatic credential rotation
- ✅ Azure RBAC for access control

This is configured automatically in `infra/` (generated by azd).

## Monitoring and Observability

### Viewing Metrics in Foundry Portal

1. Go to [ai.azure.com](https://ai.azure.com)
2. Open your project
3. Navigate to **Monitoring** (or **Metrics**)
4. View:
   - Request count and latency
   - Token usage per model
   - Error rates
   - Cost estimates

### Distributed Tracing

The application includes OpenTelemetry instrumentation:

1. In Aspire Dashboard (local) → **Traces** tab
2. In Azure (production) → Container App logs in Azure Portal

### Cost Tracking

Track costs in the Foundry Portal:

- **Project Overview** → Cost dashboard
- See breakdown by model
- Set budget alerts

## Troubleshooting

### Error: "Missing configuration: MicrosoftFoundry:Project:Endpoint"

**Cause**: User secrets not set or configuration file missing.

**Solution**:

```bash
dotnet user-secrets --file ./apphost.cs set MicrosoftFoundry:Project:Endpoint "https://your-project.azure.ai"
dotnet user-secrets --file ./apphost.cs set MicrosoftFoundry:Project:ApiKey "your-key"
```

### Error: "Unauthorized" or 401 responses

**Cause**: Invalid API key or endpoint.

**Solution**:

1. Verify endpoint URL in Foundry Portal (Project Settings)
2. Regenerate API key if needed
3. Update user secrets with new values
4. Restart application

### Error: "Model not found: model-router"

**Cause**: Older Foundry projects may not support model-router.

**Solution**: Use a specific model name instead:

```json
"DeploymentName": "gpt-4o"
```

### Slow Response Times

**Possible causes**:

1. Cold start (first request after idle)
2. Complex prompts requiring larger models
3. High load on Foundry service

**Solutions**:

- Enable warm-up requests
- Check Foundry Portal for service health
- Consider reserved capacity for production

## Advanced: Using Prompt Flow

Foundry includes Prompt Flow for advanced prompt engineering:

1. Navigate to your project at [ai.azure.com](https://ai.azure.com)
2. Click **Prompt flow** in left navigation
3. Create a flow using the agent instructions
4. Test different prompts and evaluate quality
5. Export refined instructions back to code

## Advanced: Evaluation and Testing

Foundry provides built-in evaluation tools:

1. Create evaluation dataset (sample interviews)
2. Run batch evaluation
3. Compare prompt variations
4. Measure quality metrics (relevance, groundedness, coherence)

See [Foundry Evaluation Docs](https://learn.microsoft.com/azure/ai-foundry/concepts/evaluation-approach-gen-ai) for details.

## Best Practices

### Security

✅ **Use Managed Identity in production** (automatic with azd)  
✅ **Store API keys in Key Vault**, not in code/config  
✅ **Enable Content Safety** filters in Foundry Portal  
✅ **Review PII detection** settings for compliance  

### Cost Optimization

✅ **Use model-router** for automatic optimization  
✅ **Set max_tokens** limits to prevent runaway costs  
✅ **Monitor usage** regularly in Foundry Portal  
✅ **Set budget alerts** in Azure Cost Management  

### Performance

✅ **Choose region close to users** for lower latency  
✅ **Enable caching** for repeated requests (Foundry feature)  
✅ **Use mini models** when high quality isn't critical  

## Next Steps

- 🎯 [Complete Getting Started](../../README.md)
- 🏗️ [Understand the Architecture](../ARCHITECTURE.md)
- 📚 [Follow Tutorials](../TUTORIALS.md)
- ❓ [Read FAQ](../FAQ.md)

## Resources

- [Microsoft Foundry Documentation](https://learn.microsoft.com/azure/ai-foundry/what-is-foundry)
- [Model Router Guide](https://learn.microsoft.com/azure/ai-foundry/openai/concepts/model-router)
- [Foundry Agent Service](https://learn.microsoft.com/azure/ai-foundry/agents/overview)
- [Azure AI Foundry Portal](https://ai.azure.com)
