using System.ComponentModel;
using InterviewCoach.Agent.Models;
using InterviewCoach.Agent.Services;

namespace InterviewCoach.Agent.Tools;

public class TriageTools
{
    private readonly ISessionStateService _sessionStateService;
    private readonly IMcpClientService _mcpClientService;

    public TriageTools(ISessionStateService sessionStateService, IMcpClientService mcpClientService)
    {
        _sessionStateService = sessionStateService;
        _mcpClientService = mcpClientService;
    }

    [Description("Creates a new interview session and returns the session ID")]
    public async Task<string> CreateSession()
    {
        var session = await _sessionStateService.CreateSessionAsync();
        var dbSessionId = await _mcpClientService.CreateInterviewSessionAsync();
        
        session.SessionId = dbSessionId;
        await _sessionStateService.UpdateSessionAsync(session);

        return $"Interview session created with ID: {session.SessionId}. Please provide your resume link or tell me you want to proceed without it.";
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
            return "greeting";
        }

        if (lowerMessage.Contains("start") || lowerMessage.Contains("begin") || lowerMessage.Contains("interview"))
        {
            return "start_interview";
        }

        return "unknown";
    }
}
