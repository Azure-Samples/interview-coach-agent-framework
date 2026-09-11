using System.ComponentModel;

using Microsoft.EntityFrameworkCore;

namespace InterviewCoach.Mcp.InterviewData;

public class InterviewSession
{
    public Guid Id { get; set; }
    public string? ResumeLink { get; set; }
    public string? ResumeText { get; set; }
    public bool ProceedWithoutResume { get; set; }
    public string? JobDescriptionLink { get; set; }
    public string? JobDescriptionText { get; set; }
    public bool ProceedWithoutJobDescription { get; set; }
    [Description("Stored transcript on read. On update, send only new text to append; never copy the stored transcript back.")]
    public string? Transcript { get; set; }
    [Description("Completion status on read. Updates ignore this field; call complete_interview_session to finish.")]
    public bool IsCompleted { get; set; } = false;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class InterviewDataDbContext(DbContextOptions<InterviewDataDbContext> options) : DbContext(options)
{
    public DbSet<InterviewSession> InterviewSessions { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<InterviewSession>(builder =>
        {
            builder.ToContainer("interviewsessions");
            builder.HasKey(t => t.Id);
            builder.HasPartitionKey(t => t.Id);
            builder.Property(t => t.Id).ToJsonProperty("id");
        });
    }
}
