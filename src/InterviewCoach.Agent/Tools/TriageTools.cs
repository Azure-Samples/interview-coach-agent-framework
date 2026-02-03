using System.ComponentModel;

using InterviewCoach.Agent.Models;
using InterviewCoach.Agent.Services;

namespace InterviewCoach.Agent.Tools;

public class TriageTools(ISessionStateService sessionStateService, IMcpClientService mcpClientService)
{
    private readonly ISessionStateService _sessionStateService = sessionStateService ?? throw new ArgumentNullException(nameof(sessionStateService));
    private readonly IMcpClientService _mcpClientService = mcpClientService ?? throw new ArgumentNullException(nameof(mcpClientService));

    [Description("Creates a new interview session and returns the session ID")]
    public async Task<string> CreateSession(
        [Description("The session ID of the interview session")] Guid sessionId
    )
    {
        var session = await _sessionStateService.CreateSessionAsync(sessionId);
        var dbSessionId = await _mcpClientService.CreateInterviewSessionAsync(sessionId);
        
        session.SessionId = dbSessionId;
        await _sessionStateService.UpdateSessionAsync(session);

        return ToolResponseJson.Ok($"Interview session created with ID: {session.SessionId}. Please provide your resume link or tell me you want to proceed without it.", session.SessionId);
    }

    public async Task<string> GetSession(
        [Description("The session ID of the interview session")] Guid sessionId
    )
    {
        var session = await _sessionStateService.GetSessionAsync(sessionId);
        var message = session is null ? "Session not found." : "Session retrieved.";
        return session is null
            ? ToolResponseJson.Error<InterviewSessionState?>(message, null)
            : ToolResponseJson.Ok(message, session);
    }

    [Description("Determines if the user's message is a greeting or initial conversation starter")]
    public async Task<string> ClassifyIntent(
        [Description("The user's message")] string userMessage
    )
    {
        var lowerMessage = userMessage.ToLowerInvariant();
        var greetings = new[] { "hello", "hi", "hey", "greetings", "good morning", "good afternoon", "good evening" };
        
        if (greetings.Any(g => lowerMessage.Contains(g)))
        {
            return ToolResponseJson.Ok("Intent classified.", "greeting");
        }

        if (lowerMessage.Contains("start") || lowerMessage.Contains("begin") || lowerMessage.Contains("interview"))
        {
            return ToolResponseJson.Ok("Intent classified.", "start_interview");
        }

        return ToolResponseJson.Ok("Intent classified.", "unknown");
    }
}
