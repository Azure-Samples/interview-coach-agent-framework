# Troubleshooting Guide

Common issues and solutions for the Interview Coach application.

## Table of Contents

- [Getting Started Issues](#getting-started-issues)
- [Provider Configuration](#provider-configuration)
- [MCP Server Issues](#mcp-server-issues)
- [Aspire and Service Discovery](#aspire-and-service-discovery)
- [Database and Persistence](#database-and-persistence)
- [Deployment Issues](#deployment-issues)
- [Performance Problems](#performance-problems)

---

## Getting Started Issues

### Error: "Missing configuration: MicrosoftFoundry:Project:Endpoint"

**Symptoms**: Application fails to start with configuration error

**Cause**: User secrets not set or configuration file incorrect

**Solution**:

```bash
# Set user secrets
dotnet user-secrets --file ./apphost.cs set MicrosoftFoundry:Project:Endpoint "https://your-project.azure.ai"
dotnet user-secrets --file ./apphost.cs set MicrosoftFoundry:Project:ApiKey "your-key"

# Verify they're set
dotnet user-secrets --file ./apphost.cs list
```

**Verify** `apphost.settings.json` has:

```json
{
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

---

### MarkItDown MCP Server Not Found

**Symptoms**: Error about missing MarkItDown directory

**Cause**: MarkItDown MCP server not cloned

**Solution**:

```bash
# Bash/zsh
REPOSITORY_ROOT=$(git rev-parse --show-toplevel)
mkdir -p $REPOSITORY_ROOT/src/InterviewCoach.Mcp.MarkItDown
git clone https://github.com/microsoft/markitdown $REPOSITORY_ROOT/src/InterviewCoach.Mcp.MarkItDown
```

```powershell
# PowerShell
$REPOSITORY_ROOT = git rev-parse --show-toplevel
New-Item -Type Directory -Path $REPOSITORY_ROOT/src/InterviewCoach.Mcp.MarkItDown -Force
git clone https://github.com/microsoft/markitdown $REPOSITORY_ROOT/src/InterviewCoach.Mcp.MarkItDown
```

---

### Aspire Dashboard Not Opening

**Symptoms**: `aspire run` succeeds but dashboard doesn't open

**Cause**: Browser not opening automatically or port conflict

**Solutions**:

1. **Check terminal output** for dashboard URL:

   ```
   info: Aspire.Hosting.DistributedApplication[0]
         Aspire version: 9.0.0+abc123
         Dashboard: https://localhost:17243 (PID: 12345)
   ```

2. **Open manually**: Copy the URL and paste in browser

3. **Check port availability**:

   ```bash
   # Windows
   netstat -ano | findstr :17243
   
   # macOS/Linux
   lsof -i :17243
   ```

4. **Kill conflicting process** or restart Aspire (it will use different port)

---

## Provider Configuration

### "Unauthorized" (401) with Microsoft Foundry

**Symptoms**: 401 errors when agent tries to call LLM

**Causes**:

1. Invalid API key
2. Expired API key
3. Wrong endpoint URL
4. Key doesn't match endpoint

**Solutions**:

1. **Verify endpoint and key** in [Foundry Portal](https://ai.azure.com):
   - Go to your project
   - Click **Project settings**
   - Copy fresh endpoint and API key

2. **Update user secrets**:

   ```bash
   dotnet user-secrets --file ./apphost.cs set MicrosoftFoundry:Project:Endpoint "https://correct-endpoint.azure.ai"
   dotnet user-secrets --file ./apphost.cs set MicrosoftFoundry:Project:ApiKey "new-key"
   ```

3. **Restart application**: User secrets are loaded at startup

4. **Check logs**:
   - Open Aspire Dashboard
   - Navigate to Agent service logs
   - Look for authentication errors

---

### "DeploymentNotFound" with Azure OpenAI

**Symptoms**: Error about missing deployment

**Cause**: Deployment name in config doesn't match Azure OpenAI

**Solutions**:

1. **Check deployed models** in [Azure OpenAI Studio](https://oai.azure.com):
   - Click **Deployments**
   - Note exact deployment name (case-sensitive)

2. **Update configuration**:

   ```json
   {
     "Azure": {
       "OpenAI": {
         "DeploymentName": "exact-deployment-name"
       }
     }
   }
   ```

3. **Common mistake**: Using model name instead of deployment name
   - ❌ `"DeploymentName": "gpt-4o"` (if deployment is named differently)
   - ✅ `"DeploymentName": "my-gpt4o-deployment"` (actual deployment name)

---

### "Rate limit exceeded" (429) with GitHub Models

**Symptoms**: 429 errors, agent stops responding

**Cause**: GitHub Models free tier limits exceeded

**Solutions**:

**Short-term**:

- Wait 5-10 minutes for limits to reset
- Use `gpt-4o-mini` instead of `gpt-4o` (lower quota usage)

**Long-term**:

- Switch to Foundry or Azure OpenAI for production
- **[Provider setup guides →](providers/README.md)**

**Check limits**: GitHub models typically allow:

- ~15 requests per minute
- ~150K tokens per day

---

## MCP Server Issues

### MCP Tools Not Available to Agent

**Symptoms**: Agent says it can't perform actions (parse documents, save sessions)

**Diagnostics**:

1. **Check Aspire Dashboard**:
   - All MCP services should be "Running"
   - Look for errors in logs

2. **Check agent logs** for MCP registration:

   ```
   info: Registered MCP tool: convert_to_markdown
   info: Registered MCP tool: add_interview_session
   info: Registered MCP tool: get_interview_session
   info: Registered MCP tool: update_interview_session
   info: Registered MCP tool: complete_interview_session
   ```

**Solutions**:

1. **Verify MCP servers are running**:
   - mcp-markitdown (Docker container)
   - mcp-interview-data (Project)

2. **Check Program.cs** has MCP client registration:

   ```csharp
   builder.Services.AddKeyedSingleton<McpClient>("mcp-markitdown", ...);
   builder.Services.AddKeyedSingleton<McpClient>("mcp-interview-data", ...);
   ```

3. **Verify tools added to agent**:

   ```csharp
   tools: [ .. markitdownTools, .. interviewDataTools ]
   ```

4. **Test MCP endpoint directly**:

   ```bash
   curl http://localhost:5001/mcp -H "Content-Type: application/json" -d '{
     "jsonrpc": "2.0",
     "method": "tools/list",
     "id": 1
   }'
   ```

---

### MarkItDown Docker Container Failing

**Symptoms**: "mcp-markitdown" service not starting in Aspire Dashboard

**Causes**:

- Docker not running
- Port 3001 already in use
- MarkItDown not cloned correctly

**Solutions**:

1. **Check Docker is running**:

   ```bash
   docker ps
   ```

   If error, start Docker Desktop

2. **Check port availability**:

   ```bash
   # Windows
   netstat -ano | findstr :3001
   
   # macOS/Linux
   lsof -i :3001
   ```

3. **Verify MarkItDown directory**:

   ```bash
   ls src/InterviewCoach.Mcp.MarkItDown/packages/markitdown-mcp/
   # Should contain: server.py, requirements.txt, Dockerfile
   ```

4. **Rebuild container**:
   - Stop Aspire
   - Delete container: `docker rm interview-coach-mcp-markitdown`
   - Restart: `aspire run --file ./apphost.cs`

---

## Aspire and Service Discovery

### Services Can't Find Each Other

**Symptoms**: "Connection refused" or timeout between services

**Cause**: Service discovery not working correctly

**Solutions**:

1. **Use Aspire service names**, not localhost:

   ```csharp
   // ✅ Correct
   client.BaseAddress = new Uri("https+http://mcp-markitdown");
   
   // ❌ Wrong
   client.BaseAddress = new Uri("http://localhost:3001");
   ```

2. **Check AppHost dependencies**:

   ```csharp
   var agent = builder.AddProject<Projects.InterviewCoach_Agent>("agent")
                      .WithReference(mcpMarkItDown)
                      .WithReference(mcpInterviewData)
                      .WaitFor(mcpMarkItDown)
                      .WaitFor(mcpInterviewData);
   ```

3. **Review Aspire Dashboard**:
   - Resources → Check all services are "Running"
   - Structured Logs → Look for connection errors

---

### WebUI Can't Connect to Agent

**Symptoms**: "Service unavailable" in WebUI

**Diagnostics**:

1. **Check Aspire Dashboard** - Agent service status
2. **Test Agent endpoint**:

   ```bash
   curl https://localhost:<agent-port>/health
   ```

**Solutions**:

1. **Verify WebUI has agent reference** in AppHost.cs:

   ```csharp
   var webUI = builder.AddProject<Projects.InterviewCoach_WebUI>("webui")
                      .WithReference(agent)
                      .WaitFor(agent);
   ```

2. **Check WebUI logs** for connection attempts

3. **Restart both services** via Aspire Dashboard

---

## Database and Persistence

### "Table not found" Errors

**Symptoms**: SQL errors about missing InterviewSession table

**Cause**: Database not initialized

**Solutions**:

1. **Check Program.cs** has database initialization:

   ```csharp
   using (var scope = app.Services.CreateScope())
   {
       var dbContext = scope.ServiceProvider.GetRequiredService<InterviewDataDbContext>();
       dbContext.Database.EnsureCreated();
   }
   ```

2. **Delete and recreate database**:
   - Stop application
   - Delete `.aspire/*.db` files
   - Restart application

3. **If using migrations**:

   ```bash
   cd src/InterviewCoach.Mcp.InterviewData
   dotnet ef database update
   ```

---

### Session Data Not Persisting

**Symptoms**: Interview sessions lost after restart

**Causes**:

- Using in-memory database
- SQLite file in temporary location
- Database file permissions

**Solutions**:

1. **Verify SQLite configuration** in AppHost.cs:

   ```csharp
   var sqlite = builder.AddSqlite(ResourceConstants.Sqlite, databaseFileName: ResourceConstants.DatabaseName)
                       .WithSqliteWeb();
   ```

   Where `ResourceConstants.DatabaseName` is `"interviewcoach.db"`.

2. **Check database file location**:
   - Local: `.aspire/` directory
   - Should persist across restarts

3. **For production**, upgrade to Azure SQL:

   ```csharp
   var sql = builder.AddAzureSqlServer("sql")
                    .AddDatabase("interviewdata");
   ```

---

## Deployment Issues

### `azd up` Fails

**Symptoms**: Error during provisioning or deployment

**Common causes and solutions**:

#### "Subscription not registered for Microsoft.App"

**Solution**:

```bash
az provider register --namespace Microsoft.App
az provider register --namespace Microsoft.ContainerRegistry
# Wait 5-10 minutes for registration
```

#### "Location not available"

**Solution**: Choose different region

```bash
azd env set AZURE_LOCATION eastus2
azd up
```

#### "Insufficient quota"

**Solution**:

- Request quota increase in Azure Portal
- Or choose different region with availability

#### Detailed logs

```bash
azd up --debug  # Verbose output
```

---

### Deployed App Returns 500 Errors

**Symptoms**: App works locally but fails in Azure

**Diagnostics**:

1. **Check Application Insights**:
   - Azure Portal → Your resource group → Application Insights
   - Click **Failures**

2. **Check Container Logs**:
   - Azure Portal → Container App → **Log stream**

3. **Verify environment variables**:
   - Container App → **Configuration** → **Environment variables**
   - Ensure Foundry endpoint and API key are set

**Common issues**:

- Missing environment variables
- Managed Identity not configured
- Foundry endpoint unreachable from Azure region

---

### Container Apps Not Starting

**Symptoms**: Containers in "Provisioning" or "Failed" state

**Solutions**:

1. **Check revision status**:
   - Azure Portal → Container App → **Revisions**
   - Click recent revision → **Console**

2. **Review logs**:

   ```bash
   az containerapp logs show \
     --name interview-coach-agent \
     --resource-group rg-interview-coach \
     --tail 100
   ```

3. **Common fixes**:
   - Increase memory/CPU allocation
   - Fix startup command
   - Ensure container image is valid

---

## Performance Problems

### Slow Response Times

**Symptoms**: Agent takes >10 seconds to respond

**Causes**:

1. Cold start (first request after idle)
2. Large document parsing
3. Complex LLM prompts
4. Network latency to provider

**Solutions**:

1. **Use faster model**:

   ```json
   "DeploymentName": "gpt-4o-mini"
   ```

2. **Enable warm-up** (production):

   ```csharp
   // In agent Program.cs
   app.MapGet("/health", () => Results.Ok());
   ```

   Configure health probe to keep container warm.

3. **Monitor latency**:
   - Aspire Dashboard → Traces
   - Identify slow components

4. **Optimize prompts**:
   - Reduce instruction length
   - More concise tool descriptions

---

### High Memory Usage

**Symptoms**: Container restarting due to OOM

**Causes**:

- Large documents being processed
- Memory leaks
- Too many concurrent requests

**Solutions**:

1. **Increase container memory**:

   ```bash
   az containerapp update \
     --name interview-coach-agent \
     --resource-group rg-interview-coach \
     --memory 1Gi
   ```

2. **Limit document size**:
   - Add validation before parsing
   - Reject documents >10MB

3. **Monitor memory**:
   - Application Insights → Metrics → Memory
   - Set up alerts

---

## Getting More Help

If your issue isn't listed here:

1. **Search existing issues**: [GitHub Issues](https://github.com/Azure-Samples/interview-coach-agent-framework/issues)
2. **Check FAQ**: [FAQ.md](FAQ.md)
3. **Open new issue**: Include:
   - Error message (full text)
   - Steps to reproduce
   - Environment (OS, .NET version, provider)
   - Logs (from Aspire Dashboard or Azure)

---

## Diagnostic Commands

### Check .NET Version

```bash
dotnet --version  # Should be 10.0 or higher
```

### Check Docker

```bash
docker --version
docker ps  # Should show containers if Aspire running
```

### Check Azure CLI

```bash
az --version
az account show  # Verify logged in
```

### Check Aspire

```bash
dotnet workload list  # Should include Aspire
```

### View User Secrets

```bash
dotnet user-secrets --file ./apphost.cs list
```

### Test Endpoints

```bash
# Agent health
curl https://localhost:7048/health

# MCP server
curl http://localhost:5001/mcp -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

---

**Still stuck?** [Open an issue](https://github.com/Azure-Samples/interview-coach-agent-framework/issues/new) with details and we'll help!

---

## Known Issues — Multi-Agent Handoff (Mode 2)

### No response in chat after sending a message (Mode 2 only)

**Symptoms**: You switch to Mode 2 (multi-agent handoff) in `Program.cs`, send
a message in the WebUI, and get no response. The agent logs may show a
`JsonException` with `"'T' is an invalid start of a value"`.

**Cause**: This is a known bug in the Microsoft Agent Framework AG-UI package.
When the handoff workflow transfers control between agents, the internal
transfer tool returns a plain string like `"Transferred."`. The AG-UI serialization
layer tries to parse this as JSON and crashes.

**Upstream issues**:

- [microsoft/agent-framework#2775](https://github.com/microsoft/agent-framework/issues/2775) — JSON parsing exception when Handoff tool returns plain string content
- [microsoft/agent-framework#3962](https://github.com/microsoft/agent-framework/issues/3962) — Duplicate messageId for consecutive TOOL_CALL_RESULT events

**Current workaround**: The file `src/InterviewCoach.Agent/HandoffToolResultFix.cs`
wraps the handoff agent with a streaming middleware that converts plain-string
tool results to `JsonElement` before the AG-UI pipeline processes them. This is
applied automatically in `CreateLlmHandOffWorkflow` and `CreateCopilotHandOffWorkflow`
via the `.CreateFixedAgent()` extension method.

**Mode 1 is unaffected** — the single-agent mode does not use handoff tools and
works without any workaround.

> **Reminder**: Check the upstream issues periodically. When a fixed version of
> `Microsoft.Agents.AI.AGUI` is released, follow the removal steps in
> [docs/plans/PLAN-HANDOFF-AGUI-WORKAROUND.md](plans/PLAN-HANDOFF-AGUI-WORKAROUND.md#4-future-removal-steps-when-upstream-fix-ships)
> to remove the workaround and update packages.
