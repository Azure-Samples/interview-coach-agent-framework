namespace InterviewCoach.Agent.Models;

public sealed record ToolResponse(string Message, bool Success = true);

public sealed record ToolResponse<T>(string Message, T? Data, bool Success = true);
