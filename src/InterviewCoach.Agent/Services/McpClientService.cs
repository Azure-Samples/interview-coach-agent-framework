using ModelContextProtocol.Client;
using System.Text.Json;

namespace InterviewCoach.Agent.Services;

public interface IMcpClientService
{
    Task<Guid> CreateInterviewSessionAsync();
    Task<string?> GetInterviewSessionAsync(Guid sessionId);
    Task UpdateInterviewSessionAsync(Guid sessionId, string? resumeLink, string? resumeText, bool proceedWithoutResume, 
        string? jobDescriptionLink, string? jobDescriptionText, bool proceedWithoutJobDescription, string? transcript);
    Task CompleteInterviewSessionAsync(Guid sessionId);
    Task<string> ConvertToMarkdownAsync(string url);
}

public class McpClientService : IMcpClientService
{
    private readonly IEnumerable<McpClient> _mcpClients;
    private readonly ILogger<McpClientService> _logger;

    public McpClientService(IEnumerable<McpClient> mcpClients, ILogger<McpClientService> logger)
    {
        _mcpClients = mcpClients;
        _logger = logger;
    }

    private McpClient GetInterviewDataClient()
    {
        // For now, return the second client (index 1) which should be interview-data
        return _mcpClients.ElementAtOrDefault(1) ?? throw new InvalidOperationException("Interview Data MCP client not found");
    }

    private McpClient GetMarkitdownClient()
    {
        // For now, return the first client (index 0) which should be markitdown
        return _mcpClients.ElementAtOrDefault(0) ?? throw new InvalidOperationException("MarkItDown MCP client not found");
    }

    public async Task<Guid> CreateInterviewSessionAsync()
    {
        var client = GetInterviewDataClient();
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

    public async Task<string?> GetInterviewSessionAsync(Guid sessionId)
    {
        var client = GetInterviewDataClient();
        
        var arguments = new Dictionary<string, object?>
        {
            ["id"] = sessionId
        };

        var response = await client.CallToolAsync("get_interview_session", arguments);
        
        if (response.Content.Count > 0 && response.Content[0] is { } content)
        {
            var textContent = content as dynamic;
            return textContent?.text?.ToString();
        }
        
        return null;
    }

    public async Task UpdateInterviewSessionAsync(Guid sessionId, string? resumeLink, string? resumeText, 
        bool proceedWithoutResume, string? jobDescriptionLink, string? jobDescriptionText, 
        bool proceedWithoutJobDescription, string? transcript)
    {
        var client = GetInterviewDataClient();
        
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
                Transcript = transcript
            }
        };

        await client.CallToolAsync("update_interview_session", arguments);
    }

    public async Task CompleteInterviewSessionAsync(Guid sessionId)
    {
        var client = GetInterviewDataClient();
        
        var arguments = new Dictionary<string, object?>
        {
            ["id"] = sessionId
        };

        await client.CallToolAsync("complete_interview_session", arguments);
    }

    public async Task<string> ConvertToMarkdownAsync(string url)
    {
        var client = GetMarkitdownClient();
        
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
