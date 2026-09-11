# Deployment and cleanup reference

Container Apps deployment is an optional task after the completed capstone. It hosts the existing .NET services; the agents execute in `InterviewCoach.Agent` and call the configured model provider. Use an approved, access-restricted development environment with fictional interview data.

**A local AppHost start can provision billable Foundry resources. Cloud resources remain until cleanup.** Keep a private inventory for the completed-example run, learner app, and any `azd` environment.

## Check the deployment entry point

The completed project's `azure.yaml` points to `src/InterviewCoach.AppHost/InterviewCoach.AppHost.csproj` with `host: containerapp`. Review that project's `appsettings.json`. Root `apphost.settings.json` configures the separate file-based AppHost.

The repository source already contains the completed graph. In workshop downloads, the project-based AppHost and its settings stay in their cloud-free starter state through `07-handoffs`. Finish the required supplied-support step in [the capstone](https://codemillmatt.github.io/interview-coach-agent-framework/workshop/13-capstone/) before deployment.

That step uses the source-only `08-complete-support.patch`. It restores the pinned agent `Program.cs`, deployment AppHost and settings, and removes the temporary hosting helper and MCP probe. It also restores topology comments in `AgentDelegateFactory.cs`; all agent definitions and prompts stay unchanged. The capstone displays every affected file and provides a `git apply --check` command before application. Keep local work if the check fails and compare the named file with the preceding checkpoint. The support patch excludes `WORKSHOP.txt` and secrets.

For entry-point details, see [architecture](ARCHITECTURE.md#local-and-deployed-entry-points) and [configuration](CONFIGURATION.md#entry-points-and-precedence). The workshop pins source revision `68fd993f39643d7b458bf1798094be953a1020a5`; optional deployment uses that completed application.

## Review access and data handling

Review these sample behaviors before making an endpoint available to anyone else:

| Area | Sample behavior and review |
| --- | --- |
| Development interfaces | The agent registers DevUI with remote access and maps DevUI and OpenAI-compatible endpoints in both development and deployed environments. Restrict who can reach them. |
| Interview records | MCP tools accept supplied IDs, and the list operation returns all records. Implement caller authentication and record-ownership checks before real-user access. |
| Uploads | The agent accepts files up to 10 MiB and holds bytes in a process-wide dictionary. Upload routes have no per-user ownership or per-session deletion mechanism. Plan aggregate memory limits, access controls, and retention. |
| Document content | Treat extracted text as untrusted interview context. Keep instructions and tool authorization under application control. |
| Logs and diagnostics | Tool arguments, document text, session IDs, and transcripts can appear in diagnostic output. Use fictional inputs and redact shared logs. |
| Saved data | Cosmos stores document fields and transcript text. Choose a retention and backup policy; test retry behavior against the [update contract](SESSION-DATA.md#update-semantics). |

The [upload reference](USER-MANUAL.md#upload-contract) covers file handling. These are review areas for a learning sample; any wider use requires implementation and verification for its intended users.

## Provision an approved development environment

Before provisioning, confirm the tenant, subscription, region, configured model/version, capacity and quota, resource group, and cleanup owner. Review [Aspire deployment guidance](https://learn.microsoft.com/dotnet/aspire/deployment/azure/aca-deployment) and [Foundry authorization guidance](https://learn.microsoft.com/azure/ai-foundry/concepts/rbac-azure-ai-foundry) for your environment. Check the deployed application's identity separately from your local CLI identity.

Install the [Azure Developer CLI](https://learn.microsoft.com/azure/developer/azure-developer-cli/install-azd). From the completed project root:

```bash
# Bash
azd auth login
azd init
```

```powershell
# PowerShell
azd auth login
azd init
```

Choose a named development environment you own. Inspect the selected environment with:

```bash
# Bash
azd env list
azd env get-values
```

```powershell
# PowerShell
azd env list
azd env get-values
```

Keep environment output private because it can contain sensitive configuration. Review the resource scope, subscription, location, and potential cost before proceeding:

```bash
# Bash
azd up
```

```powershell
# PowerShell
azd up
```

The selected provider remains your choice of Microsoft Foundry or GitHub Copilot. Follow its [authentication reference](providers/README.md) and keep credentials in private configuration.

## Check the deployed application

Inspect resource health and model access, then follow the service path: WebUI -> agent -> both MCP servers, and InterviewData -> Cosmos. The deployment graph provisions managed Cosmos resources; local run mode uses the preview emulator.

Run the capstone's short synthetic interview. Check the tool invocations, handoffs, saved transcript, summary, and completion flag. Record the actual results and any failing operation. A deployment review also includes endpoint exposure, identity, document reachability, and retained data.

For a failure, inspect the named operation and resource logs before retrying. Model quota, identity permissions, and container startup each need their own diagnosis. Reuse the intended environment while investigating so its resource inventory stays clear.

## Remove only the resources you own

For a local AppHost, run this from the folder that started it:

```bash
# Bash
aspire stop --apphost ./apphost.cs
```

```powershell
# PowerShell
aspire stop --apphost ./apphost.cs
```

This stops local orchestration. **Cloud resources remain until cleanup.** Use the inventory from that run to identify its Azure resources and review them with the cleanup owner.

For an `azd` deployment, confirm the selected environment and the resources it owns:

```bash
# Bash
azd env list
```

```powershell
# PowerShell
azd env list
```

If needed, select the intended environment with `azd env select ENVIRONMENT_NAME`, replacing the placeholder with its recorded name. Review retained data and the deletion scope before running:

```bash
# Bash
azd down
```

```powershell
# PowerShell
azd down
```

Keep the interactive removal review; avoid force or purge flags in the workshop. The [Azure Developer CLI reference](https://learn.microsoft.com/azure/developer/azure-developer-cli/reference) describes the command's scope.

Compare remaining Azure resources with the inventories for each run:

| Run | Cleanup scope |
| --- | --- |
| Completed-example AppHost | Resources recorded for that folder and provisioning context |
| Learner AppHost | Resources recorded for the learner's working folder and context |
| Optional `azd` deployment | Resources owned by the selected `azd` environment |

Separate folders can have separate resource groups or environments. Confirm removal for each owned scope, including resources left after failed provisioning. Preserve shared resources. Local emulator data and process-memory uploads have their own lifetimes; review [state ownership](SESSION-DATA.md#state-ownership) before removing development storage.
