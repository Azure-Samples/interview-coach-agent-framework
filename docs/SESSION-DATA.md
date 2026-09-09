# Session and data contracts

## State ownership

| State | Owner | Persistence |
| --- | --- | --- |
| UI messages and current response | `Chat.razor` | Component memory |
| UI session ID / conversation ID | `Chat.razor` and chat options | A new ID is created for a new chat/component |
| Agent conversation state | Agent Framework / configured service runtime | Do not infer durable recovery from the database record |
| Interview record | InterviewData repository / Cosmos DB | Persisted business data |
| Uploaded file bytes | Agent service dictionary | Process-local, ephemeral |

The UI has no implemented history picker or automatic previous-conversation restoration.

## MCP tools

| Tool | Operation |
| --- | --- |
| `add_interview_session` | Adds the supplied record |
| `get_interview_sessions` | Lists interview records |
| `get_interview_session` | Retrieves a record by ID; missing records produce no record |
| `update_interview_session` | Replaces document-related fields and appends supplied transcript text |
| `complete_interview_session` | Marks the identified record complete |

These are sample data tools, not an implemented per-user authorization layer. Caller-supplied IDs must not be treated as proof of ownership in a production system.

## Update semantics

`InterviewSessionRepository.UpdateInterviewSessionAsync` copies the supplied resume/job-description fields, sets `UpdatedAt`, and appends the supplied transcript to the existing transcript.

Consequently, sending the previous full transcript again duplicates it. Sending incomplete document fields can replace existing values. Callers must preserve fields and append only new text; a production extension may use narrower contracts for those operations.

Null/missing-record results differ from transport or database failures. A model's assertion that a write succeeded is not sufficient evidence; inspect the tool result and stored record.
