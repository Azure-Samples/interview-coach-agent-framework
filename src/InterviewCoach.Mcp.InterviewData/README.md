# Interview Data MCP Server

Custom [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server providing interview session management and persistence for the Interview Coach application.

## Purpose

This MCP server provides **domain-specific tools** for interview session management:

- Creating new interview sessions
- Retrieving session data
- Updating sessions with resumes, job descriptions, and transcripts
- Persisting state to SQLite database

## Why a Custom MCP Server?

This demonstrates building your own MCP server for domain-specific needs:

✅ **Separation of Concerns**: Data access logic separate from agent logic  
✅ **Reusability**: Same MCP server could be used by multiple agents  
✅ **Language Choice**: Built in C#/.NET to match application stack  
✅ **Type Safety**: Strongly-typed models and database access  
✅ **Testability**: MCP server can be tested independently  

**[Learn more about MCP →](../../docs/MCP-SERVERS.md)**

## Architecture Role

This MCP server sits between:

- **Interview Coach Agent**: Calls tools to manage sessions
- **SQLite Database**: Persists interview data

```
Agent → HTTP/MCP → Interview Data MCP Server → Entity Framework → SQLite
```

**[See overall architecture →](../../docs/ARCHITECTURE.md)**

## Technology Stack

- **.NET 10**: Server runtime
- **Model Context Protocol SDK**: `ModelContextProtocol.Server` package
- **Entity Framework Core**: ORM for database access
- **SQLite**: Lightweight database (via Aspire resource)
- **ASP.NET Core**: HTTP hosting

## Project Structure

### Key Files

**[Program.cs](Program.cs)** - MCP server setup

```csharp
builder.Services.AddMcpServer()
                .WithHttpTransport(o => o.Stateless = true)
                .WithToolsFromAssembly(Assembly.GetEntryAssembly());

app.MapMcp("/mcp");  // MCP protocol endpoint
```

**[InterviewSessionTool.cs](InterviewSessionTool.cs)** - MCP tool implementations

- `CreateInterviewSessionTool` - Create new session
- `GetInterviewSessionTool` - Retrieve session by ID
- `UpdateInterviewSessionTool` - Update session data
- Additional tools for session management

**[InterviewDataDbContext.cs](InterviewDataDbContext.cs)** - Entity Framework context

```csharp
public class InterviewDataDbContext : DbContext
{
    public DbSet<InterviewSession> InterviewSessions { get; set; }
    // Additional entities...
}
```

**[InterviewSessionRepository.cs](InterviewSessionRepository.cs)** - Data access layer

```csharp
public interface IInterviewSessionRepository
{
    Task<InterviewSession> CreateSessionAsync(string sessionId);
    Task<InterviewSession?> GetSessionAsync(string sessionId);
    Task UpdateSessionAsync(InterviewSession session);
}
```

**[appsettings.json](appsettings.json)** - Configuration including logging levels

## MCP Tools Provided

### 1. create_interview_session

**Description**: Initialize a new interview session

**Parameters**:

```json
{
  "sessionId": "string"  // Unique identifier for the session
}
```

**Returns**:

```json
{
  "sessionId": "abc-123",
  "status": "created",
  "createdAt": "2026-02-17T10:30:00Z"
}
```

### 2. get_interview_session

**Description**: Retrieve existing session data

**Parameters**:

```json
{
  "sessionId": "string"
}
```

**Returns**:

```json
{
  "sessionId": "abc-123",
  "resume": "Resume text or null",
  "jobDescription": "JD text or null",
  "transcript": "Conversation history JSON",
  "status": "in-progress",
  "createdAt": "2026-02-17T10:30:00Z",
  "updatedAt": "2026-02-17T10:45:00Z"
}
```

### 3. update_interview_session

**Description**: Update session with resume, job description, or transcript

**Parameters**:

```json
{
  "sessionId": "string",
  "resume": "string (optional)",
  "jobDescription": "string (optional)",
  "transcript": "string (optional)"
}
```

**Returns**:

```json
{
  "sessionId": "abc-123",
  "status": "updated",
  "updatedAt": "2026-02-17T10:45:00Z"
}
```

## Database Schema

### InterviewSession Table

| Column | Type | Description |
|--------|------|-------------|
| SessionId | TEXT (PK) | Unique session identifier |
| Resume | TEXT | Candidate resume (markdown) |
| JobDescription | TEXT | Job description (markdown) |
| Transcript | TEXT | Conversation history (JSON) |
| Status | TEXT | Session status (created, in-progress, completed) |
| CreatedAt | DATETIME | Creation timestamp |
| UpdatedAt | DATETIME | Last update timestamp |

SQLite database file location (in Aspire):

- Local dev: `.aspire/` directory
- Production: Persistent volume or Azure service

## How It Works

### Tool Registration

MCP tools implement the `McpTool` base class:

```csharp
public class CreateInterviewSessionTool : McpTool
{
    private readonly IInterviewSessionRepository _repository;
    
    public CreateInterviewSessionTool(IInterviewSessionRepository repository)
    {
        _repository = repository;
        
        // Define tool metadata
        Name = "create_interview_session";
        Description = "Initialize a new interview session";
        InputSchema = new
        {
            type = "object",
            properties = new { sessionId = new { type = "string" } },
            required = new[] { "sessionId" }
        };
    }
    
    public override async Task<ToolResponse> ExecuteAsync(ToolRequest request)
    {
        var sessionId = request.Parameters["sessionId"].ToString();
        var session = await _repository.CreateSessionAsync(sessionId);
        return new ToolResponse { Content = JsonSerializer.Serialize(session) };
    }
}
```

### Agent Discovery

When the agent starts:

1. Connects to MCP server via HTTP
2. Calls `tools/list` method
3. Receives tool schemas
4. Registers tools for use during conversations

### Agent Invocation

During a conversation:

1. LLM decides to use tool based on instructions
2. Agent calls `tools/call` with tool name and parameters
3. MCP server executes the tool
4. Returns result to agent
5. Agent incorporates result into conversation

## Local Development

### Run with Aspire (Recommended)

```bash
# From repository root
aspire run --file ./apphost.cs
```

Aspire automatically:

- Creates SQLite database
- Starts MCP server
- Configures connection strings
- Provides service discovery

### Run Standalone

```bash
cd src/InterviewCoach.Mcp.InterviewData

# Set connection string
export ConnectionStrings__sqlite="Data Source=interviews.db"

dotnet run
```

Access MCP endpoint at `http://localhost:5000/mcp`

### Test MCP Tools

Use `curl` to test manually:

```bash
# List tools
curl http://localhost:5000/mcp -H "Content-Type: application/json" -d '{
  "jsonrpc": "2.0",
  "method": "tools/list",
  "id": 1
}'

# Create session
curl http://localhost:5000/mcp -H "Content-Type: application/json" -d '{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "create_interview_session",
    "arguments": { "sessionId": "test-123" }
  },
  "id": 2
}'
```

## Extending the MCP Server

### Add a New Tool

1. **Create tool class** inheriting from `McpTool`:

```csharp
public class DeleteInterviewSessionTool : McpTool
{
    private readonly IInterviewSessionRepository _repository;
    
    public DeleteInterviewSessionTool(IInterviewSessionRepository repository)
    {
        _repository = repository;
        Name = "delete_interview_session";
        Description = "Delete an interview session";
        InputSchema = new
        {
            type = "object",
            properties = new { sessionId = new { type = "string" } },
            required = new[] { "sessionId" }
        };
    }
    
    public override async Task<ToolResponse> ExecuteAsync(ToolRequest request)
    {
        var sessionId = request.Parameters["sessionId"].ToString();
        await _repository.DeleteSessionAsync(sessionId);
        return new ToolResponse 
        { 
            Content = JsonSerializer.Serialize(new { status = "deleted" }) 
        };
    }
}
```

1. **Add repository method**:

```csharp
public interface IInterviewSessionRepository
{
    // Existing methods...
    Task DeleteSessionAsync(string sessionId);
}
```

1. **Build and restart** - MCP SDK automatically discovers the new tool via reflection

**[Tutorial: Creating Custom MCP Server →](../../docs/TUTORIALS.md#tutorial-2-creating-a-custom-mcp-server)**

### Add New Data Fields

1. **Update entity model**:

```csharp
public class InterviewSession
{
    public string SessionId { get; set; }
    // Existing fields...
    public string? CandidateName { get; set; }  // New field
}
```

1. **Create migration** (if using migrations):

```bash
dotnet ef migrations add AddCandidateName
dotnet ef database update
```

1. **Update tools** to accept/return new field

## Configuration

### Database Provider

Change database in [Program.cs](Program.cs):

```csharp
// SQLite (default)
builder.AddSqliteConnection("sqlite");

// Or PostgreSQL
builder.AddNpgsqlDbContext<InterviewDataDbContext>("postgres");

// Or SQL Server
builder.AddSqlServerDbContext<InterviewDataDbContext>("sqlserver");
```

### Logging

Adjust in [appsettings.json](appsettings.json):

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.EntityFrameworkCore": "Warning"  // Reduce EF noise
    }
  }
}
```

## Deployment

### With Aspire

Deployed as container to Azure Container Apps:

```bash
azd up
```

Database options for production:

- **Azure SQL Database**: Scalable, managed
- **Azure Database for PostgreSQL**: Open-source option
- **Cosmos DB**: Global distribution, high scale
- **SQLite with persistent volume**: Simple, low-cost

### Standalone Container

```bash
docker build -t interview-data-mcp .
docker run -p 8080:8080 \
  -e ConnectionStrings__sqlite="Data Source=/data/interviews.db" \
  -v /data:/data \
  interview-data-mcp
