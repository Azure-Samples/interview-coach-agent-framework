# Architecture overview

How the Interview Coach is put together and why.

## System architecture

![Architecture Diagram](../assets/architecture.png)

[Aspire](https://aspire.dev) orchestrates the services: agent, web UI, MCP servers, and a SQLite database. Each runs as a separate process with service discovery wiring them together.

A few decisions shaped the design:

1. **MCP for tools** — Tools (document parsing, session storage) live in their own MCP servers. They can be reused across projects and developed independently.
2. **Provider abstraction** — The LLM backend is swappable at runtime: Foundry, Azure OpenAI, or GitHub Models.
3. **Aspire orchestration** — Service discovery, health checks, and telemetry come free from .NET Aspire.
4. **Stateful sessions** — Interview sessions persist to SQLite so users can pause and resume.

## Component Deep Dive

### 1. InterviewCoach.Agent (AI agent service)

The agent runs the interview. It decides what to ask, when to call tools, and how to respond.

Built on ASP.NET Core, Microsoft Agent Framework, and the OpenAI SDK. Talks to the web UI via the AG-UI protocol and to tools via MCP clients.

- Runs as a single agent or as 5 specialists in handoff mode (configurable)
- Has step-by-step interview instructions (scoped per-agent in handoff mode)
- Calls MarkItDown (document parsing) and InterviewData (session storage) through MCP
- Uses the `IChatClient` interface, so the LLM provider is pluggable

### 2. InterviewCoach.WebUI (user interface)

A Blazor web app where users chat with the agent. Styled with Tailwind CSS, renders markdown with Marked.js, and sanitizes input with DOMPurify. Communicates with the agent over the AG-UI protocol.

**Communication Flow**:

```mermaid
flowchart LR
    A[User Input] --> B[Blazor Component]
    B --> C["Agent API (/ag-ui via AGUIChatClient)"]
    C --> D[LLM]
    D --> E[Agent]
    E --> F[Response]
    F --> G[Blazor UI]
```

### 3. InterviewCoach.Mcp.MarkItDown (document parsing)

Converts PDFs, DOCX files, and other documents to markdown so the agent can read them. This is [Microsoft's MarkItDown](https://github.com/microsoft/markitdown) running as an MCP server in a Docker container.

It's external (Python-based) because it's reusable across projects and maintained independently. It also shows how to integrate a third-party MCP server.

**Integration Pattern**:

```mermaid
flowchart LR
    A[Agent] --> B[HTTP/SSE]
    B --> C[MarkItDown MCP Server]
    C --> D[Document Processing]
    D --> E[Markdown Response]
```

### 4. InterviewCoach.Mcp.InterviewData (session storage)

A custom .NET MCP server that stores interview sessions in SQLite via Entity Framework Core. Built with the `ModelContextProtocol.Server` SDK.

**Integration Pattern**:

```mermaid
flowchart LR
    A[Agent] --> B[HTTP/SSE]
    B --> C[InterviewData MCP Server]
    C --> D[Data Processing]
    D --> E[Response]
```

### 5. InterviewCoach.AppHost (Aspire orchestration)

The Aspire app model. Defines which services exist, how they depend on each other, and what config they get.

### 6. InterviewCoach.ServiceDefaults (shared defaults)

OpenTelemetry, health checks, service discovery, and HTTP client defaults. Shared across all projects so you don't repeat the setup.

## Multi-Agent Handoff Workflow

```mermaid
sequenceDiagram
    participant U as User / WebUI
    participant T as Triage Agent
    participant R as Receptionist Agent
    participant MID as MarkItDown MCP
    participant MDB as InterviewData MCP
    participant B as Behavioral Interviewer
    participant TI as Technical Interviewer
    participant S as Summarizer Agent

    U->>T: Start interview
    T->>MDB: Create session
    T-->>R: Handoff → gather materials

    R->>U: Request resume
    U->>R: Provides resume URL
    R->>MID: Parse resume
    MID-->>R: Markdown content
    R->>MDB: Update session with resume

    R->>U: Request job description
    U->>R: Provides JD
    R->>MDB: Update session with JD
    R-->>B: Handoff → begin behavioral interview

    loop Behavioral Q&A
        B->>U: Ask behavioral question
        U->>B: Answer
    end
    B-->>TI: Handoff → begin technical interview

    loop Technical Q&A
        TI->>U: Ask technical question
        U->>TI: Answer
    end
    TI-->>S: Handoff → generate summary

    U->>S: Stop interview
    S->>S: Generate summary via LLM
    S->>MDB: Save complete transcript
    S->>U: Display summary
```

## Next steps

- [Learning objectives](LEARNING-OBJECTIVES.md)
- [Tutorials](TUTORIALS.md)
- [FAQ](FAQ.md)
