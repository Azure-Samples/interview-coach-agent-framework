# Quick Start Guide

Get the Interview Coach application running in **under 10 minutes**. This guide assumes you're familiar with .NET and have prerequisites installed.

## Prerequisites Check

Before starting, ensure you have:

- ✅ [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0)
- ✅ [Docker Desktop](https://www.docker.com/products/docker-desktop) (running)
- ✅ [Git](https://git-scm.com/downloads)
- ✅ [Azure subscription](https://azure.microsoft.com/free) (for Foundry)

**Verify**:

```bash
dotnet --version    # Should be 10.x
docker ps           # Should work without error
git --version       # Any recent version
```

---

## Option 1: Microsoft Foundry (Recommended for Production)

**Time: ~8 minutes**

### Step 1: Create Foundry Project (2 min)

1. Go to [ai.azure.com](https://ai.azure.com)
2. Sign in → **New project** → Follow wizard
3. Copy **Endpoint** and **API Key** from Project Settings

### Step 2: Clone and Setup (3 min)

```bash
# Clone
git clone https://github.com/Azure-Samples/interview-coach-agent-framework.git
cd interview-coach-agent-framework

# Download MCP server
git clone https://github.com/microsoft/markitdown src/InterviewCoach.Mcp.MarkItDown

# Configure Foundry
dotnet user-secrets --file ./apphost.cs set MicrosoftFoundry:Project:Endpoint "YOUR_ENDPOINT"
dotnet user-secrets --file ./apphost.cs set MicrosoftFoundry:Project:ApiKey "YOUR_KEY"
```

### Step 3: Run (1 min)

```bash
aspire run --file ./apphost.cs
```

**Done!** Aspire Dashboard opens → Click **webui** endpoint → Start interviewing.

---

## Option 2: GitHub Models (Fastest for Dev)

**Time: ~5 minutes**

### Step 1: Get GitHub Token (2 min)

1. Go to [github.com/settings/tokens](https://github.com/settings/tokens?type=beta)
2. **Generate new token** → Check **GitHub Models** (read) → Copy token

### Step 2: Clone and Setup (2 min)

```bash
# Clone
git clone https://github.com/Azure-Samples/interview-coach-agent-framework.git
cd interview-coach-agent-framework

# Download MCP server
git clone https://github.com/microsoft/markitdown src/InterviewCoach.Mcp.MarkItDown

# Configure GitHub Models
dotnet user-secrets --file ./apphost.cs set GitHub:Token "YOUR_GITHUB_TOKEN"

# Update provider
# Edit apphost.settings.json, set: "LlmProvider": "GitHubModels"
```

**PowerShell quick edit**:

```powershell
(Get-Content apphost.settings.json) -replace '"MicrosoftFoundry"', '"GitHubModels"' | Set-Content apphost.settings.json
```

**Bash quick edit**:

```bash
sed -i 's/"MicrosoftFoundry"/"GitHubModels"/g' apphost.settings.json
```

### Step 3: Run (1 min)

```bash
aspire run --file ./apphost.cs
```

**Done!** Aspire Dashboard opens → Click **webui** endpoint.

**Note**: GitHub Models has rate limits (15 RPM). Fine for learning, not for production.

---

## Option 3: Azure OpenAI

**Time: ~10 minutes**

### Step 1: Create Azure OpenAI Resource (4 min)

```bash
az login

az group create --name rg-interview-coach --location eastus

az cognitiveservices account create \
  --name openai-interview-coach \
  --resource-group rg-interview-coach \
  --kind OpenAI \
  --sku S0 \
  --location eastus
```

### Step 2: Deploy Model (2 min)

1. Go to [oai.azure.com](https://oai.azure.com)
2. **Deployments** → **Create** → Model: **gpt-4o** → Deploy

### Step 3: Setup Application (3 min)

```bash
# Clone
git clone https://github.com/Azure-Samples/interview-coach-agent-framework.git
cd interview-coach-agent-framework

# Download MCP
git clone https://github.com/microsoft/markitdown src/InterviewCoach.Mcp.MarkItDown

# Get credentials
ENDPOINT=$(az cognitiveservices account show --name openai-interview-coach --resource-group rg-interview-coach --query properties.endpoint -o tsv)
KEY=$(az cognitiveservices account keys list --name openai-interview-coach --resource-group rg-interview-coach --query key1 -o tsv)

# Configure
dotnet user-secrets --file ./apphost.cs set Azure:OpenAI:Endpoint "$ENDPOINT"
dotnet user-secrets --file ./apphost.cs set Azure:OpenAI:ApiKey "$KEY"

# Update provider in apphost.settings.json
sed -i 's/"MicrosoftFoundry"/"AzureOpenAI"/g' apphost.settings.json
```

### Step 4: Run (1 min)

```bash
aspire run --file ./apphost.cs
```

---

## Verify Everything Works

### Check Aspire Dashboard

After running, the dashboard should show:

| Resource | Status | Type |
|----------|--------|------|
| agent | ✅ Running | Project |
| webui | ✅ Running | Project |
| mcp-markitdown | ✅ Running | Container |
| mcp-interview-data | ✅ Running | Project |
| sqlite | ✅ Running | Container |

### Test the Application

1. Click **webui** endpoint in Aspire Dashboard
2. Type: "Hello, I'd like to practice interviewing"
3. Agent should respond and ask for session info
4. Upload resume (use sample from `samples/` folder)
5. Agent should parse and begin interview

**Success!** 🎉 You're running a production-ready AI agent application.

---

## What Just Happened?

You ran a complete AI application with:

- ✅ **AI Agent** (Microsoft Agent Framework)
- ✅ **2 MCP Servers** (MarkItDown + InterviewData)
- ✅ **Database** (SQLite)
- ✅ **Web UI** (Blazor)
- ✅ **Orchestration** (.NET Aspire)

All configured with service discovery, observability, and ready for Azure deployment.

---

## Next Steps

### Learn the Patterns

- **[Learning Objectives](LEARNING-OBJECTIVES.md)** - What this sample teaches
- **[Architecture](ARCHITECTURE.md)** - How it all works together
- **[MCP Servers](MCP-SERVERS.md)** - Understanding extensibility

### Customize It

- **[Tutorial 1: Interview Flow](TUTORIALS.md#tutorial-1-understanding-the-interview-flow)** - Trace agent behavior
- **[Tutorial 2: Custom MCP Server](TUTORIALS.md#tutorial-2-creating-a-custom-mcp-server)** - Build your own tools
- **[Tutorial 3: Customize Agent](TUTORIALS.md#tutorial-3-customizing-the-agent)** - Modify instructions

### Deploy to Azure

One command deploys everything:

```bash
azd auth login
azd up
```

**[Full deployment guide →](../README.md#deploy-to-azure)**

---

## Troubleshooting

### "Missing configuration" error

```bash
# Verify user secrets are set
dotnet user-secrets --file ./apphost.cs list

# Should show your endpoint and API key/token
```

### MarkItDown not found

```bash
# Re-clone MarkItDown
git clone https://github.com/microsoft/markitdown src/InterviewCoach.Mcp.MarkItDown
```

### Docker errors

```bash
# Ensure Docker is running
docker ps

# Restart Docker Desktop if needed
```

### Rate limit (GitHub Models)

Switch to Foundry or Azure OpenAI (see options above).

**[Full troubleshooting guide →](TROUBLESHOOTING.md)**

---

## Command Cheat Sheet

```bash
# Start application
aspire run --file ./apphost.cs

# Stop (Ctrl+C in terminal)

# View user secrets
dotnet user-secrets --file ./apphost.cs list

# Set secret
dotnet user-secrets --file ./apphost.cs set Key "Value"

# Deploy to Azure
azd up

# Cleanup Azure resources
azd down --force --purge
```

---

## Learning Resources

- 📚 [Microsoft Agent Framework Docs](https://aka.ms/agent-framework)
- 🏗️ [.NET Aspire Docs](https://aspire.dev)
- 🔌 [MCP Specification](https://modelcontextprotocol.io)
- ☁️ [Microsoft Foundry Docs](https://learn.microsoft.com/azure/ai-foundry/what-is-foundry)

---

**Ready to dive deeper?** Start with **[Learning Objectives](LEARNING-OBJECTIVES.md)** to understand what makes this sample valuable for production AI applications.
