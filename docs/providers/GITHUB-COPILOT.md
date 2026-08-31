# GitHub Copilot setup

Use GitHub Copilot as the model backend without provisioning an Azure model deployment.

## Prerequisites

- A GitHub account with Copilot access
- The [GitHub CLI](https://cli.github.com/) for local authentication

The NuGet package includes the Copilot CLI runtime used by the SDK. You do not need to install it separately.

## Configure authentication

For local development, sign in with GitHub CLI:

```bash
gh auth login
gh auth status
```

The SDK checks `COPILOT_GITHUB_TOKEN`, `GH_TOKEN`, stored Copilot credentials, and GitHub CLI credentials. The application does not require a token in `appsettings.json`.

For automation or deployment, set `COPILOT_GITHUB_TOKEN`. You can also store `GitHubCopilot:Token` in AppHost user secrets:

```bash
dotnet user-secrets --file ./apphost.cs set GitHubCopilot:Token "{{GITHUB_TOKEN}}"
```

Explicit tokens take precedence over ambient credentials. Classic personal access tokens with the `ghp_` prefix are not supported. Use a fine-grained `github_pat_` token, an OAuth user token, or a GitHub App user token.

> [!NOTE]
> `aspire start --isolated` uses an isolated user-secrets scope. Prefer GitHub CLI authentication for isolated runs, or set the token in that isolated AppHost instance.

## Choose a model

The app defaults to `gpt-5-mini`. To request a different model, update `apphost.settings.json`:

```json
{
  "GitHubCopilot": {
    "Model": "gpt-5-mini"
  }
}
```

Model availability depends on the Copilot plan and organization policy. Use `CopilotClient.ListModelsAsync()` when you need to discover the models available to the authenticated account.

## Troubleshoot authentication

`401 Bad credentials` means an explicit token was rejected. Check or remove the configured AppHost secret so the SDK can use GitHub CLI authentication:

```bash
dotnet user-secrets --file ./apphost.cs list
dotnet user-secrets --file ./apphost.cs remove GitHubCopilot:Token
gh auth status
```

Do not leave template values such as `{{GITHUB_PAT}}` in configuration.

## Run the app

GitHub Copilot supports both agent modes:

```bash
# Multi-agent workflow
aspire start --apphost ./apphost.cs -- --provider GitHubCopilot --mode HandOff

# Single-agent workflow
aspire start --apphost ./apphost.cs -- --provider GitHubCopilot --mode Single
```

For the project-based AppHost:

```bash
aspire start --apphost ./src/InterviewCoach.AppHost -- --provider GitHubCopilot --mode HandOff
```

The SDK runs in empty mode. Copilot receives the interview instructions and the MCP tools assigned to each agent, but it does not receive Copilot CLI's built-in shell, filesystem, or coding tools.

## Usage limits

Requests count against the authenticated account's Copilot usage. See [GitHub Copilot plans](https://docs.github.com/copilot/concepts/billing/individual-plans) for current limits.

## Resources

- [GitHub Copilot SDK](https://github.com/github/copilot-sdk)
- [Copilot SDK authentication](https://docs.github.com/copilot/how-tos/copilot-sdk/auth/authenticate)
- [GitHub Copilot documentation](https://docs.github.com/copilot)
