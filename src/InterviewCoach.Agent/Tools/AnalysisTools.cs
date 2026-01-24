using System.ComponentModel;
using InterviewCoach.Agent.Models;
using InterviewCoach.Agent.Services;

namespace InterviewCoach.Agent.Tools;

public class AnalysisTools
{
    private readonly ISessionStateService _sessionStateService;
    private readonly IMcpClientService _mcpClientService;

    public AnalysisTools(ISessionStateService sessionStateService, IMcpClientService mcpClientService)
    {
        _sessionStateService = sessionStateService;
        _mcpClientService = mcpClientService;
    }

    [Description("Captures the resume link provided by the user")]
    public async Task<string> CaptureResumeLink(
        [Description("The session ID")] Guid sessionId,
        [Description("The resume link URL")] string resumeLink
    )
    {
        var session = await _sessionStateService.GetSessionAsync(sessionId);
        if (session is null)
        {
            return "Session not found. Please start a new interview session.";
        }

        session.ResumeLink = resumeLink;
        
        try
        {
            var markdownContent = await _mcpClientService.ConvertToMarkdownAsync(resumeLink);
            session.ResumeText = markdownContent;
        }
        catch (Exception ex)
        {
            return $"Failed to convert resume to markdown: {ex.Message}. Please provide the resume text directly or choose to proceed without it.";
        }

        await _sessionStateService.UpdateSessionAsync(session);
        await _mcpClientService.UpdateInterviewSessionAsync(
            sessionId, session.ResumeLink, session.ResumeText, session.ProceedWithoutResume,
            session.JobDescriptionLink, session.JobDescriptionText, session.ProceedWithoutJobDescription, null);

        return "Resume captured successfully. Now, please provide the job description link or tell me you want to proceed without it.";
    }

    [Description("Captures the resume text provided directly by the user")]
    public async Task<string> CaptureResumeText(
        [Description("The session ID")] Guid sessionId,
        [Description("The resume text content")] string resumeText
    )
    {
        var session = await _sessionStateService.GetSessionAsync(sessionId);
        if (session is null)
        {
            return "Session not found. Please start a new interview session.";
        }

        session.ResumeText = resumeText;
        await _sessionStateService.UpdateSessionAsync(session);
        await _mcpClientService.UpdateInterviewSessionAsync(
            sessionId, session.ResumeLink, session.ResumeText, session.ProceedWithoutResume,
            session.JobDescriptionLink, session.JobDescriptionText, session.ProceedWithoutJobDescription, null);

        return "Resume text captured successfully. Now, please provide the job description link or tell me you want to proceed without it.";
    }

    [Description("Marks that the user wants to proceed without providing a resume")]
    public async Task<string> ProceedWithoutResume(
        [Description("The session ID")] Guid sessionId
    )
    {
        var session = await _sessionStateService.GetSessionAsync(sessionId);
        if (session is null)
        {
            return "Session not found. Please start a new interview session.";
        }

        session.ProceedWithoutResume = true;
        await _sessionStateService.UpdateSessionAsync(session);
        await _mcpClientService.UpdateInterviewSessionAsync(
            sessionId, session.ResumeLink, session.ResumeText, session.ProceedWithoutResume,
            session.JobDescriptionLink, session.JobDescriptionText, session.ProceedWithoutJobDescription, null);

        return "Understood, proceeding without resume. Now, please provide the job description link or tell me you want to proceed without it.";
    }

