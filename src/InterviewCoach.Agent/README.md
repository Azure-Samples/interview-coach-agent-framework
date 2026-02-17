# Interview Coach Agent

This is the core AI agent service that conducts interview coaching sessions using [Microsoft Agent Framework](https://aka.ms/agent-framework).

## Purpose

The Interview Coach Agent orchestrates the interview preparation process by:

- Managing conversational flow through structured instructions
- Collecting resumes and job descriptions
- Asking behavioral and technical questions
- Analyzing responses
- Generating comprehensive summaries and feedback
- Maintaining session state through MCP tools

## Architecture Role

This service acts as the **brain** of the application:

- Receives user messages from the WebUI
- Calls MCP servers for capabilities (document parsing, session management)
- Communicates with LLM provider (Foundry, Azure OpenAI, or GitHub Models)
- Returns intelligent responses based on instructions and context

**[See overall architecture →](../../docs/ARCHITECTURE.md)**

## Key Files

### Program.cs

**[View source](Program.cs)**

The main application file containing:

**Lines 17-66**: MCP client setup

- Connects to MarkItDown MCP (document parsing)
- Connects to InterviewData MCP (session management)
- Configures HTTP transports

**Lines 68-79**: LLM provider configuration

- Loads chat client from Aspire-configured provider
- Supports Foundry, Azure OpenAI, and GitHub Models

**Lines 81-119**: Agent definition

```csharp
var agent = new ChatClientAgent(
    chatClient: chatClient,
    name: "coach",
    instructions: """ ... """,
    tools: [ .. markitdownTools, .. interviewDataTools ]
);
```

Key aspects of the agent:

- **Instructions**: Natural language defining agent behavior and interview flow
- **Tools**: MCP tools for document parsing and data management
- **Chat client**: Provider-agnostic LLM interface

**Lines 121-135**: API endpoint mapping

- `/responses` - OpenAI-compatible responses API
- `/conversations` - Multi-turn conversation management
- `/ag-ui` - Agent Framework AGUI protocol
- `/devui/` - Development UI (dev only)

### Constants.cs

**[View source](Constants.cs)**

Defines configuration keys used throughout the application.

### appsettings.json

**[View source](appsettings.json)**

Default configuration including logging levels and placeholder values for credentials.

## Agent Instructions

The heart of the agent is its instructions (defined in [Program.cs](Program.cs#L95-L125)):

```csharp
instructions: """
    You are an AI Interview Coach designed to help users prepare for job interviews.
    You will guide them through the interview process, provide feedback, and help them improve their skills.
    You will be given a session Id to track the interview session progress.
    Use the provided tools to manage interview sessions, capture resume and job description, 
    ask both behavioral and technical questions, analyze responses, and generate summaries.

    Here's the overall process you should follow:
    01. Start by fetching an existing interview session and let the user know their session ID.
    02. If there's no existing session, create a new interview session...
    03-12. [Complete interview flow]
    
    Always maintain a supportive and encouraging tone.
    """
```

**Why this matters**: The instructions define agent behavior through natural language, not code. Changing the flow is as simple as editing this text.

**[Learn more about instruction engineering →](../../docs/TUTORIALS.md#tutorial-1-understanding-the-interview-flow)**

## MCP Tool Integration

The agent uses two MCP servers:

### 1. MarkItDown MCP

- **Purpose**: Parse resumes and job descriptions from PDF/DOCX to markdown
- **Tools**: `convert_to_markdown`
- **Source**: External Python server from [microsoft/markitdown](https://github.com/microsoft/markitdown)

### 2. InterviewData MCP

- **Purpose**: Manage interview session state and persistence
- **Tools**: `create_interview_session`, `get_interview_session`, `update_interview_session`
- **Source**: Custom .NET server in [../InterviewCoach.Mcp.InterviewData/](../InterviewCoach.Mcp.InterviewData/)

**[Deep dive into MCP servers →](../../docs/MCP-SERVERS.md)**

## API Endpoints

When running, the agent exposes:

| Endpoint | Purpose | Protocol |
|----------|---------|----------|
| `/responses` | Single-turn completions | OpenAI-compatible |
| `/conversations` | Multi-turn conversations | OpenAI-compatible |
| `/ag-ui` | Agent UI protocol | AGUI |
| `/devui/` | Development UI | HTTP (dev only) |

The WebUI connects to `/conversations` for the chat interface.

## Local Development

### Run Standalone

```bash
# Set environment variables for provider
export LlmProvider=MicrosoftFoundry
export MicrosoftFoundry__Project__Endpoint="https://your-project.azure.ai"
export MicrosoftFoundry__Project__ApiKey="your-key"

# Run
cd src/InterviewCoach.Agent
dotnet run
```

**Note**: Running standalone requires MCP servers to be running separately. Easier to use Aspire orchestration.

### Run with Aspire (Recommended)

```bash
# From repository root
aspire run --file ./apphost.cs
```

Aspire automatically:

- Starts all dependencies (MCP servers, database)
- Configures service discovery
- Provides dashboard at `https://localhost:17xxx`

### Development UI

When running in development, access DevUI at:

```
https://localhost:<port>/devui/
```

This provides a test interface for interacting with the agent without the WebUI.

## Configuration

### Provider Selection

Set in `apphost.settings.json` or via environment variable:

```json
{
  "LlmProvider": "MicrosoftFoundry"  // or "AzureOpenAI" or "GitHubModels"
}
```

**[Provider setup guides →](../../docs/providers/README.md)**

### Logging

Adjust verbosity in `appsettings.json`:

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",  // Information, Debug, Trace
      "Microsoft.Agents.AI": "Debug"  // Agent framework logs
    }
  }
}
```

## Customization

### Modify Interview Flow

Edit the agent instructions in [Program.cs](Program.cs#L95-L125):

```csharp
instructions: """
    Your customizations here...
    """
```

Examples:

- Change question order (technical before behavioral)
- Add new interview stages (coding challenges, case studies)
- Modify tone (more formal, less formal)
- Add domain specialization (frontend, backend, data science)

**[Tutorial: Customizing the Agent →](../../docs/TUTORIALS.md#tutorial-3-customizing-the-agent)**

### Add New MCP Tools

1. Create or reference MCP server
2. Register HTTP client in [Program.cs](Program.cs)
3. Register MCP client
4. List tools and add to agent

**[Tutorial: Creating Custom MCP Server →](../../docs/TUTORIALS.md#tutorial-2-creating-a-custom-mcp-server)**

## Deployment

### With Aspire (`azd`)

The agent deploys as a container to Azure Container Apps:

```bash
azd up
```

### Standalone Container

```bash
# Build
docker build -t interview-coach-agent .

# Run
docker run -p 8080:8080 \
  -e LlmProvider=MicrosoftFoundry \
  -e MicrosoftFoundry__Project__Endpoint=... \
  -e MicrosoftFoundry__Project__ApiKey=... \
  interview-coach-agent
```

## Observability

### Logs

The agent emits structured logs:

- User messages received
- Tool calls made
- LLM requests/responses
- Errors and warnings

View in Aspire Dashboard or Azure Application Insights.

### Traces

OpenTelemetry distributed tracing tracks:

- Request flow through agent
- MCP tool invocations
- LLM latency

### Metrics

Built-in metrics:

- Request count
- Response latency
- Token usage (via provider)
- Error rates

## Troubleshooting

### Agent Not Responding

**Symptoms**: Timeout or no response

**Possible causes**:

1. LLM provider not configured correctly
2. MCP servers not running
3. Network connectivity issues

**Solutions**:

- Check Aspire Dashboard - all services should be "Running"
- Verify provider credentials in user secrets
- Review agent logs for errors

### Tool Calls Failing

**Symptoms**: Agent says it can't perform actions

**Possible causes**:

1. MCP server unreachable
2. MCP tool errors
3. Tool not registered with agent

**Solutions**:

- Check MCP server logs in Aspire Dashboard
- Verify MCP clients are registered in [Program.cs](Program.cs#L17-L66)
- Ensure tools are added to agent: `tools: [ .. markitdownTools, .. interviewDataTools ]`

### High Token Usage

**Symptoms**: Unexpected costs

**Possible causes**:

1. Long conversations
2. Verbose instructions
3. Large documents being parsed

**Solutions**:

- Monitor usage in Foundry Portal or Azure OpenAI Studio
- Reduce instruction length
- Set max_tokens limits
- Use model-router (Foundry) for cost optimization

## Next Steps

- 📖 [Understand the Architecture](../../docs/ARCHITECTURE.md)
- 🛠️ [Follow Tutorials](../../docs/TUTORIALS.md)
- 🔧 [Customize Agent Instructions](../../docs/TUTORIALS.md#tutorial-3-customizing-the-agent)
- 🎯 [Learn About MCP](../../docs/MCP-SERVERS.md)

## Resources

- [Microsoft Agent Framework Docs](https://aka.ms/agent-framework)
- [Agent Framework Samples](https://github.com/microsoft/agent-framework)
- [OpenAI Function Calling Guide](https://platform.openai.com/docs/guides/function-calling)
- [Model Context Protocol](https://modelcontextprotocol.io)
