# Interview Coach Multi-Agent Implementation

## Overview

This implementation creates a multi-agent workflow for an interview coaching system using the Microsoft Agent Framework. The system guides candidates through a complete interview preparation process with multiple specialized agents.

## Architecture

### Agents

1. **Triage Agent**
   - Greets users and creates new interview sessions
   - Initializes session tracking in the database
   - Provides session ID for tracking throughout the process

2. **Analysis Agent**
   - Collects candidate's resume (link, text, or skip)
   - Collects job description (link, text, or skip)
   - Converts links to markdown using MarkItDown MCP server
   - Stores all data in the interview database via MCP
   - Validates analysis completion before proceeding

3. **Behavioral Interview Agent**
   - Conducts behavioral interview questions
   - Uses STAR method evaluation
   - Provides constructive feedback
   - Records conversation transcripts
   - Allows switching to technical interview

4. **Technical Interview Agent**
   - Conducts technical interview questions
   - Covers programming, algorithms, system design
   - Provides detailed technical feedback
   - Records conversation transcripts
   - Allows switching back to behavioral

5. **Summary Agent**
   - Reviews complete interview transcript
   - Generates markdown-formatted summary with sections:
     - Overview
     - Key Highlights
     - Areas for Improvement
     - Recommendations
   - Marks session as completed in database

### Services

#### SessionStateService
- In-memory session management
- Tracks interview phase and progress
- Validates analysis completion (resume + job description captured/skipped)

#### McpClientService
- Interfaces with two MCP servers:
  - **mcp-interview-data**: Database operations for session management
  - **mcp-markitdown**: Converts URLs to markdown format
- Handles all CRUD operations for interview sessions

### Data Model

**InterviewSession** (stored in database):
- `Id`: Session identifier
- `ResumeLink`: URL to resume document
- `ResumeText`: Markdown content of resume
- `ProceedWithoutResume`: Boolean flag for skipping resume
- `JobDescriptionLink`: URL to job description
- `JobDescriptionText`: Markdown content of job description
- `ProceedWithoutJobDescription`: Boolean flag for skipping JD
- `Transcript`: Accumulated conversation history
- `IsCompleted`: Session completion status
- `CreatedAt/UpdatedAt`: Timestamps

**InterviewSessionState** (in-memory):
- Extends database model with:
  - `CurrentPhase`: Tracks workflow progress
  - `IsAnalysisComplete`: Validation flag

### Workflow Pattern

The implementation uses a **Sequential Workflow** pattern:

```
Triage → Analysis → Behavioral → Summary
                         ↓
                    Technical (optional)
```

Users can switch between Behavioral and Technical interviews as needed before moving to the Summary phase.

## Key Features

### 1. Explicit Confirmation
- Users must explicitly confirm proceeding without resume/job description
- No assumptions made about user intent

### 2. Link Processing
- Automatic conversion of document links to markdown
- Fallback to manual text entry if conversion fails

### 3. Transcript Accumulation
- All interview conversations are recorded
- Transcripts append to existing content in database

### 4. Phase Tracking
- State machine tracks current interview phase
- Ensures proper workflow progression

### 5. Markdown Summaries
- Structured output with consistent formatting
- Four main sections for comprehensive feedback

## Tools Available to Each Agent

### Triage Agent
- `CreateSession()`: Initialize new interview session
- `ClassifyIntent(message)`: Detect user intent (greeting, start, etc.)

### Analysis Agent
- `CaptureResumeLink(sessionId, link)`: Store resume URL and convert to markdown
- `CaptureResumeText(sessionId, text)`: Store resume text directly
- `ProceedWithoutResume(sessionId)`: Skip resume collection
- `CaptureJobDescriptionLink(sessionId, link)`: Store JD URL and convert
- `CaptureJobDescriptionText(sessionId, text)`: Store JD text directly
- `ProceedWithoutJobDescription(sessionId)`: Skip JD collection
- `IsAnalysisComplete(sessionId)`: Check if ready to proceed