    [Description("Captures the job description link provided by the user")]
    public async Task<string> CaptureJobDescriptionLink(
        [Description("The session ID")] Guid sessionId,
        [Description("The job description link URL")] string jobDescriptionLink
    )
    {
        var session = await _sessionStateService.GetSessionAsync(sessionId);
        if (session is null)
        {
            return "Session not found. Please start a new interview session.";
        }

        session.JobDescriptionLink = jobDescriptionLink;
        
        try
        {
            var markdownContent = await _mcpClientService.ConvertToMarkdownAsync(jobDescriptionLink);
            session.JobDescriptionText = markdownContent;
        }
        catch (Exception ex)
        {
            return $"Failed to convert job description to markdown: {ex.Message}. Please provide the job description text directly or choose to proceed without it.";
        }

        await _sessionStateService.UpdateSessionAsync(session);
        await _mcpClientService.UpdateInterviewSessionAsync(
            sessionId, session.ResumeLink, session.ResumeText, session.ProceedWithoutResume,
            session.JobDescriptionLink, session.JobDescriptionText, session.ProceedWithoutJobDescription, null);

        var isComplete = await _sessionStateService.IsAnalysisCompleteAsync(sessionId);
        if (isComplete)
        {
            session.CurrentPhase = InterviewPhase.BehavioralInterview;
            session.IsAnalysisComplete = true;
            await _sessionStateService.UpdateSessionAsync(session);
            return "Job description captured successfully. Analysis phase complete. Ready to start the interview. Would you like to begin with behavioral or technical questions?";
        }

        return "Job description captured successfully.";
    }

    [Description("Captures the job description text provided directly by the user")]
    public async Task<string> CaptureJobDescriptionText(
        [Description("The session ID")] Guid sessionId,
        [Description("The job description text content")] string jobDescriptionText
    )
    {
        var session = await _sessionStateService.GetSessionAsync(sessionId);
        if (session is null)
        {
            return "Session not found. Please start a new interview session.";
        }

        session.JobDescriptionText = jobDescriptionText;
        await _sessionStateService.UpdateSessionAsync(session);
        await _mcpClientService.UpdateInterviewSessionAsync(
            sessionId, session.ResumeLink, session.ResumeText, session.ProceedWithoutResume,
            session.JobDescriptionLink, session.JobDescriptionText, session.ProceedWithoutJobDescription, null);

        var isComplete = await _sessionStateService.IsAnalysisCompleteAsync(sessionId);
        if (isComplete)
        {
            session.CurrentPhase = InterviewPhase.BehavioralInterview;
            session.IsAnalysisComplete = true;
            await _sessionStateService.UpdateSessionAsync(session);
            return "Job description text captured successfully. Analysis phase complete. Ready to start the interview. Would you like to begin with behavioral or technical questions?";
        }

        return "Job description text captured successfully.";
    }

    [Description("Marks that the user wants to proceed without providing a job description")]
    public async Task<string> ProceedWithoutJobDescription(
        [Description("The session ID")] Guid sessionId
    )
    {
        var session = await _sessionStateService.GetSessionAsync(sessionId);
        if (session is null)
        {
            return "Session not found. Please start a new interview session.";
        }

        session.ProceedWithoutJobDescription = true;
        await _sessionStateService.UpdateSessionAsync(session);
        await _mcpClientService.UpdateInterviewSessionAsync(
            sessionId, session.ResumeLink, session.ResumeText, session.ProceedWithoutResume,
            session.JobDescriptionLink, session.JobDescriptionText, session.ProceedWithoutJobDescription, null);

        var isComplete = await _sessionStateService.IsAnalysisCompleteAsync(sessionId);
        if (isComplete)
        {
            session.CurrentPhase = InterviewPhase.BehavioralInterview;
            session.IsAnalysisComplete = true;
            await _sessionStateService.UpdateSessionAsync(session);
            return "Understood, proceeding without job description. Analysis phase complete. Ready to start the interview. Would you like to begin with behavioral or technical questions?";
        }

        return "Understood, proceeding without job description.";
    }

    [Description("Checks if the analysis phase is complete (both resume and job description captured or skipped)")]
    public async Task<bool> IsAnalysisComplete(
        [Description("The session ID")] Guid sessionId
    )
    {
        return await _sessionStateService.IsAnalysisCompleteAsync(sessionId);
    }
}
