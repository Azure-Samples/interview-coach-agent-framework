# Troubleshooting reference

Inspect the named failing resource in Aspire before changing prompts. Use the actual dashboard endpoints rather than guessing ports.

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
| AG-UI parsing failure | Client endpoint and the supplied tool-result serialization workaround |
| Repeated intake | Triage context, specialist instructions, and actual handoff edges |
| Chat disappears on refresh | Current UI limitation, not proof the persisted interview record was deleted |

## Relevant files

- [Agent startup](../src/InterviewCoach.Agent/Program.cs)
- [Agent definitions](../src/InterviewCoach.Agent/AgentDelegateFactory.cs)
- [Handoff tool-result adapter](../src/InterviewCoach.Agent/HandoffToolResultFix.cs)
- [Session repository](../src/InterviewCoach.Mcp.InterviewData/InterviewSessionRepository.cs)
- [Root AppHost](../apphost.cs)

## Safe diagnostics

Reproduce with fictional sample inputs. Redact credentials, document contents, and interview transcripts before sharing logs. Describe the exact stage and operation rather than posting only the model's response.

Stopping Aspire stops local processes, not cloud resources. Review the resources owned by your local run separately from an optional `azd` deployment before cleanup.