### Interview Agents (Behavioral & Technical)
- `RecordTranscript(sessionId, transcript)`: Save conversation
- `SwitchToBehavioralInterview(sessionId)`: Change to behavioral questions
- `SwitchToTechnicalInterview(sessionId)`: Change to technical questions
- `CompleteInterview(sessionId)`: Mark interview as done

### Summary Agent
- `GenerateSummary(sessionId)`: Create final summary and complete session
- `FormatSummary(overview, highlights, improvements, recommendations)`: Structure markdown output

## Database Schema

The system uses Entity Framework Core with in-memory SQLite database for development. The schema can easily be migrated to a persistent database by changing the connection string.

```csharp
public class InterviewSession
{
    public Guid Id { get; set; }
    public string? ResumeLink { get; set; }
    public string? ResumeText { get; set; }
    public bool ProceedWithoutResume { get; set; }
    public string? JobDescriptionLink { get; set; }
    public string? JobDescriptionText { get; set; }
    public bool ProceedWithoutJobDescription { get; set; }
    public string? Transcript { get; set; }
    public bool IsCompleted { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
```

## MCP Server Integration

### Interview Data MCP Server
**Tools Exposed:**
- `add_interview_session`: Create new session
- `get_interview_session`: Retrieve session by ID
- `update_interview_session`: Update session data
- `complete_interview_session`: Mark as completed

### MarkItDown MCP Server
**Tools Exposed:**
- `markitdown`: Convert URLs to markdown format

## Usage Flow

1. **User starts conversation**
   - Triage agent greets and explains process
   - Creates session when user is ready

2. **Data collection**
   - Analysis agent requests resume
   - User provides link/text or skips
   - Analysis agent requests job description
   - User provides link/text or skips
   - Analysis validates both items handled

3. **Interview phase**
   - Behavioral agent conducts soft skills interview
   - User can switch to technical questions
   - Technical agent conducts technical interview
   - User can switch back or complete

4. **Summary generation**
   - Summary agent reviews transcript
   - Generates structured markdown report
   - Marks session as completed

## Future Enhancements

- Add persistence layer (Azure SQL, Cosmos DB)
- Implement session resume functionality
- Add authentication and authorization
- Create admin dashboard for session review
- Add email/export functionality for summaries
- Implement audio/video interview support
- Add AI-powered question generation based on JD
- Include industry-specific interview templates

## Files Created

### Models
- `Models/InterviewSessionState.cs`: Session state and phase tracking

### Services
- `Services/SessionStateService.cs`: In-memory session management
- `Services/McpClientService.cs`: MCP server integration

### Tools
- `Tools/TriageTools.cs`: Session creation and intent classification
- `Tools/AnalysisTools.cs`: Resume and JD collection
- `Tools/InterviewTools.cs`: Interview management and transcription
- `Tools/SummaryTools.cs`: Summary generation and formatting

### Configuration
- `Program.cs`: Updated with multi-agent workflow configuration

## Configuration Requirements

### appsettings.json
Ensure OpenAI client is configured:
```json
{
  "OpenAI": {
    "Key": "your-api-key",
    "Endpoint": "your-endpoint"
  }
}
```

### MCP Server Configuration
Both MCP servers must be running and accessible:
- `mcp-markitdown`: https+http://mcp-markitdown/mcp
- `mcp-interview-data`: https+http://mcp-interview-data/mcp

## Testing

To test the implementation:

1. Start the AppHost (Aspire orchestration)
2. Navigate to the AG-UI endpoint
3. Start a conversation with the interview coach
4. Follow the workflow through all phases
5. Review the generated summary

## Notes

- The implementation uses a sequential workflow for simplicity
- Session state is stored both in-memory and in the database
- MCP client selection is based on registration order (index-based)
- All agents share access to the same chat client
- Tools are created using `AIFunctionFactory.Create()` from method references
