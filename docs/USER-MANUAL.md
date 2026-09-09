# Application usage reference

Start the application from the repository root with `aspire start --apphost ./apphost.cs`. Open the dashboard URL printed by Aspire and use the `webui` endpoint when its dependencies are ready.

## Interview inputs

The coach can collect a resume and a job description as pasted text, reachable URLs, or files attached through the UI. You can also explicitly skip a document.

Use the fictional PDFs in [samples](../samples/) while experimenting. Arbitrary websites, authenticated profiles, blocked URLs, or unsupported document contents are not guaranteed to parse. A local filesystem path is not automatically reachable by the MarkItDown container.

## Intended flow

The coach sets up an interview record, gathers optional materials, asks behavioural and technical questions, and produces a summary. You can request a different phase or ask to stop. Model-directed behaviour can vary; inspect tool results and persisted state when diagnosing a failure.

In handoff mode, Receptionist gathers inputs, Behavioural and Technical Interviewers conduct their respective phases, and Summariser records the final summary and completion. Triage routes rather than doing those tasks itself.

## Upload contract

The agent exposes `POST /upload` for multipart form data with a `file` field. The current limit is 10 MiB. Accepted extensions are `.pdf`, `.docx`, `.doc`, `.txt`, `.md`, and `.html`.

The returned URL is served from `GET /uploads/{fileId}/{fileName}`. Bytes are held in a process-local dictionary: a restart loses them, and an upload URL is not a durable storage or authorization mechanism.

The UI appends that URL to the user's message. MarkItDown must be able to reach it from its container. Validate the actual result; an accepted extension does not guarantee successful parsing.

## Session behaviour

A new chat creates a new session ID. The ID identifies the business record used by tools, but recording it does not create an implemented UI recovery feature.

The current UI keeps messages in component memory and does not provide a session picker or automatic restoration after refresh. Persisted Cosmos records and agent conversation context are distinct. See [session data](SESSION-DATA.md).

## Output

The intended summary includes highlights, areas for improvement, and recommendations. It is practice feedback, not a hiring decision or a validated readiness score.

Use fictional data and review logs before sharing them. They can contain session IDs, tool arguments, and document or transcript content.
