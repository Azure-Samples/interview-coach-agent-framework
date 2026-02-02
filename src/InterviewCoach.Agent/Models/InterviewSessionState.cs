namespace InterviewCoach.Agent.Models;

public class InterviewSessionState
{
    public Guid SessionId { get; set; }
    public string? ResumeLink { get; set; }
    public string? ResumeText { get; set; }
    public bool ProceedWithoutResume { get; set; }
    public string? JobDescriptionLink { get; set; }
    public string? JobDescriptionText { get; set; }
    public bool ProceedWithoutJobDescription { get; set; }
    public string? Transcript { get; set; }
    public InterviewPhase CurrentPhase { get; set; } = InterviewPhase.Triage;
    public bool IsAnalysisComplete { get; set; }

    public static implicit operator InterviewSessionContext(InterviewSessionState state)
    {
        return new InterviewSessionContext
        {
            SessionId = state.SessionId,
            ResumeLink = state.ResumeLink,
            ResumeText = state.ResumeText,
            ProceedWithoutResume = state.ProceedWithoutResume,
            JobDescriptionLink = state.JobDescriptionLink,
            JobDescriptionText = state.JobDescriptionText,
            ProceedWithoutJobDescription = state.ProceedWithoutJobDescription,
            Transcript = state.Transcript,
            IsCompleted = state.CurrentPhase == InterviewPhase.Completed
        };
    }
}
