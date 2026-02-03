using System.Text.Json;

using InterviewCoach.Agent.Models;

namespace InterviewCoach.Agent.Tools;

internal static class ToolResponseJson
{
    private static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web);

    private static string AsJsonString<T>(T value)
        => JsonSerializer.Serialize(value, Options);

    public static string Ok(string message) => AsJsonString(new ToolResponse(message));

    public static string Error(string message) => AsJsonString(new ToolResponse(message, Success: false));

    public static string Ok<T>(string message, T? data) => AsJsonString(new ToolResponse<T>(message, data));

    public static string Error<T>(string message, T? data = default) => AsJsonString(new ToolResponse<T>(message, data, Success: false));
}
