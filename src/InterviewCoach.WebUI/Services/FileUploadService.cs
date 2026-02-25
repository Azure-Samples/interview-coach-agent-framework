using System.Text.Json;

namespace InterviewCoach.WebUI.Services;

/// <summary>
/// Uploads files from the browser to the Agent API and returns the serving URL.
/// </summary>
public sealed class FileUploadService(IHttpClientFactory httpClientFactory)
{
    private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".pdf", ".docx", ".doc", ".txt", ".md", ".html"
    };

    private const long MaxFileSize = 10 * 1024 * 1024; // 10 MB

    public static bool IsAllowedFile(string fileName)
    {
        var ext = Path.GetExtension(fileName);
        return AllowedExtensions.Contains(ext);
    }

    /// <summary>
    /// Uploads a file to the Agent API and returns the URL where it can be accessed.
    /// </summary>
    public async Task<string> UploadFileAsync(Stream fileStream, string fileName, string contentType, CancellationToken cancellationToken = default)
    {
        var client = httpClientFactory.CreateClient("agent");

        using var content = new MultipartFormDataContent();
        using var streamContent = new StreamContent(fileStream);
        streamContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue(contentType);
        content.Add(streamContent, "file", fileName);

        var response = await client.PostAsync("upload", content, cancellationToken);
        response.EnsureSuccessStatusCode();

        var json = await response.Content.ReadFromJsonAsync<UploadResponse>(cancellationToken: cancellationToken);
        return json?.Url ?? throw new InvalidOperationException("Upload response did not contain a URL.");
    }

    private sealed class UploadResponse
    {
        public string? Url { get; set; }
    }
}
