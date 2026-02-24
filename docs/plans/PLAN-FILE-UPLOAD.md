# Plan: File Upload for Resume in Chat UI

| Field            | Value |
|------------------|-------|
| **Status**       | Ready |
| **Branch**       | `bruno-AddMultiAgentsScenario` |
| **Created**      | 2026-02-24 |

---

## 1. Context

Today, users provide their resume to the Interview Coach by pasting a URL (e.g., a LinkedIn profile or hosted PDF link). The MarkItDown MCP server then fetches and parses the document. This requires the file to be publicly accessible on the web.

**Goal:** Add a file upload button to the chat UI so users can attach a local file (PDF, DOCX, etc.) directly from their machine. The file is uploaded to the backend, made available to the MarkItDown MCP server for parsing, and the parsed content is used throughout the interview session — all without the user needing to host the file anywhere.

**User experience:**

```
User: [clicks 📎 button, selects resume.pdf] Here's my resume, I attached it
Agent: Cool, I've uploaded the file and now I understand it. Should we start?
User: Yes
```

---

## 2. Architecture Overview

```
┌──────────────┐    multipart/form-data    ┌──────────────┐
│   WebUI      │ ─────────────────────────→│   Agent API  │
│  (Blazor)    │   POST /upload            │  (ASP.NET)   │
│              │ ←─────────────────────────│              │
│  ChatInput   │   { url: "..." }          │              │
│  + 📎 button │                           │              │
└──────────────┘                           └──────┬───────┘
                                                  │ stores file,
                                                  │ returns URL
                                                  ▼
                                           ┌──────────────┐
                                           │  MarkItDown  │
                                           │  MCP Server  │
                                           │  (converts   │
                                           │  PDF→markdown)│
                                           └──────────────┘
```

The key insight: MarkItDown already parses documents from URLs. We just need to:
1. Accept file uploads in the Agent API
2. Serve the uploaded file at a URL
3. Let the existing agent flow use that URL with MarkItDown

---

## 3. Implementation Plan

### Step 1: Add file upload endpoint to the Agent project

**File:** `src/InterviewCoach.Agent/Program.cs`

Add a minimal `POST /upload` endpoint that:
1. Accepts `multipart/form-data` with an `IFormFile`
2. Saves the file to a temp directory (or an in-memory store keyed by a GUID)
3. Returns a JSON response with the URL where the file can be fetched:
   ```json
   { "url": "https+http://agent/uploads/{fileId}/{originalFileName}" }
   ```

Add a matching `GET /uploads/{fileId}/{fileName}` endpoint that serves the stored file with the correct content type.

**Why the Agent project and not WebUI?** The Agent is the service that MarkItDown communicates with via Aspire service discovery. Uploading to the Agent ensures the file is accessible at a URL that MarkItDown can reach via the internal Aspire network.

**Storage:** Use a simple `ConcurrentDictionary<string, (byte[] Content, string ContentType, string FileName)>` singleton or a temp directory. Files are ephemeral — they only need to survive the interview session. No database needed.

**File size limit:** Cap at 10 MB. Return 413 if exceeded.

**Allowed types:** `.pdf`, `.docx`, `.doc`, `.txt`, `.md`, `.html`. Return 415 for unsupported types.

### Step 2: Add file upload button to ChatInput component

**File:** `src/InterviewCoach.WebUI/Components/Pages/Chat/ChatInput.razor`

Add a hidden `<input type="file">` element and a 📎 (paperclip) button that triggers it. The CSS class `.attach` already exists in `ChatInput.razor.css` and is styled for this purpose.

When a file is selected:
1. Show the file name as a chip/tag above the textarea (e.g., `📄 resume.pdf ✕`)
2. Store the `IBrowserFile` reference in component state
3. User can type an optional message alongside the attachment
4. On send: upload the file first, then include the returned URL in the chat message

### Step 3: Add file upload service to WebUI

**File:** `src/InterviewCoach.WebUI/Services/FileUploadService.cs` (new)

Create a service that:
1. Takes an `IBrowserFile`
2. Uses `IHttpClientFactory` to POST the file to `https+http://agent/upload` as multipart form data
3. Returns the URL from the response

Register it in `Program.cs`:
```csharp
builder.Services.AddScoped<FileUploadService>();
```

### Step 4: Wire upload into the chat message flow

**File:** `src/InterviewCoach.WebUI/Components/Pages/Chat/Chat.razor`

