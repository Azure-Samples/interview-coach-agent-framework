# Learning objectives

The [workshop](https://codemillmatt.github.io/interview-coach-agent-framework/workshop/) teaches Microsoft Agent Framework and Foundry in 15 lessons, numbered 0 through 14. You run an example, open a separate starter, and keep building in that working folder.

The starter supplies the Blazor UI, EF Core repository, service defaults, and source-derived `WorkshopHosting.cs`. The hosting helper stays inactive in the cloud-free shell. The first-agent exercise focuses on writing the `ChatClientAgent` constructor and instructions, then activating the supplied model/authentication and DevUI plumbing. Core orchestration edits use root `apphost.cs`.

| Lesson | What you practice and observe |
| --- | --- |
| [0. Get ready and try the interview coach](https://codemillmatt.github.io/interview-coach-agent-framework/workshop/00-orientation/) | Check tools and resource ownership, then try a short interview in the completed example |
| [1. Start your workshop app](https://codemillmatt.github.io/interview-coach-agent-framework/workshop/01-starter/) | Run the cloud-free application shell in your own working folder |
| [2. Ask your first agent a question](https://codemillmatt.github.io/interview-coach-agent-framework/workshop/02-first-coach/) | Construct a `ChatClientAgent`, set its instructions, activate model access, and get a reply |
| [3. Put the coach in the chat UI](https://codemillmatt.github.io/interview-coach-agent-framework/workshop/03-streaming/) | Connect AG-UI and observe a streamed response |
| [4. Give the coach a C# tool](https://codemillmatt.github.io/interview-coach-agent-framework/workshop/04-tools/) | Describe and register a function, then inspect an invocation |
| [5. Expose interview tools with MCP](https://codemillmatt.github.io/interview-coach-agent-framework/workshop/05-mcp-server/) | Run InterviewData and discover the tools exposed by its server |
| [6. Connect the coach to those tools](https://codemillmatt.github.io/interview-coach-agent-framework/workshop/06-mcp-state/) | Connect the MCP client and create and fetch a synthetic record on request |
| [7. Save interview progress](https://codemillmatt.github.io/interview-coach-agent-framework/workshop/07-persistence/) | Follow a session lifecycle, preserve document fields, append new transcript text, and inspect the record |
| [8. Read a resume with a tool](https://codemillmatt.github.io/interview-coach-agent-framework/workshop/08-document-extraction/) | Connect MarkItDown and inspect extracted sample text |
| [9. Use the resume in the interview](https://codemillmatt.github.io/interview-coach-agent-framework/workshop/09-documents/) | Save document context and ask a relevant question in the complete single-agent baseline |
| [10. Make your first handoff](https://codemillmatt.github.io/interview-coach-agent-framework/workshop/10-first-handoff/) | Observe triage transfer document intake to the receptionist |
| [11. Add the interviewers](https://codemillmatt.github.io/interview-coach-agent-framework/workshop/11-interviewers/) | Use saved context for behavioural and technical practice in a four-agent workflow |
| [12. Finish with a summary agent](https://codemillmatt.github.io/interview-coach-agent-framework/workshop/12-handoffs/) | Complete the five-role graph and save final feedback |
| [13. Run your completed interview](https://codemillmatt.github.io/interview-coach-agent-framework/workshop/13-capstone/) | Apply the declared supplied-support patch, complete an interview, and inspect transitions, transcript, summary, and completion |
| [14. Find and fix a failed step](https://codemillmatt.github.io/interview-coach-agent-framework/workshop/14-debugging/) | Trace a failed document request and examine an early-finish route |

The course uses 13 executable checkpoint stages. The opening example and final debugging lesson reuse `08-complete`. At the capstone, the explicit support patch restores the completed deployment entry point and removes temporary workshop helpers; learner edits and supplied changes are covered by full replay and source-parity checks.

Use [architecture](ARCHITECTURE.md), [configuration](CONFIGURATION.md), and [session contracts](SESSION-DATA.md) for lookup. Compare `Single` and `HandOff` using the same inputs. [Deployment](DEPLOYMENT.md) and [Copilot](providers/GITHUB-COPILOT.md) are optional tasks after the completed capstone.
