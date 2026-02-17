# GitHub Models Setup Guide

This guide shows how to configure the Interview Coach application to use GitHub Models for local development and prototyping.

## When to Use GitHub Models

**Perfect for:**

- 🎓 Learning and experimentation
- 🚀 Rapid prototyping without Azure setup
- 💻 Local development and testing
- 🎪 Quick demos and POCs
- 📚 Following tutorials

**NOT recommended for:**

- ❌ Production deployments
- ❌ Applications handling sensitive/confidential data
- ❌ High-volume or commercial use
- ❌ Scenarios requiring SLAs or guaranteed availability

**For production**, use [Microsoft Foundry](MICROSOFT-FOUNDRY.md) or [Azure OpenAI](AZURE-OPENAI.md).

[Compare providers →](README.md)

## What is GitHub Models?

[GitHub Models](https://github.com/marketplace/models) is a free service that lets you:

- Access AI models directly from GitHub
- Experiment with models from OpenAI, Meta, Microsoft, and more
- Test and prototype without cloud setup
- No credit card required (with rate limits)

## Prerequisites

- GitHub account ([Sign up free](https://github.com/signup))
- .NET 10 SDK ([Download](https://dotnet.microsoft.com/download/dotnet/10.0))
- Git installed

## Step 1: Get GitHub Personal Access Token

You need a GitHub Personal Access Token (PAT) with `models:read` scope.

### Create PAT

1. Go to [GitHub Settings → Developer settings → Personal access tokens → Tokens (fine-grained)](https://github.com/settings/tokens?type=beta)
2. Click **Generate new token**
3. Fill in details:
   - **Token name**: `interview-coach-dev`
   - **Expiration**: 90 days (or your preference)
   - **Resource owner**: Your username
4. Under **Repository access**: Select **Public Repositories (read-only)** (models are public)
5. Under **Permissions**, expand **Account permissions**
6. Find **GitHub Models** and set to **Read-only**
   - This gives you the `models:read` scope
7. Click **Generate token**
8. **Copy the token immediately** (you won't see it again!)

**Alternative: Classic token** (simpler but broader permissions):

1. Go to [Personal access tokens (classic)](https://github.com/settings/tokens)
2. Generate new token (classic)
3. Check only: `read:org` (which includes model access)
4. Generate and copy

## Step 2: Store Token Securely

**Option A: User Secrets (Recommended)**

```bash
# Navigate to repository root
cd /path/to/interview-coach-agent-framework

# Store GitHub token
dotnet user-secrets --file ./apphost.cs set GitHub:Token "ghp_your_token_here"
```

**Option B: Environment Variable**

```powershell
# PowerShell (Windows)
$env:GITHUB_TOKEN = "ghp_your_token_here"
```

```bash
# Bash (macOS/Linux)
export GITHUB_TOKEN="ghp_your_token_here"
```

## Step 3: Configure Application

Edit `apphost.settings.json`:

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },

  "LlmProvider": "GitHubModels",

  "GitHub": {
    "Endpoint": "https://models.github.ai/inference",
    "Token": "{{GITHUB_PAT}}",
    "Model": "openai/gpt-4o-mini"
  }
}
```

**Important**: Don't paste your actual token here! Use `{{GITHUB_PAT}}` and the token will be loaded from user secrets.

### Available Models

GitHub Models hosts various providers:

**OpenAI Models:**

- `openai/gpt-4o` - Latest GPT-4 (recommended for quality)
- `openai/gpt-4o-mini` - Faster, cheaper (recommended for dev)
- `openai/gpt-4-turbo` - Previous generation
- `openai/o1-preview` - Reasoning model (slower, expensive)

**Meta Models:**

- `meta/llama-3.2-11b-vision-instruct`
- `meta/llama-3.2-90b-vision-instruct`

**Microsoft Models:**

- `microsoft/phi-3.5-mini-instruct`
- `microsoft/phi-3.5-moe-instruct`

**AI21 Models:**

- `ai21/jamba-1.5-mini`
- `ai21/jamba-1.5-large`

Browse all models at [github.com/marketplace/models](https://github.com/marketplace/models).

**For this application, stick with OpenAI models** as they're best suited for conversational agents:

```json
"Model": "openai/gpt-4o-mini"  // Recommended for development
```

## Step 4: Run the Application

```bash
# Using file-based Aspire
aspire run --file ./apphost.cs

# OR using project-based Aspire
aspire run --project ./src/InterviewCoach.AppHost
```

### Verify Configuration

1. Aspire Dashboard opens
2. Check Agent console logs for:

   ```
   info: Using GitHubModels: openai/gpt-4o-mini
   ```

3. Navigate to webui endpoint
4. Test the interview coach

## Rate Limits and Quotas

GitHub Models has usage limits:

### Free Tier Limits (as of 2026)

- **Requests**: ~15 requests per minute
- **Tokens**: ~150,000 tokens per day
- **Concurrent requests**: 5

These limits are **sufficient for development** but not for production.

### What Happens When You Hit Limits?

You'll see errors like:

```
Error 429: Rate limit exceeded. Please try again later.
```

**Solutions:**

- Wait a few minutes and retry
- Use a smaller model (`gpt-4o-mini` instead of `gpt-4o`)
- Reduce conversation length
- For production, upgrade to Foundry/Azure OpenAI

## Troubleshooting

### Error: "Missing configuration: GitHub:Token"

**Cause**: Token not set in user secrets.

**Solution**:

```bash
dotnet user-secrets --file ./apphost.cs set GitHub:Token "ghp_your_token_here"
```

### Error: "Unauthorized" (401)

**Cause**: Invalid or expired token.

**Solution**:

1. Verify token has `models:read` scope
2. Check if token expired (regenerate if needed)
3. Ensure no extra spaces when copying token

### Error: "Rate limit exceeded" (429)

**Cause**: Hit GitHub Models rate limits.

**Solutions**:

- **Wait**: Limits reset after a few minutes
- **Use mini model**: Switch to `gpt-4o-mini` (cheaper on quota)
- **Reduce usage**: Fewer test conversations
- **For heavy use**: Switch to Azure OpenAI or Foundry

### Error: "Model not found"

**Cause**: Typo in model name or model no longer available.

**Solution**: Check available models at [github.com/marketplace/models](https://github.com/marketplace/models) and update:

```json
"Model": "openai/gpt-4o-mini"  // Exact name from marketplace
```

### Slow Responses

**Causes**:

- GitHub Models is a free service (no SLA)
- High load on free tier
- Using large models (gpt-4o, o1-preview)

**Solutions**:

- Use `gpt-4o-mini` for faster responses
- For production speed, switch to Foundry/Azure OpenAI

## Limitations

GitHub Models is great for learning but has constraints:

| Aspect | GitHub Models | Foundry/Azure OpenAI |
|--------|--------------|---------------------|
| **Cost** | Free (with limits) | Pay-per-use |
| **Rate Limits** | ~15 RPM | Thousands RPM |
| **SLA** | None | 99.9% uptime |
| **Data Privacy** | Subject to GitHub terms | Your Azure tenant |
| **Production Ready** | ❌ No | ✅ Yes |
| **Setup Time** | ~5 minutes | ~10 minutes |
| **Good For** | Learning, prototyping | Production apps |

## Development Workflow

Recommended development flow:

1. **Start with GitHub Models** for initial development
2. **Switch to Foundry** when:
   - Hitting rate limits frequently
   - Ready for team collaboration
   - Preparing for production
   - Need better quality/consistency

Switching is easy - just change configuration! (See below)

## Switching to Production Provider

### From GitHub Models → Foundry

1. Create Foundry project ([guide](MICROSOFT-FOUNDRY.md))
2. Update `apphost.settings.json`:

   ```json
   "LlmProvider": "MicrosoftFoundry"
   ```

3. Set Foundry credentials (see guide)
4. Restart app

No code changes needed!

### From GitHub Models → Azure OpenAI

1. Create Azure OpenAI resource ([guide](AZURE-OPENAI.md))
2. Update `apphost.settings.json`:

   ```json
   "LlmProvider": "AzureOpenAI"
   ```

3. Set Azure OpenAI credentials (see guide)
4. Restart app

## Best Practices for GitHub Models

✅ **Use for development only** - Not for production  
✅ **Prefer `gpt-4o-mini`** - Faster, less quota impact  
✅ **Keep conversations short** - Conserve token quota  
✅ **Commit without tokens** - Use user secrets, never commit tokens to Git  
✅ **Rotate tokens periodically** - Good security practice  
✅ **Plan migration path** - Know when to upgrade to Foundry  

## Security Notes

### Token Safety

⚠️ **Never commit your GitHub PAT to Git!**

```bash
# Check if token is in files (should return nothing)
git grep "ghp_"

# Make sure user secrets are never committed
# (They're stored in ~/.microsoft/usersecrets/, not in your repo)
```

### Token Permissions

GitHub PATs for models should have **minimal permissions**:

- ✅ Only `models:read` (fine-grained token)
- ✅ Or just `read:org` (classic token)
- ❌ No repo write access
- ❌ No admin permissions

### Revoke Compromised Tokens

If you accidentally commit or share your token:

1. Go to [GitHub Settings → Personal access tokens](https://github.com/settings/tokens)
2. Find the token
3. Click **Delete** or **Revoke**
4. Generate a new token
5. Update user secrets

## Cost Comparison

| Provider | Monthly Cost (Est. for 1000 interviews) |
|----------|----------------------------------------|
| GitHub Models | **$0** (free with rate limits) |
| Foundry (model-router) | ~$15-30 |
| Azure OpenAI (gpt-4o-mini) | ~$20-40 |
| Azure OpenAI (gpt-4o) | ~$100-200 |

GitHub Models is free but **not suitable for production scale**.

## Next Steps

- 🎯 [Run the Application](../../README.md)
- 📚 [Follow Tutorials](../TUTORIALS.md)
- 🏗️ [Understand Architecture](../ARCHITECTURE.md)
- 🔄 [Compare Providers](README.md)
- 🚀 [Upgrade to Foundry](MICROSOFT-FOUNDRY.md) when ready for production

## Resources

- [GitHub Models Documentation](https://docs.github.com/github-models)
- [Available Models](https://github.com/marketplace/models)
- [Personal Access Tokens Guide](https://docs.github.com/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)
- [GitHub Models Terms of Service](https://docs.github.com/site-policy/github-terms/github-terms-for-additional-products-and-features#github-models)

---

**Happy prototyping! 🚀** When you're ready for production, check out [Microsoft Foundry](MICROSOFT-FOUNDRY.md).
