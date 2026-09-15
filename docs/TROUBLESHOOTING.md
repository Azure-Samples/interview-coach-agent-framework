# Troubleshooting reference

Find the earliest failing operation in the Aspire dashboard. Use the resource's reported endpoint and logs to identify the failed connection or call.

| Failure | Inspect |
| --- | --- |
| SDK or restore failure | `global.json`, package constraints, installed SDK, package feed access |
| Model provisioning failure | Selected subscription/tenant, model/version/region availability, capacity and quota, provisioning permissions |
| Model 401/403 | `DefaultAzureCredential`, tenant selection, resource access and token scope |
| Cosmos emulator fails | Container runtime, platform support, resource logs, local capacity |
| MCP client cannot connect | Resource reference, `/mcp` endpoint, server startup and tool registration |
| Tool never called | Discovered tools, agent's actual tool list, names/descriptions, model invocation |
| Record missing or incorrect | Session ID, exact tool arguments/result, repository update semantics |
| MarkItDown cannot fetch a URL | Reachability from its container, authentication/redirects, parser logs |
| AG-UI parsing failure | `/ag-ui` response status, content type, and stream; for handoffs, the supplied result-serialization adapter |
| Repeated intake | Triage context, specialist instructions, and actual handoff edges |
| Chat disappears on refresh | New Blazor circuit/session; fetch the earlier record through InterviewData |
| Expected resources missing during a lesson | Use root `apphost.cs` throughout the core course; the project-based host is prepared only for optional deployment |
| Optional deployment patch check fails | Compare the named AppHost file with `08-complete`; preserve local edits while resolving the mismatch |

## Relevant files

- [Agent startup](../src/InterviewCoach.Agent/Program.cs)
- [Agent definitions](../src/InterviewCoach.Agent/AgentDelegateFactory.cs)
- [Handoff tool-result adapter](../src/InterviewCoach.Agent/HandoffToolResultFix.cs)
- [Session repository](../src/InterviewCoach.Mcp.InterviewData/InterviewSessionRepository.cs)
- [Root AppHost](../apphost.cs)

## Checks that distinguish similar symptoms

A missing record is a successful tool invocation with no record returned, plus a warning in InterviewData logs. Create a record after confirming that missing-record result. Resolve a failed MCP connection or Cosmos exception before repeating the record operation.

For duplicate transcript text, inspect `update_interview_session` arguments: the repository appends the supplied text. For disappearing resume fields, inspect the same call: it replaces document fields. Follow the [preserve-fields and append-new-text rule](SESSION-DATA.md#update-semantics).

For a missing document, inspect extraction before persistence. The parser container must be able to fetch the URL with its own network access and credentials. Inspect the parser's returned text after upload. The separate [extraction lesson](https://codemillmatt.github.io/interview-coach-agent-framework/workshop/08-document-extraction/) uses a published fictional PDF for that check.

At `05-mcp-server`, use the supplied MCP discovery probe to list tools. The coach gains its InterviewData client in `05-mcp-state`. At `07-interviewers`, technical practice returns to triage; summary generation arrives in `07-handoffs`. Use the expected behavior for your checkpoint when interpreting logs.

The [final debugging lesson](https://codemillmatt.github.io/interview-coach-agent-framework/workshop/14-debugging/) practices a failed document fetch and an early-finish handoff with the completed application.

## Safe diagnostics

Reproduce with fictional sample inputs. Redact credentials, document contents, and interview transcripts before sharing logs. Include the exact stage, operation, and relevant tool result.

Stopping Aspire ends local processes. Cloud resources remain until cleanup. Review the resources owned by each local run and optional `azd` environment using the [cleanup reference](DEPLOYMENT.md#remove-only-the-resources-you-own).
