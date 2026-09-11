# GitHub Copilot configuration

The standalone application supports GitHub Copilot as an optional model provider. The agents run in the .NET service and use the same InterviewData and MarkItDown services. Run this path from the repository using the main README. The workshop uses Foundry and omits this implementation from its downloads.

## Prerequisites

- A GitHub account with Copilot access
- The [GitHub CLI](https://cli.github.com/) for local authentication

The pinned NuGet package supplies the CLI runtime used by the SDK.

## Configure authentication

For local development, sign in with GitHub CLI:

```bash
# Bash
gh auth login
gh auth status
```

```powershell
# PowerShell
gh auth login
gh auth status
```

The SDK can use environment tokens or stored/local authentication. The application passes an explicit configured token when present; otherwise it sets `UseLoggedInUser` so the SDK can use available local credentials. Keep tokens in private configuration.

For automation or deployment, set `COPILOT_GITHUB_TOKEN`. You can also store `GitHubCopilot:Token` in AppHost user secrets:

```bash
# Bash
dotnet user-secrets --file ./apphost.cs set GitHubCopilot:Token "{{GITHUB_TOKEN}}"
```

```powershell
# PowerShell
dotnet user-secrets --file ./apphost.cs set GitHubCopilot:Token "{{GITHUB_TOKEN}}"
```

Explicit tokens take precedence over ambient credentials. Use a supported fine-grained `github_pat_`, OAuth user, or GitHub App user token with the required Copilot access. Avoid classic `ghp_` personal access tokens for this path. Consult the [SDK authentication reference](https://docs.github.com/copilot/how-tos/copilot-sdk/auth/authenticate).

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

For `401 Bad credentials`, inspect whether an explicit AppHost token is overriding working local authentication. List secrets only in a private terminal; that output can expose their values. Remove an obsolete override to return to local authentication:

```bash
# Bash
dotnet user-secrets --file ./apphost.cs list
dotnet user-secrets --file ./apphost.cs remove GitHubCopilot:Token
gh auth status
```

```powershell
# PowerShell
dotnet user-secrets --file ./apphost.cs list
dotnet user-secrets --file ./apphost.cs remove GitHubCopilot:Token
gh auth status
```

Replace template values such as `{{GITHUB_PAT}}` in private configuration before running.

## Run the app

GitHub Copilot supports both agent modes:

```bash
# Bash
# Multi-agent workflow
aspire start --apphost ./apphost.cs -- --provider GitHubCopilot --mode HandOff

# Single-agent workflow
aspire start --apphost ./apphost.cs -- --provider GitHubCopilot --mode Single
```

```powershell
# PowerShell
# Multi-agent workflow
aspire start --apphost ./apphost.cs -- --provider GitHubCopilot --mode HandOff

# Single-agent workflow
aspire start --apphost ./apphost.cs -- --provider GitHubCopilot --mode Single
```

For the completed project-based AppHost, configure its own settings first. Workshop learners reach this entry point after applying the capstone's support patch:

```bash
# Bash
aspire start --apphost ./src/InterviewCoach.AppHost -- --provider GitHubCopilot --mode HandOff
```

```powershell
# PowerShell
aspire start --apphost ./src/InterviewCoach.AppHost -- --provider GitHubCopilot --mode HandOff
```

`Program.cs` selects `CopilotClientMode.Empty`. The adapter supplies interview instructions and assigned MCP tools; built-in shell, filesystem, and coding tools stay disabled. It also merges handoff instructions and transfer tools supplied at run time. Retain that adapter when comparing modes.

## Usage limits

Requests count against the authenticated account's Copilot usage. See [GitHub Copilot plans](https://docs.github.com/copilot/concepts/billing/individual-plans) for current limits.

## Resources

- [GitHub Copilot SDK](https://github.com/github/copilot-sdk)
- [Copilot SDK authentication](https://docs.github.com/copilot/how-tos/copilot-sdk/auth/authenticate)
- [GitHub Copilot documentation](https://docs.github.com/copilot)
