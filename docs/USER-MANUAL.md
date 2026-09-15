# Application usage reference

This page describes the completed app's inputs and outputs. These instructions apply whether you're running the repository as a standalone reference or following the workshop.

**If you're learning the application:** For first-run tools, Azure permissions, and resource ownership, start with [Chapter 0](https://codemillmatt.github.io/interview-coach-agent-framework/workshop/00-orientation/#check-your-tools).

**To run the application:** From the completed project's root, follow the [main README's setup instructions](../README.md#run-the-repository). The default AppHost can provision a billable Foundry deployment. Open the printed dashboard URL and use the `webui` endpoint when its dependencies are ready.

## Interview inputs

The coach can collect a resume and a job description as pasted text, reachable URLs, or files attached through the UI. You can also explicitly skip a document.

Use the fictional PDFs in [samples](../samples/) while experimenting. For URL input, choose a document that MarkItDown can fetch from its container. Authenticated profiles, redirects, and unsupported formats can cause extraction failures. Attach local files through the UI's upload path.

## Intended flow

The coach sets up an interview record, gathers optional materials, asks behavioural and technical questions, and produces a summary. You can request a different phase or ask to stop. Model-directed behaviour can vary; inspect tool results and persisted state when diagnosing a failure.

In handoff mode, Triage selects a phase. Receptionist gathers inputs, Behavioural and Technical Interviewers conduct their respective phases, and Summariser records the final summary and completion.

## Upload contract

The agent exposes `POST /upload` for multipart form data with a `file` field. The WebUI server's `FileUploadService` sends that request with the attached file stream. The current limit is 10 MiB. Accepted extensions are `.pdf`, `.docx`, `.doc`, `.txt`, `.md`, and `.html`.

The returned URL is served from `GET /uploads/{fileId}/{fileName}`. Bytes are held in a process-wide dictionary for the agent's lifetime. Restarting the process loses them; starting a new chat leaves them in that dictionary. Upload access and per-session deletion need additional implementation, as do aggregate memory and retention controls. Use fictional documents in a restricted environment.

The WebUI appends the returned URL to the user's message. MarkItDown fetches it from its container. Confirm extraction by inspecting the returned text, then confirm storage through the InterviewData result. File acceptance, text extraction, and record storage are separate operations.

Use a full published sample URL for the extraction lesson. A localhost address from a workshop preview refers to a different network context inside the parser container. The [deployment reference](DEPLOYMENT.md#review-access-and-data-handling) covers upload access and data handling for optional hosting.

## Session behaviour

A new chat creates a new session ID for the business record used by tools.

The current UI keeps messages and its session ID in a server-side Blazor component/circuit. Refreshing starts a new circuit and session. Earlier Cosmos records can be fetched through tools; restoring the UI and agent conversation would require a recovery feature. The workshop website saves its own chapter progress in browser storage. See [session data](SESSION-DATA.md#state-ownership).

## Output

The intended summary gives practice feedback about the answers and suggests areas to improve. Use it to plan further interview practice. Hiring decisions and readiness assessment require their own evaluation process.

Check the record in the Cosmos emulator's Data Explorer: database `interviewdb`, container `interviewsessions`, with the session GUID in JSON `id`. Summary text is appended to `Transcript`; completion is a separate `IsCompleted` flag. Confirm both in the tool results and stored record.

Use fictional data and review logs before sharing them. They can contain session IDs, tool arguments, and document or transcript content.
