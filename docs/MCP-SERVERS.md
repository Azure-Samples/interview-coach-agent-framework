# Model Context Protocol (MCP) Servers Guide

This guide explains the Model Context Protocol (MCP), why it matters, and how it's used in the Interview Coach application.

## What is MCP?

**Model Context Protocol (MCP)** is an open protocol that standardizes how AI applications connect to external tools and data sources. Think of it as a universal adapter for AI agent capabilities.

### The Problem MCP Solves

Traditional AI agent tools are often:

- **Tightly coupled**: Tool code embedded in agent application
- **Language-specific**: Can't reuse Python tools in .NET agents
- **Hard to maintain**: Changes require redeploying the entire agent
- **Not reusable**: Same capability reimplemented across projects

### The MCP Solution

MCP provides:

- **Standardized interface**: JSON-RPC protocol for tool discovery and execution
- **Language-agnostic**: MCP servers can be written in any language
- **Independent deployment**: Tools run as separate services
- **Reusability**: Same MCP server used by multiple agents/applications

## MCP in Interview Coach

This application uses two MCP servers to demonstrate different patterns:

### 1. MarkItDown MCP Server (External)

**Purpose**: Document parsing and conversion to markdown

**Source**: [microsoft/markitdown](https://github.com/microsoft/markitdown)

**Language**: Python

**Why external?**

- General-purpose document parsing (not interview-specific)
- Maintained by Microsoft as standalone project
- Demonstrates consuming third-party MCP servers
- Shows language interoperability (.NET agent ↔ Python tool)

**Tools provided**:

```json
{
  "name": "convert_to_markdown",
  "description": "Convert a document (PDF, DOCX, etc.) to markdown",
  "parameters": {
    "url": "Document URL or file path"
  }
}
```

**Integration**: [src/InterviewCoach.Agent/Program.cs](../src/InterviewCoach.Agent/Program.cs#L17-L42)

```csharp
// MCP client connects to MarkItDown server via HTTP/SSE
builder.Services.AddKeyedSingleton<McpClient>("mcp-markitdown", (sp, obj) =>
{
    var clientTransport = new HttpClientTransport(options, httpClient, loggerFactory);
    return McpClient.CreateAsync(clientTransport, clientOptions, loggerFactory).GetAwaiter().GetResult();
});
```

### 2. InterviewData MCP Server (Custom)

**Purpose**: Interview session management and persistence

**Source**: [src/InterviewCoach.Mcp.InterviewData/](../src/InterviewCoach.Mcp.InterviewData/)

**Language**: C# / .NET

**Why custom?**

- Domain-specific logic (interview sessions)
- Demonstrates building your own MCP server
- Shows .NET MCP SDK usage
- Tight integration with SQLite database

**Tools provided**:

```json
[
  {
    "name": "create_interview_session",
    "description": "Initialize a new interview session",
    "parameters": {
      "sessionId": "Unique session identifier"
    }
  },
  {
    "name": "get_interview_session",
    "description": "Retrieve existing session data",
    "parameters": {
      "sessionId": "Session identifier"
    }
  },
  {
    "name": "update_interview_session",
    "description": "Update session with resume, JD, or transcript",
    "parameters": {
      "sessionId": "Session identifier",
      "resume": "Resume text (optional)",
      "jobDescription": "JD text (optional)",
      "transcript": "Conversation history (optional)"
    }
  }
]
```

**Implementation**: [InterviewSessionTool.cs](../src/InterviewCoach.Mcp.InterviewData/InterviewSessionTool.cs)

## Building Your Own MCP Server

Let's walk through the InterviewData MCP server to understand how to build one.

### Step 1: Add MCP SDK

```xml
<PackageReference Include="ModelContextProtocol.Server" Version="..." />
```

### Step 2: Define Tools

Tools inherit from `McpTool` and define their schema:

```csharp
public class CreateInterviewSessionTool : McpTool
{
    public CreateInterviewSessionTool(IInterviewSessionRepository repository)
    {
        Name = "create_interview_session";
        Description = "Initialize a new interview session";
        InputSchema = new
        {
            type = "object",
            properties = new
            {
                sessionId = new { type = "string", description = "Unique session ID" }
            },
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

### Step 3: Register MCP Server

In `Program.cs`:

```csharp
builder.Services.AddMcpServer()
                .WithHttpTransport(o => o.Stateless = true)
                .WithToolsFromAssembly(Assembly.GetEntryAssembly());
```

### Step 4: Map MCP Endpoint

```csharp
app.MapMcp("/mcp");  // MCP protocol endpoint
```

### Step 5: Register as Aspire Resource

In AppHost:

```csharp
var mcpServer = builder.AddProject<Projects.InterviewCoach_Mcp_InterviewData>("mcp-interview-data")
                       .WithExternalHttpEndpoints();
```

### Step 6: Connect from Agent

```csharp
// Register MCP client
builder.Services.AddKeyedSingleton<McpClient>("mcp-interview-data", (sp, obj) =>
{
    var transport = new HttpClientTransport(options, httpClient, loggerFactory);
    return McpClient.CreateAsync(transport, options, loggerFactory).GetAwaiter().GetResult();
});

// Get tools from MCP server
var mcpClient = sp.GetRequiredKeyedService<McpClient>("mcp-interview-data");
var tools = mcpClient.ListToolsAsync().GetAwaiter().GetResult();

// Register with agent
var agent = new ChatClientAgent(
    chatClient: chatClient,
    tools: tools  // MCP tools available to agent
);
```

## MCP Communication Flow

```
┌─────────────┐                    ┌──────────────┐
│   Agent     │                    │  MCP Server  │
└──────┬──────┘                    └──────┬───────┘
       │                                  │
       │  1. List Tools Request           │
       │─────────────────────────────────>│
       │                                  │
       │  2. Tool Schemas Response        │
       │<─────────────────────────────────│
       │                                  │
       │  3. Execute Tool Request         │
       │     (name + parameters)          │
       │─────────────────────────────────>│
       │                                  │
       │  4. Tool Execution Result        │
       │<─────────────────────────────────│
       │                                  │
```

## MCP Protocol Basics

### Tool Discovery

Agent asks: "What tools do you have?"

```json
{
  "jsonrpc": "2.0",
  "method": "tools/list",
  "id": 1
}
```

Server responds:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [
      {
        "name": "create_interview_session",
        "description": "Initialize a new interview session",
        "inputSchema": {
          "type": "object",
          "properties": {
            "sessionId": { "type": "string" }
          }
        }
      }
    ]
  }
}
```

### Tool Execution

Agent calls tool:

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "create_interview_session",
    "arguments": {
      "sessionId": "abc-123"
    }
  },
  "id": 2
}
```

Server executes and responds:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"sessionId\": \"abc-123\", \"status\": \"created\"}"
      }
    ]
  }
}
```

