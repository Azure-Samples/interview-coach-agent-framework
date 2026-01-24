using System.ComponentModel;
using InterviewCoach.Agent.Models;
using InterviewCoach.Agent.Services;

namespace InterviewCoach.Agent.Tools;

public class SummaryTools
{
    private readonly ISessionStateService _sessionStateService;
    private readonly IMcpClientService _mcpClientService;

    public SummaryTools(ISessionStateService sessionStateService, IMcpClientService mcpClientService)
    {
        _sessionStateService = sessionStateService;
        _mcpClientService = mcpClientService;
    }

    [Description("Generates and returns the final interview summary in markdown format")]
    public async Task<string> GenerateSummary(
        [Description("The session ID")] Guid sessionId
    )
    {
        var session = await _sessionStateService.GetSessionAsync(sessionId);
        if (session is null)
        {
            return "Session not found.";
        }

        var sessionData = await _mcpClientService.GetInterviewSessionAsync(sessionId);
        
        session.CurrentPhase = InterviewPhase.Completed;
        await _sessionStateService.UpdateSessionAsync(session);
        await _mcpClientService.CompleteInterviewSessionAsync(sessionId);

        return "Summary generated and session completed. Please format the summary in markdown with the following sections: Overview, Key Highlights, Areas for Improvement, and Recommendations.";
    }

    [Description("Formats the final summary in markdown")]
    public string FormatSummary(
        [Description("The overview section")] string overview,
        [Description("The key highlights section")] string keyHighlights,
        [Description("The areas for improvement section")] string areasForImprovement,
        [Description("The recommendations section")] string recommendations
    )
    {
        return $"""
            # Interview Summary

            ## Overview
            {overview}

            ## Key Highlights
            {keyHighlights}

            ## Areas for Improvement
            {areasForImprovement}

            ## Recommendations
            {recommendations}
            """;
    }
}
