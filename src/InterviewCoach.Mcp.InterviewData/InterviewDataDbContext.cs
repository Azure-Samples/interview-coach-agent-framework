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
    public string? Transcript { get; set; }
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
