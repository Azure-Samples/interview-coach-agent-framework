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

        var existingTranscript = record.Transcript?.Trim();
        var newTranscript = interviewSession.Transcript?.Trim();
        record.Transcript = string.IsNullOrEmpty(existingTranscript)
            ? newTranscript ?? string.Empty
            : string.IsNullOrEmpty(newTranscript)
                ? existingTranscript
                : $"{existingTranscript}\n\n{newTranscript}";

        await db.InterviewSessions.Where(r => r.Id == interviewSession.Id)
                                  .ExecuteUpdateAsync(r => r.SetProperty(p => p.ResumeLink, record.ResumeLink)
                                                            .SetProperty(p => p.ResumeText, record.ResumeText)
                                                            .SetProperty(p => p.ProceedWithoutResume, record.ProceedWithoutResume)
                                                            .SetProperty(p => p.JobDescriptionLink, record.JobDescriptionLink)
                                                            .SetProperty(p => p.JobDescriptionText, record.JobDescriptionText)
                                                            .SetProperty(p => p.ProceedWithoutJobDescription, record.ProceedWithoutJobDescription)
                                                            .SetProperty(p => p.Transcript, record.Transcript)
                                                            .SetProperty(p => p.UpdatedAt, record.UpdatedAt));

        db.Entry(record).State = EntityState.Detached;

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

        db.Entry(record).State = EntityState.Detached;

        return record;
    }
}