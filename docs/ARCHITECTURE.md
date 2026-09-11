# Architecture reference

This page maps the completed application's processes and request path. Use it as a reference whether you're running the finished application or learning to build it. To implement the agent connections yourself, the [workshop](https://codemillmatt.github.io/interview-coach-agent-framework/workshop/) guides you through each step. Chapter 0 combines tool setup with a run of the finished example.

## Runtime responsibilities

| Component | Implementation | Responsibility |
| --- | --- | --- |
| WebUI server | `src/InterviewCoach.WebUI` | Runs server-interactive Blazor components, calls the agent through AG-UI, and renders updates to the browser |
| Agent service | `src/InterviewCoach.Agent` | Constructs agents, connects a model provider, invokes tools, exposes `/ag-ui` |
| InterviewData MCP | `src/InterviewCoach.Mcp.InterviewData` | Session tools backed by the supplied EF Core Cosmos repository |
| MarkItDown MCP | `mcp/markitdown` container | Converts reachable document URLs into text |
| Aspire | `apphost.cs` and `src/InterviewCoach.AppHost` | Starts resources, supplies references/configuration, and orders dependencies |
| Service defaults | `src/InterviewCoach.ServiceDefaults` | Shared health, service discovery, HTTP, and telemetry setup |

The Foundry branch in `Program.cs` creates an OpenAI-compatible `ChatClient` and registers `client.AsIChatClient()`. `CreateProviderAgent` resolves that model client and constructs a `ChatClientAgent` with a name, instructions, and tools. The model runs in Foundry; the agents execute in this application's .NET process.

The alternative Copilot path uses the Agent Framework Copilot adapter. Provider selection and agent mode are independent. See [configuration](CONFIGURATION.md) and [agent modes](MULTI-AGENT.md).

## Request and tool flow

1. The browser sends input to its server-side Blazor component. The WebUI server's `AGUIChatClient` sends messages to the agent's `/ag-ui` endpoint.
2. Agent Framework runs the selected agent or handoff workflow.
3. The model can request a tool call. Agent Framework invokes a discovered tool through the appropriate keyed MCP client.
4. InterviewData accesses Cosmos, or MarkItDown converts a document.
5. Tool results return to the agent; its response streams back to the WebUI server, which updates the browser through Blazor.

The WebUI registers `AddInteractiveServerComponents` and uses `InteractiveServerRenderMode(prerender: false)`. Its C# chat component runs in a server-side circuit. MCP connects agent-side tools; AG-UI connects the WebUI server to the agent service. See [state ownership](SESSION-DATA.md#state-ownership) for message accounting and refresh behavior.

## Handoff topology

Triage starts the workflow and chooses a specialist using conversation context. Its tools handle transfers. Receptionist has the application MCP tools for session setup and document intake.

The usual interview path is Triage -> Receptionist -> Behavioural Interviewer -> Technical Interviewer -> Summariser. Each specialist can return to Triage for an out-of-order request; Summariser returns to Triage after completing the summary. The introductory workshop diagram shows this usual path. The [agent-mode reference](MULTI-AGENT.md#handoff-mode) lists all eleven permitted edges and the exact tool assignments.

The five roles share the selected model deployment and transfer control between phases. Handoffs are model-directed within the configured graph, so check the actual route during a run.

## Local and deployed entry points

The quick start uses the root [file-based AppHost](../apphost.cs). It loads `apphost.settings.json`. The [project-based AppHost](../src/InterviewCoach.AppHost/AppHost.cs) is the target named by `azure.yaml` for Container Apps deployment and uses its project configuration.

In the completed source, both describe the full service topology. Each entry point loads its own configuration; review the settings for the one you run. The project-based host also explicitly forwards `AZURE_TENANT_ID`. See [configuration](CONFIGURATION.md#entry-points-and-precedence).

In local run mode, Cosmos uses a preview emulator container. Foundry resources can still be provisioned in Azure during a local run. The final app also starts MarkItDown using the reference's `latest` image tag. Record its image digest when comparing runtime results.

## Workshop scaffold and finalization

The workshop starter supplies the Blazor UI, repository, service defaults, and `WorkshopHosting.cs`. That helper contains Foundry model/authentication and DevUI code derived from the tagged reference's `Program.cs`. It is inactive in the starter, which runs a cloud-free shell. The workshop packages only the Foundry path; the standalone repository retains both providers.

In `03-first-coach`, learners implement the `ChatClientAgent` constructor and coaching instructions before activating the helper and model reference. Streaming, MCP clients, and workflow connections arrive in later lessons. This keeps the first exercise focused on creating an agent while leaving the supplied startup code available to inspect.

Learners edit only root `apphost.cs` for orchestration. The project-based AppHost and its settings remain in the starter state through `07-handoffs`. At the capstone, the required `08-complete-support.patch` restores the exact pinned `Program.cs` and deployment AppHost/configuration, then removes `WorkshopHosting.cs` and the MCP discovery probe. It also restores topology comments in `AgentDelegateFactory.cs`; all agent definitions and prompts stay unchanged. Every change belongs to the supplied edit contract and is included in replay and final-source parity.

The patch contains source changes only and excludes `WORKSHOP.txt` and secrets. The capstone displays its file list and requires a successful `git apply --check` before application. Complete that step before using the [optional deployment entry point](DEPLOYMENT.md#check-the-deployment-entry-point).

## State and uploads

Cosmos stores interview records, including document fields, transcript text, and completion state. The server-side Blazor component holds its message list and session ID in circuit memory. A browser refresh creates a new circuit and session. Earlier records can be fetched through InterviewData; UI conversation recovery would require additional implementation. See [session and data contracts](SESSION-DATA.md).

Uploaded bytes are stored in the agent process's memory. The UI puts the returned URL into the chat, and MarkItDown must fetch it from its own container. Inspect the extraction result before using it as interview context. The [upload contract](USER-MANUAL.md#upload-contract) covers limits and retention.

## Sample boundaries

Use this learning sample in an access-restricted environment with fictional inputs. Development interfaces are mapped in the agent service, tools operate on supplied IDs, and document-derived content is untrusted. The [deployment reference](DEPLOYMENT.md#review-access-and-data-handling) describes the access-control and retention work to review before use with real users.

## Changing the hosting model

The optional Container Apps deployment hosts the existing .NET services. Moving agent execution into Foundry Agent Service is a separate architecture change. `LlmProvider` selects one of the two implemented model-provider paths.

For a managed-agent migration, choose a runtime and definition format using the [Foundry Agent Service documentation](https://learn.microsoft.com/azure/ai-foundry/agents/overview). Map the identity and network path to both MCP servers, decide who owns conversation state, and trace the response back through `/ag-ui` to the Blazor client. That migration needs its own implementation and lifecycle, permissions, networking, and retention checks.
