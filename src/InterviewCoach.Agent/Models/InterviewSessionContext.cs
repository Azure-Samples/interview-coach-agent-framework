namespace InterviewCoach.Agent.Models;

public class InterviewSessionContext
{
    public Guid SessionId { get; set; }
    public string? ResumeLink { get; set; }
    public string? ResumeText { get; set; }
    public bool ProceedWithoutResume { get; set; }
    public string? JobDescriptionLink { get; set; }
    public string? JobDescriptionText { get; set; }
    public bool ProceedWithoutJobDescription { get; set; }
    public string? Transcript { get; set; }
    public bool IsCompleted { get; set; }
}

