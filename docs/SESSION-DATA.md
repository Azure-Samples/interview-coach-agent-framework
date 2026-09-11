# Session and data contracts

The InterviewData tools store interview inputs, transcript text, and completion state. The WebUI retains the current chat and sends its history with each AG-UI request.

## State ownership

| State | Owner | Persistence |
| --- | --- | --- |
| UI messages and current response | Server-side `Chat.razor` component | Memory in the WebUI's Blazor circuit |
| UI session ID / conversation ID | Server-side `Chat.razor` and chat options | A new chat or new circuit creates a new ID |
| AG-UI conversation context | Full message history sent by the WebUI on each request | Current-chat memory; durable recovery requires its own implementation |
| Interview record | InterviewData repository / Cosmos DB | Persisted business data |
| Uploaded file bytes | Agent service dictionary | Process-local, ephemeral |

The WebUI uses server-interactive Blazor: `Program.cs` registers `AddInteractiveServerComponents`, and `App.razor` selects `new InteractiveServerRenderMode(prerender: false)`. The browser connects to a server-side circuit; the C# chat component and `AGUIChatClient` execute in the WebUI process.

`Chat.razor.AddSessionSystemMessages` creates a GUID and sends it as `SessionId: ...`. Initialization and new-chat reset assign that ID to `ChatOptions.ConversationId`.

The AG-UI endpoint does not retain earlier turns merely because a conversation ID is supplied. Before a request, `Chat.razor` takes a snapshot with `messages.ToArray()`, including the system messages, previous questions and answers, and tool exchanges. Response updates are added to the component's history for the next request. **New chat** clears that history and creates a new ID.

The named `agent` HTTP client removes the shared short-timeout/retry policy. A turn can spend time calling the model and tools before streaming its first text, and retrying its POST could repeat a record append. The chat gives each turn up to five minutes and shows transport or timeout errors in place. Check the saved record before manually retrying a failed turn: a tool may have written data before the response failed. Canceling a turn or starting a new chat prevents its delayed response from being appended to the new conversation.

A browser refresh starts a new circuit, component, and session ID. Earlier interview records can be fetched explicitly through InterviewData. Restoring the UI message list and provider/framework conversation would require a recovery feature, including a history picker or equivalent entry point.

The static workshop website uses browser storage for chapter-completion marks. The interview application's UI messages and session ID live in the WebUI process.

The local emulator is development storage. Removing its container or data can remove interview records. Establish backup and retention requirements before changing that storage or using real data.

## MCP tools

| Tool | Operation |
| --- | --- |
| `add_interview_session` | Adds the supplied record |
| `get_interview_sessions` | Lists interview records |
| `get_interview_session` | Retrieves a record by ID; missing records produce no record |
| `update_interview_session` | Replaces document-related fields and appends supplied transcript text |
| `complete_interview_session` | Marks the identified record complete |

These tools operate on supplied IDs, and `get_interview_sessions` lists all records. Per-user authorization and ownership checks require additional service-boundary code. Use fictional records in a restricted development environment; see [access and data handling](DEPLOYMENT.md#review-access-and-data-handling).

## Update semantics

`InterviewSessionRepository.UpdateInterviewSessionAsync` copies `ResumeLink`, `ResumeText`, `ProceedWithoutResume`, `JobDescriptionLink`, `JobDescriptionText`, and `ProceedWithoutJobDescription`. It sets `UpdatedAt` and appends the supplied `Transcript` after the existing transcript, with line breaks.

Sending the previous full transcript again duplicates it. Sending incomplete document fields can replace existing values. Fetch the current record, preserve all six document-related fields, and send only new transcript text with each update. This is the update rule practiced in the [persistence lesson](https://codemillmatt.github.io/interview-coach-agent-framework/workshop/07-persistence/).

`CompleteInterviewSessionAsync` sets `IsCompleted` to `true` and leaves `UpdatedAt` unchanged. The summariser generates its output and appends it with `update_interview_session` before calling completion. Add inserts a new record. Repeating an append repeats its text.

A missing lookup returns no record. Call `add_interview_session` with the same ID before attempting an update. Missing-record updates and completions log a warning and throw `McpException`, so the caller receives an error explaining that the record must be created first. Confirm writes through the returned record and the item in database `interviewdb`, container `interviewsessions`. The record's `Id` is stored as JSON `id` and is also its partition key.

## Changing the update contract

An optional extension could separate document-field replacement from transcript append. A narrower append tool could accept a session ID, new text, and an operation ID for retry deduplication. Define the repeated-operation behavior in the repository before changing agent instructions.

Update the repository, MCP schema, agent instructions, and tests together. Inspect the stored result after a normal call, a repeated call, and an invalid ID. Keep this extension separate from the completed workshop checkpoint so its changed contract can be compared with the reference.
