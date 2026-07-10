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

        await db.SaveChangesAsync();

        return record;
    }
}