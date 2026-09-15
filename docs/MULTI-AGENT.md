# Agent modes

`AgentMode` selects orchestration; `LlmProvider` selects the provider. The reference implements `Single` and `HandOff` for Microsoft Foundry and GitHub Copilot. The workshop builds the graph in three lessons: [first handoff](https://codemillmatt.github.io/interview-coach-agent-framework/workshop/10-first-handoff/), [interviewers](https://codemillmatt.github.io/interview-coach-agent-framework/workshop/11-interviewers/), and [summary agent](https://codemillmatt.github.io/interview-coach-agent-framework/workshop/12-handoffs/).

## Select a mode

Set `AgentMode` in `apphost.settings.json`, or override it when starting the root AppHost:

```bash
# Bash
aspire start --apphost ./apphost.cs -- --provider MicrosoftFoundry --mode Single
aspire start --apphost ./apphost.cs -- --provider MicrosoftFoundry --mode HandOff
```

```powershell
# PowerShell
aspire start --apphost ./apphost.cs -- --provider MicrosoftFoundry --mode Single
aspire start --apphost ./apphost.cs -- --provider MicrosoftFoundry --mode HandOff
```

Run one mode at a time and start a new chat after changing it. The project-based AppHost uses its own configuration; see [configuration](CONFIGURATION.md).

## Single mode

`CreateSingleAgent` gives one agent both MarkItDown and InterviewData tools. Its instructions cover session setup, optional documents, behavioural and technical questions, transcript updates, and a final summary.

One agent has fewer routing decisions to debug. Keep this mode as a comparison while deciding whether a responsibility needs its own instructions, tool access, and routing.

## HandOff mode

`CreateHandOffWorkflow` creates five agents. They share the configured provider/model and transfer control between interview phases.

| Agent name | Responsibility | Application tools |
| --- | --- | --- |
| `triage` | Select the phase using conversation context | None |
| `receptionist` | Fetch/create the session and gather documents | MarkItDown and InterviewData |
| `behavioural_interviewer` | Ask behavioural questions and append feedback | InterviewData |
| `technical_interviewer` | Ask technical questions and append feedback | InterviewData |
| `summariser` | Read the transcript, save a summary, mark completion | InterviewData |

These are the permitted edges:

| Source | Targets |
| --- | --- |
| Triage | Receptionist, behavioural interviewer, technical interviewer, summariser |
| Receptionist | Behavioural interviewer, triage |
| Behavioural interviewer | Technical interviewer, triage |
| Technical interviewer | Summariser, triage |
| Summariser | Triage |

The eleven edges include direct specialist transfers for normal progression and return paths to triage for out-of-order requests. Triage's instructions consider completed phases to reduce repeated intake. The model chooses among permitted routes; inspect the actual transfers during a run.

Tool scope controls which calls an agent can request. Per-user record authorization belongs at the MCP service boundary and requires an ownership check before using real users' records.

## Workshop handoff stages

| Checkpoint | Available roles | End of the practice path |
| --- | --- | --- |
| `07-first-handoff` | Triage and receptionist | Receptionist finishes intake; triage handles a changed request |
| `07-interviewers` | Triage, receptionist, behavioural and technical interviewers | Technical interviewer returns to triage for another phase or to finish |
| `07-handoffs` | All five roles | Summariser saves feedback and completes the record |

The four-agent stage introduces behavioural-to-technical practice using saved context. Summary generation and its routes arrive in `07-handoffs`. The full single-agent baseline remains available throughout these stages. The [debugging lesson](https://codemillmatt.github.io/interview-coach-agent-framework/workshop/13-debugging/) uses the completed graph to examine an early-finish request.

## Hosting adapter

`AddHandOffWorkflow` registers the workflow with `AddWorkflow`, resolves it by key, then calls `AsAIAgent` so the same hosted endpoint can expose it. The supplied `CreateFixedAgent` middleware adapts plain-string tool results to `JsonElement` for this application's pinned AG-UI path. Retain that version-specific compatibility layer while completing the workshop.

The Foundry branch creates `ChatClientAgent` instances using `IChatClient`. The Copilot branch uses `CopilotClient.AsAIAgent` and merges per-run handoff tools/instructions through its adapter. Check runtime behavior with each provider when comparing the same graph.

See [AgentDelegateFactory.cs](../src/InterviewCoach.Agent/AgentDelegateFactory.cs), [the result adapter](../src/InterviewCoach.Agent/HandoffToolResultFix.cs), and Microsoft's [handoff documentation](https://learn.microsoft.com/agent-framework/workflows/orchestrations/handoff).
