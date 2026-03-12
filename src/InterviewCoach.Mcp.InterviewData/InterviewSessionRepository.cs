using System.Text;

using Microsoft.EntityFrameworkCore;

namespace InterviewCoach.Mcp.InterviewData;

public interface IInterviewSessionRepository
{
    Task<InterviewSession> AddInterviewSessionAsync(InterviewSession interviewSession);
    Task<IEnumerable<InterviewSession>> GetAllInterviewSessionsAsync();
    Task<InterviewSession?> GetInterviewSessionAsync(Guid id);
    Task<InterviewSession?> UpdateInterviewSessionAsync(InterviewSession interviewSession);
    Task<InterviewSession?> CompleteInterviewSessionAsync(Guid id);
    Task<string?> GetFormattedSummaryAsync(Guid id);
}

public class InterviewSessionRepository(InterviewDataDbContext db) : IInterviewSessionRepository
{
    public async Task<InterviewSession> AddInterviewSessionAsync(InterviewSession interviewSession)
    {
        var added = await db.InterviewSessions.AddAsync(interviewSession);
        await db.SaveChangesAsync();

        return added.Entity;
    }

    public async Task<IEnumerable<InterviewSession>> GetAllInterviewSessionsAsync()
    {
        var items = await db.InterviewSessions.ToListAsync();

        return items;
    }

    public async Task<InterviewSession?> GetInterviewSessionAsync(Guid id)
    {
        var record = await db.InterviewSessions.SingleOrDefaultAsync(p => p.Id == id);

        return record;
    }

    public async Task<InterviewSession?> UpdateInterviewSessionAsync(InterviewSession interviewSession)
    {
        var record = await db.InterviewSessions.SingleOrDefaultAsync(p => p.Id == interviewSession.Id);
        if (record is null)
        {
            return default;
        }

        record.ResumeLink = interviewSession.ResumeLink;
        record.ResumeText = interviewSession.ResumeText;
        record.ProceedWithoutResume = interviewSession.ProceedWithoutResume;
        record.JobDescriptionLink = interviewSession.JobDescriptionLink;
        record.JobDescriptionText = interviewSession.JobDescriptionText;
        record.ProceedWithoutJobDescription = interviewSession.ProceedWithoutJobDescription;
        record.UpdatedAt = DateTimeOffset.UtcNow;

        var sb = new StringBuilder();
        sb.AppendLine(record.Transcript ?? string.Empty);
        sb.AppendLine();
        sb.AppendLine(interviewSession.Transcript ?? string.Empty);
        record.Transcript = sb.ToString();

        await db.InterviewSessions.Where(r => r.Id == interviewSession.Id)
                                  .ExecuteUpdateAsync(r => r.SetProperty(p => p.ResumeLink, record.ResumeLink)
                                                            .SetProperty(p => p.ResumeText, record.ResumeText)
                                                            .SetProperty(p => p.ProceedWithoutResume, record.ProceedWithoutResume)
                                                            .SetProperty(p => p.JobDescriptionLink, record.JobDescriptionLink)
                                                            .SetProperty(p => p.JobDescriptionText, record.JobDescriptionText)
                                                            .SetProperty(p => p.ProceedWithoutJobDescription, record.ProceedWithoutJobDescription)
                                                            .SetProperty(p => p.Transcript, record.Transcript)
                                                            .SetProperty(p => p.UpdatedAt, record.UpdatedAt));

        await db.SaveChangesAsync();

        return record;
    }

    public async Task<InterviewSession?> CompleteInterviewSessionAsync(Guid id)
    {
        var record = await db.InterviewSessions.SingleOrDefaultAsync(p => p.Id == id);
        if (record is null)
        {
            return default;
        }

        record.IsCompleted = true;

        await db.InterviewSessions.Where(p => p.Id == id)
                                  .ExecuteUpdateAsync(p => p.SetProperty(x => x.IsCompleted, true));

        await db.SaveChangesAsync();

        return record;
    }

    public async Task<string?> GetFormattedSummaryAsync(Guid id)
    {
        var record = await db.InterviewSessions.SingleOrDefaultAsync(p => p.Id == id);
        if (record is null)
        {
            return default;
        }

        var sb = new StringBuilder();
        sb.AppendLine("# Interview Session Summary");
        sb.AppendLine();
        sb.AppendLine($"**Session ID:** {record.Id}");
        sb.AppendLine($"**Date:** {record.CreatedAt:yyyy-MM-dd HH:mm} UTC");
        sb.AppendLine($"**Status:** {(record.IsCompleted ? "Completed" : "In Progress")}");
        sb.AppendLine();

        if (!string.IsNullOrWhiteSpace(record.ResumeLink))
        {
            sb.AppendLine("---");
            sb.AppendLine();
            sb.AppendLine("## Resume");
            sb.AppendLine();
            sb.AppendLine($"**Source:** {record.ResumeLink}");
            if (!string.IsNullOrWhiteSpace(record.ResumeText))
            {
                sb.AppendLine();
                sb.AppendLine(record.ResumeText.Trim());
            }
            sb.AppendLine();
        }
        else if (record.ProceedWithoutResume)
        {
            sb.AppendLine("---");
            sb.AppendLine();
            sb.AppendLine("## Resume");
            sb.AppendLine();
            sb.AppendLine("*Proceeded without resume.*");
            sb.AppendLine();
        }

        if (!string.IsNullOrWhiteSpace(record.JobDescriptionLink))
        {
            sb.AppendLine("---");
            sb.AppendLine();
            sb.AppendLine("## Job Description");
            sb.AppendLine();
            sb.AppendLine($"**Source:** {record.JobDescriptionLink}");
            if (!string.IsNullOrWhiteSpace(record.JobDescriptionText))
            {
                sb.AppendLine();
                sb.AppendLine(record.JobDescriptionText.Trim());
            }
            sb.AppendLine();
        }
        else if (record.ProceedWithoutJobDescription)
        {
            sb.AppendLine("---");
            sb.AppendLine();
            sb.AppendLine("## Job Description");
            sb.AppendLine();
            sb.AppendLine("*Proceeded without job description.*");
            sb.AppendLine();
        }

        if (!string.IsNullOrWhiteSpace(record.Transcript))
        {
            sb.AppendLine("---");
            sb.AppendLine();
            sb.AppendLine("## Interview Transcript");
            sb.AppendLine();
            sb.AppendLine(record.Transcript.Trim());
            sb.AppendLine();
        }

        sb.AppendLine("---");
        sb.AppendLine();
        sb.AppendLine($"*Generated on {DateTimeOffset.UtcNow:yyyy-MM-dd HH:mm} UTC*");

        return sb.ToString();
    }
}