```

## Troubleshooting

### Tools Not Discovered by Agent

**Symptoms**: Agent says it doesn't have session management tools

**Solutions**:

1. Verify MCP server is running (check Aspire Dashboard)
2. Check agent logs for MCP connection errors
3. Test MCP endpoint directly: `curl http://localhost:5000/mcp`
4. Ensure `WithToolsFromAssembly(Assembly.GetEntryAssembly())` is called

### Database Errors

**Symptoms**: SQL errors or "table not found"

**Solutions**:

1. Ensure database is created: `dbContext.Database.EnsureCreated()` in [Program.cs](Program.cs)
2. Check connection string in Aspire Dashboard
3. Verify SQLite file permissions
4. For migrations: Run `dotnet ef database update`

### Session Not Persisting

**Symptoms**: Session data lost after restart

**Causes**:

- Using in-memory database (development only)
- SQLite file not in persistent location
- Database connection not properly configured

**Solutions**:

- Check Aspire resource configuration in AppHost
- Verify SQLite file path
- Use persistent volume in production

## Best Practices

✅ **Error Handling**: Return meaningful error messages in `ToolResponse`  
✅ **Validation**: Validate parameters before database operations  
✅ **Logging**: Log tool invocations for debugging  
✅ **Transactions**: Use EF transactions for multi-step operations  
✅ **Async**: All database operations are async  
✅ **Null Safety**: Handle missing sessions gracefully  

## Next Steps

- 🛠️ [Tutorial: Creating Custom MCP Server](../../docs/TUTORIALS.md#tutorial-2-creating-a-custom-mcp-server)
- 📖 [MCP Servers Guide](../../docs/MCP-SERVERS.md)
- 🏗️ [Architecture Overview](../../docs/ARCHITECTURE.md)
- 🔧 [Extend with New Tools](../../docs/TUTORIALS.md)

## Resources

- [Model Context Protocol Spec](https://modelcontextprotocol.io)
- [MCP .NET SDK](https://github.com/microsoft/mcp-dotnet)
- [Entity Framework Core Docs](https://learn.microsoft.com/ef/core)
- [SQLite Documentation](https://www.sqlite.org/docs.html)
