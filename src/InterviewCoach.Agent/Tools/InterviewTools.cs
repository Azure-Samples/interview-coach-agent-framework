using System.ComponentModel;
using InterviewCoach.Agent.Models;
using InterviewCoach.Agent.Services;

namespace InterviewCoach.Agent.Tools;

public class InterviewTools
{
    private readonly ISessionStateService _sessionStateService;
    private readonly IMcpClientService _mcpClientService;

    public InterviewTools(ISessionStateService sessionStateService, IMcpClientService mcpClientService)
    {
        _sessionStateService = sessionStateService;
        _mcpClientService = mcpClientService;
    }

    [Description("Records the interview conversation transcript")]
    public async Task<string> RecordTranscript(
        [Description("The session ID")] Guid sessionId,
        [Description("The conversation transcript to record")] string transcript
    )
    {
        var session = await _sessionStateService.GetSessionAsync(sessionId);
        if (session is null)
        {
            return "Session not found.";
        }

        await _mcpClientService.UpdateInterviewSessionAsync(
            sessionId, session.ResumeLink, session.ResumeText, session.ProceedWithoutResume,
            session.JobDescriptionLink, session.JobDescriptionText, session.ProceedWithoutJobDescription, transcript);

        return "Transcript recorded successfully.";
    }

    [Description("Switches the interview phase to behavioral interview")]
    public async Task<string> SwitchToBehavioralInterview(
        [Description("The session ID")] Guid sessionId
    )
    {
        var session = await _sessionStateService.GetSessionAsync(sessionId);
        if (session is null)
        {
            return "Session not found.";
        }

        session.CurrentPhase = InterviewPhase.BehavioralInterview;
        await _sessionStateService.UpdateSessionAsync(session);

        return "Switched to behavioral interview phase.";
    }

    [Description("Switches the interview phase to technical interview")]
    public async Task<string> SwitchToTechnicalInterview(
        [Description("The session ID")] Guid sessionId
    )
    {
        var session = await _sessionStateService.GetSessionAsync(sessionId);
        if (session is null)
        {
            return "Session not found.";
        }

        session.CurrentPhase = InterviewPhase.TechnicalInterview;
        await _sessionStateService.UpdateSessionAsync(session);

        return "Switched to technical interview phase.";
    }

    [Description("Marks the interview as complete and ready for summary")]
    public async Task<string> CompleteInterview(
        [Description("The session ID")] Guid sessionId
    )
    {
        var session = await _sessionStateService.GetSessionAsync(sessionId);
        if (session is null)
        {
            return "Session not found.";
        }

        session.CurrentPhase = InterviewPhase.Summary;
        await _sessionStateService.UpdateSessionAsync(session);

        return "Interview marked as complete. Ready to generate summary.";
    }
}
