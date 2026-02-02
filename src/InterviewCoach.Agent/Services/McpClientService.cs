using System.Text.Json;

using InterviewCoach.Agent.Models;

using ModelContextProtocol.Client;

namespace InterviewCoach.Agent.Services;

public interface IMcpClientService
{
    Task<Guid> CreateInterviewSessionAsync();
    Task<InterviewSessionContext?> GetInterviewSessionAsync(Guid sessionId);
    Task UpdateInterviewSessionAsync(InterviewSessionContext context);
    Task CompleteInterviewSessionAsync(Guid sessionId);
    Task<string> ConvertToMarkdownAsync(string url);
}

public class McpClientService(
    [FromKeyedServices("mcp-interview-data")] McpClient interviewDataClient,
    [FromKeyedServices("mcp-markitdown")] McpClient markitdownClient,
    ILogger<McpClientService> logger) : IMcpClientService
{
    private readonly McpClient _interviewDataClient = interviewDataClient ?? throw new ArgumentNullException(nameof(interviewDataClient));
    private readonly McpClient _markitdownClient = markitdownClient ?? throw new ArgumentNullException(nameof(markitdownClient));
    private readonly ILogger<McpClientService> _logger = logger ?? throw new ArgumentNullException(nameof(logger));

    public async Task<Guid> CreateInterviewSessionAsync()
    {
        var client = _interviewDataClient;
        var sessionId = Guid.NewGuid();
        
        var arguments = new Dictionary<string, object?>
        {
            ["record"] = new
            {
                Id = sessionId,
                ResumeLink = (string?)null,
                ResumeText = (string?)null,
                ProceedWithoutResume = false,
                JobDescriptionLink = (string?)null,
                JobDescriptionText = (string?)null,
                ProceedWithoutJobDescription = false,
                Transcript = (string?)null,
                IsCompleted = false
            }
        };

        await client.CallToolAsync("add_interview_session", arguments);
        
        return sessionId;
    }

    public async Task<InterviewSessionContext?> GetInterviewSessionAsync(Guid sessionId)
    {
        var client = _interviewDataClient;
        
        var arguments = new Dictionary<string, object?>
        {
            ["id"] = sessionId
        };

        var response = await client.CallToolAsync("get_interview_session", arguments);
        
        if (response.Content.Count > 0 && response.Content[0] is { } content)
        {
            var textContent = content as dynamic;
            return JsonSerializer.Deserialize<InterviewSessionContext>(textContent?.text?.ToString() ?? string.Empty);
        }
        
        return null;
    }

    public async Task UpdateInterviewSessionAsync(InterviewSessionContext context)
    {
        if (context is null)
        {
            throw new ArgumentNullException(nameof(context));
        }

        var sessionId = context.SessionId;
        var resumeLink = context.ResumeLink;
        var resumeText = context.ResumeText;
        var proceedWithoutResume = context.ProceedWithoutResume;
        var jobDescriptionLink = context.JobDescriptionLink;
        var jobDescriptionText = context.JobDescriptionText;
        var proceedWithoutJobDescription = context.ProceedWithoutJobDescription;
        var transcript = context.Transcript;
        var isCompleted = context.IsCompleted;
        var client = _interviewDataClient;
        
        var arguments = new Dictionary<string, object?>
        {
            ["record"] = new
            {
                Id = sessionId,
                ResumeLink = resumeLink,
                ResumeText = resumeText,
                ProceedWithoutResume = proceedWithoutResume,
                JobDescriptionLink = jobDescriptionLink,
                JobDescriptionText = jobDescriptionText,
                ProceedWithoutJobDescription = proceedWithoutJobDescription,
                Transcript = transcript,
                IsCompleted = isCompleted
            }
        };

        await client.CallToolAsync("update_interview_session", arguments);
    }

    public async Task CompleteInterviewSessionAsync(Guid sessionId)
    {
        var client = _interviewDataClient;
        
        var arguments = new Dictionary<string, object?>
        {
            ["id"] = sessionId
        };

        await client.CallToolAsync("complete_interview_session", arguments);
    }

    public async Task<string> ConvertToMarkdownAsync(string url)
    {
        var client = _markitdownClient;
        
        var arguments = new Dictionary<string, object?>
        {
            ["source"] = url
        };

        var response = await client.CallToolAsync("markitdown", arguments);
        
        if (response.Content.Count > 0 && response.Content[0] is { } content)
        {
            var textContent = content as dynamic;
            return textContent?.text?.ToString() ?? string.Empty;
        }
        
        return string.Empty;
    }
}