Modify `AddUserMessageAsync` to:
1. If a file is attached, upload it via `FileUploadService` first
2. Prepend or append the file URL to the user's message text, e.g.:
   ```
   Here's my resume, I attached it
   [Attached file: https+http://agent/uploads/abc123/resume.pdf]
   ```
3. The agent's existing instructions already handle resume URLs — the receptionist agent will call MarkItDown's `convert_to_markdown` tool with this URL

### Step 5: Update ChatInput JavaScript for file handling

**File:** `src/InterviewCoach.WebUI/Components/Pages/Chat/ChatInput.razor.js`

No changes needed for basic functionality. The file input and upload are handled by Blazor's `InputFile` / `IBrowserFile` API. If drag-and-drop is desired later, that would be a JS enhancement.

### Step 6: Add file attachment chip styling

**File:** `src/InterviewCoach.WebUI/Components/Pages/Chat/ChatInput.razor.css`

Add styles for the file attachment chip:
```css
.file-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    background: #f0f0f0;
    border-radius: 4px;
    padding: 2px 8px;
    font-size: 0.85rem;
    margin-bottom: 0.5rem;
}

.file-chip button {
    background: none;
    border: none;
    cursor: pointer;
    color: #888;
    padding: 0;
}
```

### Step 7: Update agent instructions (optional improvement)

**File:** `src/InterviewCoach.Agent/Program.cs`

Consider updating the receptionist agent's instructions to mention that users may attach files directly:

```
The user may provide their resume as an attached file (you'll see an [Attached file: URL] marker),
as a link, or as pasted text.
```

This is optional — the existing instructions already handle URLs, so attached file URLs should work without changes.

### Step 8: Verify MarkItDown can access the Agent-hosted URL

The uploaded file is served from the Agent project. MarkItDown communicates with the agent via Aspire service discovery (`https+http://agent`). Verify that:
1. The Agent project's `GET /uploads/{fileId}/{fileName}` endpoint is accessible
2. MarkItDown's `convert_to_markdown` tool can fetch from this URL

If MarkItDown runs as a Docker container and uses the Aspire service mesh, internal URLs should work. If not, the upload endpoint may need to be exposed with `.WithExternalHttpEndpoints()` or the URL may need to use the external-facing address.

**Fallback approach:** If URL-based access from MarkItDown to Agent proves problematic, an alternative is to:
- Upload the file directly to the MarkItDown MCP server instead
- Or base64-encode the file content and pass it inline to the agent message

---

## 4. Files Changed Summary

| File | Action | Description |
|------|--------|-------------|
| `src/InterviewCoach.Agent/Program.cs` | **Edit** | Add `POST /upload` and `GET /uploads/{fileId}/{fileName}` endpoints |
| `src/InterviewCoach.WebUI/Components/Pages/Chat/ChatInput.razor` | **Edit** | Add 📎 button, hidden file input, file chip display |
| `src/InterviewCoach.WebUI/Components/Pages/Chat/ChatInput.razor.css` | **Edit** | Add `.file-chip` styles (`.attach` class already exists) |
| `src/InterviewCoach.WebUI/Components/Pages/Chat/Chat.razor` | **Edit** | Wire file upload into message flow |
| `src/InterviewCoach.WebUI/Services/FileUploadService.cs` | **Create** | Service to upload files to Agent API |
| `src/InterviewCoach.WebUI/Program.cs` | **Edit** | Register `FileUploadService` |

---

## 5. Risks and Considerations

| Risk | Mitigation |
|------|-----------|
| MarkItDown can't reach Agent's `/uploads/` URL from inside Docker | Test with Aspire service discovery. Fallback: serve file from a shared volume or pass content inline |
| Large files slow down the upload | 10 MB limit. Show upload progress indicator in UI |
| File persists in memory forever | Use a `Timer` or TTL-based cleanup (e.g., delete files older than 1 hour). Or use temp directory with OS cleanup |
| Security: malicious file uploads | Validate file extension and content type. Don't execute uploaded files. Serve with `Content-Disposition: attachment` |
| Multi-agent mode: file URL must be accessible to all agents | Since all agents go through MCP tools (not direct file access), the URL just needs to be reachable from MarkItDown |

---

## 6. Future Enhancements (Out of Scope)

- Drag-and-drop file upload
- Multiple file attachments (resume + job description in one message)
- File preview in chat (thumbnail for PDFs)
- Persistent file storage across sessions
- Progress bar during upload
