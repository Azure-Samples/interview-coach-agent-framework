using System.ComponentModel;

using ModelContextProtocol;
using ModelContextProtocol.Server;

namespace InterviewCoach.Mcp.InterviewData;

public interface IInterviewSessionTool
{
    Task<InterviewSession> AddInterviewSessionAsync(InterviewSession record);
    Task<IEnumerable<InterviewSession>> GetAllInterviewSessionsAsync();
    Task<InterviewSession?> GetInterviewSessionAsync(Guid id);
    Task<InterviewSession> UpdateInterviewSessionAsync(InterviewSession record);
    Task<InterviewSession> CompleteInterviewSessionAsync(Guid id);
}

[McpServerToolType]
public class InterviewSessionTool(IInterviewSessionRepository repository, ILogger<InterviewSessionTool> logger) : IInterviewSessionTool
{
    [McpServerTool(Name = "add_interview_session", Title = "Add an interview session")]
    [Description("Creates a new interview session in the database. Use this after get_interview_session returns no record; update_interview_session cannot create one.")]
    public async Task<InterviewSession> AddInterviewSessionAsync(
        [Description("The interview session details")] InterviewSession record
    )
    {
        var result = await repository.AddInterviewSessionAsync(record);

        logger.LogInformation("Added interview session with ID '{id}'", result.Id);

        return result;
    }

    [McpServerTool(Name = "get_interview_sessions", Title = "Get a list of interview sessions")]
    [Description("Gets a list of interview sessions from database.")]
    public async Task<IEnumerable<InterviewSession>> GetAllInterviewSessionsAsync()
    {
        var interviewSessions = await repository.GetAllInterviewSessionsAsync();

        logger.LogInformation("Retrieved {Count} interview sessions.", interviewSessions.Count());

        return interviewSessions;
    }

    [McpServerTool(Name = "get_interview_session", Title = "Get an interview session")]
    [Description("Gets an interview session from the database by ID. Returns no record when the session has not been created.")]
    public async Task<InterviewSession?> GetInterviewSessionAsync(
        [Description("The ID of the interview session")] Guid id
    )
    {
        var record = await repository.GetInterviewSessionAsync(id);
        if (record is null)
        {
            logger.LogWarning("Interview session with ID '{id}' not found.", id);

            return default;
        }

        logger.LogInformation("Retrieved interview session with ID '{id}'", id);

        return record;
    }

    [McpServerTool(Name = "update_interview_session", Title = "Update an interview session")]
    [Description("Updates an existing interview session. This does not create a missing session; call add_interview_session first.")]
    public async Task<InterviewSession> UpdateInterviewSessionAsync(
        [Description("The interview session details")] InterviewSession record
    )
    {
        var updated = await repository.UpdateInterviewSessionAsync(record);
        if (updated is null)
        {
            logger.LogWarning("Interview session with ID '{id}' not found.", record.Id);

            throw new McpException(
                $"Interview session '{record.Id}' does not exist. Call add_interview_session before updating it.");
        }

        logger.LogInformation("Updated interview session with ID '{id}'", record.Id);

        return updated;
    }

    [McpServerTool(Name = "complete_interview_session", Title = "Complete an interview session")]
    [Description("Marks an existing interview session as complete. This does not create a missing session.")]
    public async Task<InterviewSession> CompleteInterviewSessionAsync(
        [Description("The interview session details")] Guid id
    )
    {
        var completed = await repository.CompleteInterviewSessionAsync(id).ConfigureAwait(false);
        if (completed is null)
        {
            logger.LogWarning("Interview session with ID '{id}' not found.", id);

            throw new McpException(
                $"Interview session '{id}' does not exist. Call add_interview_session before completing it.");
        }

        logger.LogInformation("Completed interview session: '{id}'", id);

        return completed;
    }
}
