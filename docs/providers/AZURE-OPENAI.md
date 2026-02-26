# Azure OpenAI Setup Guide

This guide shows how to configure the Interview Coach application to use Azure OpenAI directly (bypassing Microsoft Foundry).

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
- Azure CLI installed ([Download](https://docs.microsoft.com/cli/azure/install-azure-cli))
- .NET 10 SDK ([Download](https://dotnet.microsoft.com/download/dotnet/10.0))

## Step 1: Create Azure OpenAI Resource

### Option A: Via Azure Portal

1. Navigate to [Azure Portal](https://portal.azure.com)
2. Click **Create a resource**
3. Search for "Azure OpenAI"
4. Click **Create**
5. Fill in details:
   - **Subscription**: Your Azure subscription
   - **Resource group**: Create new (e.g., `rg-interview-coach`) or select existing
   - **Region**: Choose a region with model availability (e.g., East US, Sweden Central)
   - **Name**: `openai-interview-coach` (must be globally unique)
   - **Pricing tier**: Standard S0
6. Click **Review + create** → **Create**
7. Wait for deployment (~2 minutes)

### Option B: Via Azure CLI

```bash
# Login
az login

# Set subscription
az account set --subscription "Your Subscription Name"

# Create resource group
az group create \
  --name rg-interview-coach \
  --location eastus

# Create Azure OpenAI resource
az cognitiveservices account create \
  --name openai-interview-coach \
  --resource-group rg-interview-coach \
  --location eastus \
  --kind OpenAI \
  --sku S0
```

## Step 2: Deploy a Model

Azure OpenAI requires you to deploy models before use.

### Via Azure Portal

1. Navigate to your Azure OpenAI resource
2. Click **Go to Azure OpenAI Studio** (or visit [oai.azure.com](https://oai.azure.com))
3. Click **Deployments** in left navigation
4. Click **Create new deployment**
5. Select model:
   - **Model**: `gpt-4o` (recommended) or `gpt-4o-mini` (cost-effective)
   - **Model version**: Latest available
   - **Deployment name**: `gpt-4o` (note this name - you'll need it)
   - **Deployment type**: Standard
6. Click **Create**
7. Wait for deployment (~1 minute)

### Via Azure CLI

```bash
# Deploy gpt-4o model
az cognitiveservices account deployment create \
  --name openai-interview-coach \
  --resource-group rg-interview-coach \
  --deployment-name gpt-4o \
  --model-name gpt-4o \
  --model-version "2024-08-06" \
  --model-format OpenAI \
  --sku-capacity 10 \
  --sku-name Standard
```

**Recommended Models:**

- **gpt-4o**: Best quality, balanced performance/cost
- **gpt-4o-mini**: Faster, more economical, good for interviews
- **gpt-4-turbo**: Previous generation, still excellent
- **gpt-4**: Highest quality, higher cost/latency

Check [model availability by region](https://learn.microsoft.com/azure/ai-services/openai/concepts/models#model-summary-table-and-region-availability).

## Step 3: Get Endpoint and API Key

### Via Azure Portal

1. Navigate to your Azure OpenAI resource in Azure Portal
2. Click **Keys and Endpoint** in left navigation
3. Copy:
   - **Endpoint**: `https://openai-interview-coach.openai.azure.com/`
   - **Key 1**: Click **Show** and copy

### Via Azure CLI

```bash
# Get endpoint
az cognitiveservices account show \
  --name openai-interview-coach \
  --resource-group rg-interview-coach \
  --query "properties.endpoint" \
  --output tsv

# Get API key
az cognitiveservices account keys list \
  --name openai-interview-coach \
  --resource-group rg-interview-coach \
  --query "key1" \
  --output tsv
```

## Step 4: Configure Application

### Store Credentials Securely

**For Local Development:**

```bash
# Navigate to repository root
cd /path/to/interview-coach-agent-framework

# Store endpoint
dotnet user-secrets --file ./apphost.cs set Azure:OpenAI:Endpoint "https://your-resource.openai.azure.com/"

# Store API key
dotnet user-secrets --file ./apphost.cs set Azure:OpenAI:ApiKey "your-api-key-here"
```

### Update Configuration

Edit `apphost.settings.json`:

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },

  "AgentMode": "Single",

  "LlmProvider": "AzureOpenAI",

  "Azure": {
    "OpenAI": {
      "Endpoint": "{{AZURE_OPENAI_ENDPOINT}}",
      "ApiKey": "{{AZURE_OPENAI_API_KEY}}",
      "DeploymentName": "gpt-4o"
    }
  }
}
```

**Important**: Set `DeploymentName` to match the deployment name you created in Step 2 (e.g., `gpt-4o`, `gpt-4o-mini`).

## Step 5: Run the Application

```bash
aspire run --file ./apphost.cs
```

### Verify Configuration

1. Aspire Dashboard opens automatically
2. Check terminal output for provider confirmation:

   ```
   	LLM Provider: AzureOpenAI
   	Model: gpt-4o
   	Agent Mode: Single
   ```

3. Navigate to webui endpoint
4. Test the interview coach

## Step 6: Deploy to Azure

### Update Infrastructure (if needed)

If deploying with `azd`, you may need to configure managed identity access to Azure OpenAI.

Create/edit `infra/main.bicep` entry for Azure OpenAI access:

```bicep
// Grant container app managed identity access to Azure OpenAI
resource roleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(subscription().id, resourceGroup().id, 'CognitiveServicesUser')
  properties: {
    principalId: containerApp.identity.principalId
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '5e0bd9bd-7b93-4f28-af87-19fc36ad61bd') // Cognitive Services User role
    principalType: 'ServicePrincipal'
  }
  scope: openAIResource
}
```

### Deploy

```bash
# Login
azd auth login

# Deploy
azd up
```

For production, consider using **Managed Identity** instead of API keys:

```json
{
  "Azure": {
    "OpenAI": {
      "Endpoint": "{{AZURE_OPENAI_ENDPOINT}}",
      "DeploymentName": "gpt-4o"
      // ApiKey omitted - will use Managed Identity
    }
  }
}
```

Update the code to use `DefaultAzureCredential`:

```csharp
// In LlmResourceFactory.cs
var credential = new DefaultAzureCredential();
var client = new OpenAIClient(credential, new Uri(endpoint));
```

## Monitoring and Management

### Azure OpenAI Studio

Monitor usage at [oai.azure.com](https://oai.azure.com):

- **Deployments**: View model status, scaling
- **Quota**: Check TPM (tokens per minute) limits
- **Usage**: Request count, token consumption

### Azure Portal

1. Navigate to your OpenAI resource
2. Click **Metrics**
3. View:
   - Total calls
   - Total tokens
   - Active tokens (per minute)
   - Latency percentiles

### Cost Management

View costs in Azure Portal:

1. **Cost Management + Billing**
2. Filter by resource group
3. Set budget alerts

**Estimated costs** (as of 2026):

- gpt-4o: ~$5 per million input tokens, ~$15 per million output tokens
- gpt-4o-mini: ~$0.15 per million input tokens, ~$0.60 per million output tokens

A typical interview (~5000 tokens total) costs:

- gpt-4o: ~$0.05 - $0.10
- gpt-4o-mini: ~$0.002 - $0.005

## Scaling and Performance

### Token Rate Limits (TPM)

Azure OpenAI enforces Tokens Per Minute (TPM) limits:

- Default: 10K - 120K TPM depending on region/model
- Can request increases via Azure Portal

### Scaling Deployments

Increase capacity:

```bash
az cognitiveservices account deployment update \
  --name openai-interview-coach \
  --resource-group rg-interview-coach \
  --deployment-name gpt-4o \
  --sku-capacity 50  # Increase from 10
```

Higher capacity = higher TPM allowance.

### Response Time Optimization

- **Use gpt-4o-mini** for faster responses
- **Deploy in region close to users**
- **Enable caching** (Azure OpenAI feature)
- **Use streaming** for real-time UX (future enhancement)

## Troubleshooting

### Error: "DeploymentNotFound"

**Cause**: Deployment name mismatch.

**Solution**:

```json
// Must match exactly
"DeploymentName": "gpt-4o"  // What you named it in Azure OpenAI Studio
```

### Error: "Unauthorized" (401)

**Cause**: Invalid API key or endpoint.

**Solution**:

1. Regenerate key in Azure Portal
2. Verify endpoint format: `https://YOUR-RESOURCE.openai.azure.com/`
3. Update user secrets
4. Restart app

### Error: "Rate limit exceeded" (429)

**Cause**: Exceeded TPM limits.

**Solution**:

1. Check current limit in Azure OpenAI Studio → Quotas
2. Request increase via Azure Portal
3. Or scale deployment capacity (see above)
4. Implement retry logic with exponential backoff

### Error: "Model not available in region"

**Cause**: Selected model not deployed in your resource's region.

**Solution**:

1. Check [model availability](https://learn.microsoft.com/azure/ai-services/openai/concepts/models#global-standard-model-availability)
2. Create new resource in supported region
3. Or choose different model

## Advanced: Content Filtering

Azure OpenAI includes built-in content filters:

1. Navigate to Azure OpenAI Studio
2. Click **Content filters**
3. Create custom filter:
   - Hate/Violence/Sexual/Self-harm thresholds
   - Prompt shields for jailbreak attempts
   - PII detection

Apply filter to deployment:

1. Go to **Deployments**
2. Edit your deployment
3. Select content filter configuration

## Advanced: Managed Identity (Recommended for Production)

### Enable System-Assigned Managed Identity

```bash
# On Container App (or other Azure service)
az containerapp identity assign \
  --name interview-coach-agent \
  --resource-group rg-interview-coach \
  --system-assigned
```

### Grant Access to Azure OpenAI

```bash
# Get the managed identity principal ID
PRINCIPAL_ID=$(az containerapp identity show \
  --name interview-coach-agent \
  --resource-group rg-interview-coach \
  --query principalId -o tsv)

# Grant Cognitive Services User role
az role assignment create \
  --assignee $PRINCIPAL_ID \
  --role "Cognitive Services User" \
  --scope /subscriptions/{subscription-id}/resourceGroups/rg-interview-coach/providers/Microsoft.CognitiveServices/accounts/openai-interview-coach
```

### Update Application Code

Modify [LlmResourceFactory.cs](../../src/InterviewCoach.AppHost/LlmResourceFactory.cs):

```csharp
private static IResourceBuilder<ProjectResource> AddAzureOpenAIResource(...)
{
    var endpoint = azure[ENDPOINT_KEY] ?? throw new...;
    var deploymentName = azure[DEPLOYMENT_NAME_KEY] ?? throw new...;
    
    // Use Managed Identity instead of API key
    var credential = new DefaultAzureCredential();
    var client = new AzureOpenAIClient(new Uri(endpoint), credential);
    var chatClient = client.GetChatClient(deploymentName);
    
    source.ApplicationBuilder.Services.AddSingleton<IChatClient>(chatClient);
    
    return source;
}
```

## Best Practices

✅ **Use Managed Identity in production** (no API keys)  
✅ **Enable content filters** for safety  
✅ **Monitor TPM usage** to avoid rate limits  
✅ **Set up budget alerts** for cost control  
✅ **Use gpt-4o-mini** unless you need highest quality  
✅ **Deploy in region close to users** for latency  
✅ **Implement retry logic** for transient failures  

## Migrating to Foundry

If you want to switch from Azure OpenAI to Foundry:

1. Create Foundry project (see [MICROSOFT-FOUNDRY.md](MICROSOFT-FOUNDRY.md))
2. Update configuration:

   ```json
   "LlmProvider": "MicrosoftFoundry"
   ```

3. Set Foundry credentials
4. Restart application

No code changes needed!

## Next Steps

- 🎯 [Run the Application](../../README.md)
- 🔄 [Compare Providers](README.md)
- 🏗️ [Architecture Overview](../ARCHITECTURE.md)
- ❓ [FAQ](../FAQ.md)

## Resources

- [Azure OpenAI Documentation](https://learn.microsoft.com/azure/ai-services/openai/)
- [Model Availability](https://learn.microsoft.com/azure/ai-services/openai/concepts/models)
- [Azure OpenAI Studio](https://oai.azure.com)
- [Pricing Calculator](https://azure.microsoft.com/pricing/calculator/)
