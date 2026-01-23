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
        modelBuilder.Entity<InterviewSession>().ToTable("InterviewSessions")
                                       .HasKey(t => t.Id);
        modelBuilder.Entity<InterviewSession>().Property(t => t.Id).IsRequired();
        modelBuilder.Entity<InterviewSession>().Property(t => t.ResumeLink);
        modelBuilder.Entity<InterviewSession>().Property(t => t.ResumeText);
        modelBuilder.Entity<InterviewSession>().Property(t => t.ProceedWithoutResume).IsRequired();
        modelBuilder.Entity<InterviewSession>().Property(t => t.JobDescriptionLink);
        modelBuilder.Entity<InterviewSession>().Property(t => t.JobDescriptionText);
        modelBuilder.Entity<InterviewSession>().Property(t => t.ProceedWithoutJobDescription).IsRequired();
        modelBuilder.Entity<InterviewSession>().Property(t => t.Transcript);
        modelBuilder.Entity<InterviewSession>().Property(t => t.IsCompleted).IsRequired();
        modelBuilder.Entity<InterviewSession>().Property(t => t.CreatedAt).IsRequired();
        modelBuilder.Entity<InterviewSession>().Property(t => t.UpdatedAt).IsRequired();
    }
}