## Why Use MCP?

### Benefits

✅ **Modularity**: Tools are independent, testable units  
✅ **Reusability**: Same tool across multiple agents  
✅ **Language Freedom**: Write tools in best-fit language  
✅ **Independent Scaling**: Scale tools separately from agents  
✅ **Team Autonomy**: Different teams own different tools  
✅ **Version Management**: Tools can evolve independently  

### When to Use MCP

**Use MCP when**:

- Tools have broad applicability (document parsing, email, calendar)
- You want language flexibility (Python ML tools, .NET business logic)
- Tools need independent scaling
- Multiple agents will use the same capability

**Inline tools when**:

- Tool is agent-specific and won't be reused
- Performance is critical (no network hop)
- Tool is trivial (string formatting, math)

## Available MCP Servers

### Microsoft MCP Servers

- **[MarkItDown](https://github.com/microsoft/markitdown)** - Document conversion
- **[Outlook Email](https://github.com/microsoft/mcp-dotnet-samples/tree/main/outlook-email)** - Email integration (coming soon)
- **[OneDrive](https://github.com/microsoft/mcp-dotnet-samples/tree/main/onedrive-download)** - File access (coming soon)

### Community MCP Servers

Explore the [MCP Server Registry](https://github.com/modelcontextprotocol/servers) for:

- Database access (PostgreSQL, MongoDB)
- APIs (Slack, GitHub, Jira)
- File systems and cloud storage
- Search engines
- And more...

## Best Practices

### 1. **Clear Tool Names**

❌ Bad: `process`, `handle`, `do_thing`  
✅ Good: `convert_to_markdown`, `create_interview_session`

### 2. **Detailed Descriptions**

Help the LLM understand when to use your tool:

```csharp
Description = "Convert a document (PDF, DOCX, PPTX, XLS, HTML) to markdown format. " +
              "Supports both URLs and local file paths. Returns formatted markdown text.";
```

### 3. **Structured Schemas**

Define clear parameter types and requirements:

```csharp
InputSchema = new
{
    type = "object",
    properties = new
    {
        url = new { 
            type = "string", 
            description = "HTTP(S) URL or local file path to document" 
        },
        stripImages = new { 
            type = "boolean", 
            description = "Remove images from output",
            default = false
        }
    },
    required = new[] { "url" }
};
```

### 4. **Error Handling**

Return meaningful errors:

```csharp
try
{
    var result = await ProcessDocument(url);
    return new ToolResponse { Content = result };
}
catch (Exception ex)
{
    return new ToolResponse 
    { 
        IsError = true,
        Content = $"Failed to process document: {ex.Message}"
    };
}
```

### 5. **Logging**

Log tool invocations for debugging:

```csharp
_logger.LogInformation("Executing {ToolName} with parameters: {Params}", 
    Name, JsonSerializer.Serialize(request.Parameters));
```

## Debugging MCP Servers

### Check Tool Registration

In Aspire Dashboard → Agent logs:

```
info: Registered MCP tool: create_interview_session
info: Registered MCP tool: get_interview_session
info: Registered MCP tool: update_interview_session
```

### Test MCP Endpoints

Direct HTTP test:

```bash
curl http://localhost:5001/mcp -H "Content-Type: application/json" -d '{
  "jsonrpc": "2.0",
  "method": "tools/list",
  "id": 1
}'
```

### Agent Tool Selection

Watch agent logs to see when tools are called:

```
info: Agent selected tool: convert_to_markdown
info: Tool parameters: {"url": "https://example.com/resume.pdf"}
info: Tool result: <markdown content>
```

## Next Steps

- 📖 [Create Your First MCP Server Tutorial](TUTORIALS.md#tutorial-2-creating-a-custom-mcp-server)
- 🏗️ [Architecture Overview](ARCHITECTURE.md#mcp-integration-pattern)
- ❓ [MCP FAQ](FAQ.md#mcp-questions)

---

**Resources**:

- [Model Context Protocol Specification](https://modelcontextprotocol.io)
- [MCP .NET SDK Documentation](https://github.com/microsoft/mcp-dotnet)
- [MCP Server Registry](https://github.com/modelcontextprotocol/servers)
