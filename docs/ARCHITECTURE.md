# Architecture reference

The Interview Coach is a .NET application with a Blazor UI, an Agent Framework service, two MCP servers, and a Cosmos DB store. For a guided build, use the [workshop](https://codemillmatt.github.io/interview-coach-agent-framework/workshop/).

## Runtime responsibilities

| Component | Implementation | Responsibility |
| --- | --- | --- |
| UI | `src/InterviewCoach.WebUI` | Displays chat, sends messages and uploads, renders streamed AG-UI replies |
| Agent service | `src/InterviewCoach.Agent` | Constructs agents, connects a model provider, invokes tools, exposes `/ag-ui` |
| InterviewData MCP | `src/InterviewCoach.Mcp.InterviewData` | Session tools backed by the supplied EF Core Cosmos repository |
| MarkItDown MCP | `mcp/markitdown` container | Converts reachable document URLs into text |
| Aspire | `apphost.cs` and `src/InterviewCoach.AppHost` | Starts resources, supplies references/configuration, and orders dependencies |
| Service defaults | `src/InterviewCoach.ServiceDefaults` | Shared health, service discovery, HTTP, and telemetry setup |

The default Foundry path creates an OpenAI-compatible client, adapts it to `IChatClient`, and uses it to construct `ChatClientAgent` instances. **The model runs in Foundry; the agents execute in this application's .NET process.** This repository does not host the agents in Foundry Agent Service.

The alternative Copilot path uses the Agent Framework Copilot adapter. Provider selection and agent mode are independent. See [configuration](CONFIGURATION.md) and [agent modes](MULTI-AGENT.md).

## Request and tool flow

1. The Blazor component sends messages through `AGUIChatClient` to the agent's `/ag-ui` endpoint.
2. Agent Framework runs the selected agent or handoff workflow.
3. The model can propose tool calls. Application code invokes the appropriate MCP client.
4. InterviewData accesses Cosmos, or MarkItDown converts a document.
5. Tool results return to the agent; the response streams back to the UI.

MCP and AG-UI solve different boundaries: MCP connects agent-side tools; AG-UI connects the frontend to the agent service.

## Handoff topology

Triage starts the workflow and chooses a specialist using conversation context. It has no application MCP tools and does not create the session. Receptionist owns session setup and document intake.

The normal progression is Receptionist -> Behavioural Interviewer -> Technical Interviewer -> Summariser. Each specialist can return to Triage for an out-of-order request; Summariser returns to Triage after completing the summary. See the exact tool assignments in [agent modes](MULTI-AGENT.md).

Handoffs are model-directed within the configured graph. The graph and prompts do not guarantee that every conversation follows the intended path.

## Local and deployed entry points

The quick start uses the root [file-based AppHost](../apphost.cs). It loads `apphost.settings.json`. The [project-based AppHost](../src/InterviewCoach.AppHost/AppHost.cs) is the target named by `azure.yaml` for Container Apps deployment and uses its project configuration.

Both describe the same service topology, but their configuration-loading code is not identical. Do not assume editing a root JSON setting changes every deployment entry point.

In local run mode, Cosmos uses a preview emulator container. Foundry resources can still be provisioned in Azure during a local run. The final app also starts the MarkItDown container.

## State and uploads

Cosmos stores interview records, including document fields, transcript text, and completion state. The UI creates a new session ID and maintains a message list in memory. There is no implemented session-picker or browser-refresh recovery flow. See [session and data contracts](SESSION-DATA.md).

Uploaded bytes are stored in the agent process's memory. Their URLs are not durable document storage.

## Sample boundaries

This is not a complete production access-control or data-retention design. Development interfaces are mapped in the agent service, tools operate on supplied IDs, and document-derived content is untrusted. Review authentication, per-user authorization, endpoint exposure, upload retention, logging, and failure handling before deploying for real users.
