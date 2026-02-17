# Interview Coach Web UI

Blazor Server-based web interface for the Interview Coach application, providing a chat experience for users to conduct interview preparation sessions.

## Purpose

The Web UI serves as the **user-facing interface**:

- Provides chat-style interaction with the interview coach agent
- Displays formatted responses with markdown support
- Manages conversation history
- Connects to the Agent service via HTTP/SignalR

## Architecture Role

This component handles:

- ✅ User input collection
- ✅ Real-time communication with Agent service
- ✅ Response rendering (markdown, code blocks, lists)
- ✅ Conversation state visualization
- ✅ Error handling and user feedback

**[See overall architecture →](../../docs/ARCHITECTURE.md)**

## Technology Stack

- **Blazor Server**: Server-side rendering with SignalR for real-time updates
- **Tailwind CSS**: Utility-first CSS framework for styling
- **Marked.js**: Markdown rendering for agent responses
- **DOMPurify**: XSS protection for user-generated content

## Key Files and Directories

### Components/

Contains Blazor components:

**Pages/Home.razor** - Main chat interface

- Message input handling
- Conversation display
- Agent communication

**Layout/** - Application layout components

- MainLayout.razor - Overall page structure
- NavMenu.razor - Navigation (if applicable)

### wwwroot/

Static assets:

- **lib/** - Client-side libraries (Tailwind, Marked, DOMPurify)
- **css/** - Custom styles
- **js/** - JavaScript interop files

### Program.cs

Application configuration:

- Service registration
- HTTP client for Agent service
- Blazor setup

### appsettings.json

Configuration including:

- Logging levels
- Connection settings

## How It Works

### Communication Flow

```
User types message
    ↓
Blazor form submission
    ↓
HTTP POST to Agent /conversations endpoint
    ↓
Agent processes with LLM + MCP tools
    ↓
Response returned as JSON
    ↓
Blazor re-renders with new message
    ↓
Marked.js converts markdown to HTML
    ↓
DOMPurify sanitizes HTML
    ↓
Display to user
```

### Agent Connection

The WebUI connects to the Agent service via Aspire service discovery:

```csharp
// In Program.cs
builder.Services.AddHttpClient("agent", client =>
{
    client.BaseAddress = new Uri("https+http://agent");  // Aspire resolves this
});
```

During deployment, Aspire replaces `https+http://agent` with the actual agent service URL.

## Local Development

### Run with Aspire (Recommended)

```bash
# From repository root
aspire run --file ./apphost.cs
```

Aspire automatically:

- Starts the Agent service
- Configures service discovery
- Opens Aspire Dashboard
- Provides WebUI endpoint

Access the WebUI from the Aspire Dashboard or directly at the displayed port.

### Run Standalone (Advanced)

```bash
# Terminal 1: Start Agent service
cd src/InterviewCoach.Agent
dotnet run

# Terminal 2: Start WebUI with agent URL
cd src/InterviewCoach.WebUI
export AGENT_URL=https://localhost:7048
dotnet run
```

**Note**: Standalone requires manually coordinating ports and URLs. Aspire is easier.

## UI Features

### Chat Interface

- **Message Input**: Text area for user messages
- **Send Button**: Submit messages to agent
- **Conversation History**: Scrollable list of messages
- **User/Agent Differentiation**: Visual distinction between user and agent messages

### Markdown Support

Agent responses are rendered as markdown:

- **Headers**: # H1, ## H2, etc.
- **Lists**: Bulleted and numbered
- **Code Blocks**: Syntax-highlighted (if configured)
- **Links**: Clickable URLs
- **Bold/Italic**: Text formatting

### Security Features

**XSS Protection**: DOMPurify sanitizes all rendered HTML to prevent cross-site scripting attacks.

**HTTPS**: Production deployments enforce HTTPS for all communication.

## Customization

### Change UI Theme

Edit Tailwind classes in [Components/Pages/Home.razor](Components/Pages/Home.razor):

```razor
<div class="bg-blue-500 text-white p-4">  <!-- Change colors -->
    ...
</div>
```

### Add Custom CSS

Create or edit [wwwroot/css/app.css](wwwroot/css/app.css):

```css
.custom-chat-bubble {
    border-radius: 12px;
    padding: 1rem;
    margin: 0.5rem 0;
}
```

### Modify Conversation Display

Edit message rendering logic in [Components/Pages/Home.razor](Components/Pages/Home.razor):

```razor
@foreach (var message in messages)
{
    <div class="@(message.IsUser ? "user-message" : "agent-message")">
        @((MarkupString)RenderMarkdown(message.Content))
    </div>
}
```

## Configuration

### Agent Service URL

Configured via Aspire in development, environment variable in production:

**Development** (automatic via Aspire):

```json
{
  "services": {
    "agent": {
      "https": { "scheme": "https", "host": "localhost", "port": 7048 }
    }
  }
}
```

**Production** (Container Apps environment variable):

```bash
AGENT_URL=https://agent.internal.azurecontainerapps.io
```

### Logging

Adjust in [appsettings.json](appsettings.json):

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning",
      "Microsoft.AspNetCore.SignalR": "Debug"  // For SignalR debugging
    }
  }
}
```

## Deployment

### With Aspire (`azd`)

Deploys to Azure Container Apps:

```bash
azd up
```

The WebUI container:

- Exposes public endpoint (HTTPS)
- Connects to Agent service via internal networking
- Includes health checks
- Auto-scales based on HTTP queue length

### Standalone Docker

```bash
# Build
docker build -t interview-coach-webui .

# Run
docker run -p 8080:8080 \
  -e AGENT_URL=https://your-agent-service.com \
  interview-coach-webui
```

## Observability

### Logs

The WebUI emits:

- Page load events
- User message submissions
- Agent response times
- Errors and warnings

View in Aspire Dashboard (local) or Application Insights (Azure).

### Metrics

Built-in ASP.NET Core metrics:

- HTTP request count
- Response time
- SignalR connections
- Error rates

## Troubleshooting

### Cannot Connect to Agent

**Symptoms**: "Service unavailable" or timeout errors

**Solutions**:

1. Check Aspire Dashboard - verify Agent service is running
2. Review WebUI logs for connection errors
3. Test Agent endpoint directly: `curl https://localhost:<agent-port>/health`

### Markdown Not Rendering

**Symptoms**: Raw markdown visible instead of formatted text

**Solutions**:

1. Verify Marked.js is loaded in [wwwroot/index.html](wwwroot/index.html)
2. Check browser console for JavaScript errors
3. Confirm `@((MarkupString)...)` is used for rendering

### SignalR Timeouts

**Symptoms**: Connection drops during long conversations

**Solutions**:

1. Increase timeout in [appsettings.json](appsettings.json):

   ```json
   "ConnectionStrings": {
     "SignalR": {
       "HubOptions": {
         "ClientTimeoutInterval": "00:02:00"
       }
     }
   }
   ```

2. Implement reconnection logic in Blazor component

## Accessibility

The WebUI follows accessibility best practices:

✅ **Semantic HTML**: Proper heading hierarchy, navigation landmarks  
✅ **Keyboard Navigation**: All functions accessible via keyboard  
✅ **Screen Reader Support**: ARIA labels on interactive elements  
✅ **Color Contrast**: WCAG 2.1 AA compliant contrast ratios  

## Performance Optimization

### Current Optimizations

- Server-side rendering (reduces client bundle size)
- Static asset caching (Tailwind, Marked.js)
- Lazy loading of components
- Efficient re-rendering with Blazor diffing

### Future Enhancements

- Virtualization for long conversation histories
- WebAssembly mode for offline capability
- Progressive Web App (PWA) support

## Extending the UI

### Add Voice Input

Integrate browser Speech API:

```javascript
// wwwroot/js/speech.js
function startSpeechRecognition(dotnetHelper) {
    const recognition = new webkitSpeechRecognition();
    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        dotnetHelper.invokeMethodAsync('OnSpeechResult', transcript);
    };
    recognition.start();
}
```

### Add File Upload

Allow users to upload resumes:

```razor
<InputFile OnChange="HandleFileUpload" />

@code {
    async Task HandleFileUpload(InputFileChangeEventArgs e)
    {
        var file = e.File;
        // Send to Agent for processing
    }
}
```

### Add Conversation Export

Download conversation history:

```razor
<button @onclick="ExportConversation">Export Chat</button>

@code {
    void ExportConversation()
    {
        var json = JsonSerializer.Serialize(messages);
        // Trigger download
    }
}
```

## Next Steps

- 🏗️ [Understand the Architecture](../../docs/ARCHITECTURE.md)
- 🔧 [Customize the Agent](../../docs/TUTORIALS.md#tutorial-3-customizing-the-agent)
- 📖 [Learn About Aspire](https://aspire.dev)
- 🎨 [Tailwind CSS Docs](https://tailwindcss.com)

## Resources

- [Blazor Documentation](https://learn.microsoft.com/aspnet/core/blazor)
- [Blazor Server Hosting](https://learn.microsoft.com/aspnet/core/blazor/hosting-models#blazor-server)
- [SignalR Overview](https://learn.microsoft.com/aspnet/core/signalr/introduction)
- [Tailwind CSS](https://tailwindcss.com)
- [Marked.js](https://marked.js.org)
