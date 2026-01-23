using System.Text;

using Microsoft.EntityFrameworkCore;

namespace InterviewCoach.Mcp.InterviewData;

public interface IInterviewSessionRepository
{
    Task<InterviewSession> AddInterviewSessionAsync(InterviewSession interviewSession);
    Task<IEnumerable<InterviewSession>> GetAllInterviewSessionsAsync();
    Task<InterviewSession> UpdateInterviewSessionAsync(InterviewSession interviewSession);
    Task<InterviewSession> CompleteInterviewSessionAsync(InterviewSession interviewSession);
}

public class InterviewSessionRepository(InterviewDataDbContext db) : IInterviewSessionRepository
{
    public async Task<InterviewSession> AddInterviewSessionAsync(InterviewSession interviewSession)
    {
        await db.InterviewSessions.AddAsync(interviewSession);
        await db.SaveChangesAsync();

        return interviewSession;
    }

    public async Task<IEnumerable<InterviewSession>> GetAllInterviewSessionsAsync()
    {
        var items = await db.InterviewSessions.ToListAsync();

        return items;
    }

    public async Task<InterviewSession> UpdateInterviewSessionAsync(InterviewSession interviewSession)
    {
        var record = await db.InterviewSessions.SingleOrDefaultAsync(p => p.Id == interviewSession.Id);
        if (record is null)
        {
            return default!;
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

    public async Task<InterviewSession> CompleteInterviewSessionAsync(InterviewSession interviewSession)
    {
        var record = await db.InterviewSessions.SingleOrDefaultAsync(p => p.Id == interviewSession.Id);
        if (record is null)
        {
            return default!;
        }

        record.IsCompleted = interviewSession.IsCompleted;

        await db.InterviewSessions.Where(p => p.Id == interviewSession.Id)
                                  .ExecuteUpdateAsync(p => p.SetProperty(x => x.IsCompleted, interviewSession.IsCompleted));

        await db.SaveChangesAsync();

        return record;
    }
}