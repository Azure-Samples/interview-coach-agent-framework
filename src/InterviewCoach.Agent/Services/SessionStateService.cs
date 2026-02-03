using InterviewCoach.Agent.Models;

namespace InterviewCoach.Agent.Services;

public interface ISessionStateService
{
    Task<InterviewSessionState> CreateSessionAsync(Guid? sessionId = null);
    Task<InterviewSessionState?> GetSessionAsync(Guid sessionId);
    Task UpdateSessionAsync(InterviewSessionState session);
    Task<bool> IsAnalysisCompleteAsync(Guid sessionId);
}

public class SessionStateService : ISessionStateService
{
    private readonly Dictionary<Guid, InterviewSessionState> _sessions = new();

    public Task<InterviewSessionState> CreateSessionAsync(Guid? sessionId = null)
    {
        var session = new InterviewSessionState
        {
            SessionId = sessionId ?? Guid.NewGuid(),
            CurrentPhase = InterviewPhase.Triage
        };
        _sessions[session.SessionId] = session;
        return Task.FromResult(session);
    }

    public Task<InterviewSessionState?> GetSessionAsync(Guid sessionId)
    {
        _sessions.TryGetValue(sessionId, out var session);
        return Task.FromResult(session);
    }

    public Task UpdateSessionAsync(InterviewSessionState session)
    {
        _sessions[session.SessionId] = session;
        return Task.CompletedTask;
    }

    public Task<bool> IsAnalysisCompleteAsync(Guid sessionId)
    {
        if (!_sessions.TryGetValue(sessionId, out var session))
        {
            return Task.FromResult(false);
        }

        var hasResumeData = !string.IsNullOrEmpty(session.ResumeLink) || !string.IsNullOrEmpty(session.ResumeText) || session.ProceedWithoutResume;
        var hasJobDescriptionData = !string.IsNullOrEmpty(session.JobDescriptionLink) || !string.IsNullOrEmpty(session.JobDescriptionText) || session.ProceedWithoutJobDescription;

        return Task.FromResult(hasResumeData && hasJobDescriptionData);
    }
}
