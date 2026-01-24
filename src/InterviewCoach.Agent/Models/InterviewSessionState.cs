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
}

public enum InterviewPhase
{
    Triage,
    Analysis,
    BehavioralInterview,
    TechnicalInterview,
    Summary,
    Completed
}
