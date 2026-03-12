using System.Collections.Concurrent;
using System.Text;
using System.Text.Json;

using InterviewCoach.Agent;

using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

using Microsoft.Agents.AI;
using Microsoft.Agents.AI.DevUI;
using Microsoft.Agents.AI.Hosting.AGUI.AspNetCore;
using Microsoft.Extensions.AI;

using ModelContextProtocol.Client;
using ModelContextProtocol.Protocol;

var builder = WebApplication.CreateBuilder(args);
var config = builder.Configuration;

builder.AddServiceDefaults();

builder.Services.AddHttpClient("mcp-markitdown", client =>
{
    client.BaseAddress = new Uri("https+http://mcp-markitdown");
});

builder.Services.AddKeyedSingleton<McpClient>("mcp-markitdown", (sp, obj) =>
{
    var loggerFactory = sp.GetRequiredService<ILoggerFactory>();
    var httpClient = sp.GetRequiredService<IHttpClientFactory>()
                       .CreateClient("mcp-markitdown");
    var endpoint = builder.Environment.IsDevelopment() == true
                 ? $"{httpClient.BaseAddress!.ToString().Replace("https+", string.Empty).TrimEnd('/')}"
                 : $"{httpClient.BaseAddress!.ToString().Replace("+http", string.Empty).TrimEnd('/')}";

    var clientTransportOptions = new HttpClientTransportOptions()
    {
        Endpoint = new Uri($"{endpoint}/sse")
    };
    var clientTransport = new HttpClientTransport(clientTransportOptions, httpClient, loggerFactory);

    var clientOptions = new McpClientOptions()
    {
        ClientInfo = new Implementation()
        {
            Name = "MCP MarkItDown Client",
            Version = "1.0.0",
        }
    };

    return McpClient.CreateAsync(clientTransport, clientOptions, loggerFactory).GetAwaiter().GetResult();
});


builder.Services.AddHttpClient("mcp-interview-data", client =>
{
    client.BaseAddress = new Uri("https+http://mcp-interview-data");
});

builder.Services.AddKeyedSingleton<McpClient>("mcp-interview-data", (sp, obj) =>
{
    var loggerFactory = sp.GetRequiredService<ILoggerFactory>();
    var httpClient = sp.GetRequiredService<IHttpClientFactory>()
                       .CreateClient("mcp-interview-data");

    var clientTransportOptions = new HttpClientTransportOptions()
    {
        Endpoint = new Uri($"{httpClient.BaseAddress!.ToString().Replace("+http", string.Empty).TrimEnd('/')}/mcp")
    };
    var clientTransport = new HttpClientTransport(clientTransportOptions, httpClient, loggerFactory);

    var clientOptions = new McpClientOptions()
    {
        ClientInfo = new Implementation()
        {
            Name = "MCP Interview Data Client",
            Version = "1.0.0",
        }
    };

    return McpClient.CreateAsync(clientTransport, clientOptions, loggerFactory).GetAwaiter().GetResult();
});

if (config[Constants.LlmProvider] != "MicrosoftFoundry")
{
    builder.AddOpenAIClient("chat")
           .AddChatClient();
}
else
{
    builder.AddOpenAIClient("chat")
           .AddChatClient();

    // var connection = new DbConnectionStringBuilder() { ConnectionString = config.GetConnectionString("foundry") };
    // var endpoint = connection.TryGetValue("Endpoint", out var endpointValue) ? endpointValue?.ToString() : throw new InvalidOperationException("Missing Foundry Endpoint");
    // // var accessKey = connection.TryGetValue("Key", out var accessKeyValue) ? accessKeyValue?.ToString() : throw new InvalidOperationException("Missing Foundry Key");
    // var model = connection.TryGetValue("Model", out var modelValue) ? modelValue?.ToString() : throw new InvalidOperationException("Missing Foundry Model");
    // var options = new OpenAIClientOptions() { Endpoint = new Uri(endpoint!) };
    // var credential = new DefaultAzureCredential();
    // var client = new OpenAIClient(new BearerTokenPolicy(credential, "https://ai.azure.com/.default"), options)
    //                 .GetResponsesClient(model!)
    //                 .AsIChatClient();

    // builder.Services.AddSingleton<IChatClient>(client);
}

builder.AddAIAgent("coach");

builder.Services.AddOpenAIResponses();
builder.Services.AddOpenAIConversations();

builder.Services.AddAGUI();

var app = builder.Build();

app.MapDefaultEndpoints();

app.MapOpenAIResponses();
app.MapOpenAIConversations();

app.MapAGUI(
    pattern: "ag-ui",
    aiAgent: app.Services.GetRequiredKeyedService<AIAgent>("coach")
);

if (builder.Environment.IsDevelopment() == false)
{
    app.UseHttpsRedirection();
}
else
{
    app.MapDevUI();
}

// --- File Upload Endpoints ---
// In-memory store for uploaded files (ephemeral, session-scoped).
var uploadedFiles = new ConcurrentDictionary<string, (byte[] Content, string ContentType, string FileName)>();

var allowedExtensions = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
{
    ".pdf", ".docx", ".doc", ".txt", ".md", ".html"
};

app.MapPost("/upload", async (HttpRequest request) =>
{
    if (!request.HasFormContentType)
        return Results.BadRequest("Expected multipart/form-data.");

    var form = await request.ReadFormAsync();
    var file = form.Files.GetFile("file");

    if (file is null || file.Length == 0)
        return Results.BadRequest("No file provided.");

    if (file.Length > 10 * 1024 * 1024)
        return Results.Problem("File size exceeds 10 MB limit.", statusCode: 413);

    var ext = Path.GetExtension(file.FileName);
    if (!allowedExtensions.Contains(ext))
        return Results.Problem($"File type '{ext}' is not supported.", statusCode: 415);

    var fileId = Guid.NewGuid().ToString("N");
    using var ms = new MemoryStream();
    await file.CopyToAsync(ms);

    uploadedFiles[fileId] = (ms.ToArray(), file.ContentType, file.FileName);

    var url = $"{request.Scheme}://{request.Host}/uploads/{fileId}/{Uri.EscapeDataString(file.FileName)}";
    return Results.Ok(new { url });
});

app.MapGet("/uploads/{fileId}/{fileName}", (string fileId, string fileName) =>
{
    if (!uploadedFiles.TryGetValue(fileId, out var entry))
        return Results.NotFound();

    return Results.File(entry.Content, entry.ContentType, entry.FileName);
});

// --- Export Endpoints ---
app.MapGet("/export/{sessionId}/markdown", async (string sessionId) =>
{
    var mcpClient = app.Services.GetRequiredKeyedService<McpClient>("mcp-interview-data");
    var result = await mcpClient.CallToolAsync("get_formatted_summary", new Dictionary<string, object?>
    {
        ["id"] = sessionId
    });

    var textBlock = result.Content.OfType<TextContentBlock>().FirstOrDefault();
    if (textBlock is null)
        return Results.NotFound("Interview session not found.");

    var markdown = textBlock.Text ?? string.Empty;
    var bytes = Encoding.UTF8.GetBytes(markdown);

    return Results.File(bytes, "text/markdown", $"interview-summary-{sessionId}.md");
});

app.MapGet("/export/{sessionId}/pdf", async (string sessionId) =>
{
    var mcpClient = app.Services.GetRequiredKeyedService<McpClient>("mcp-interview-data");
    var result = await mcpClient.CallToolAsync("get_formatted_summary", new Dictionary<string, object?>
    {
        ["id"] = sessionId
    });

    var textBlock = result.Content.OfType<TextContentBlock>().FirstOrDefault();
    if (textBlock is null)
        return Results.NotFound("Interview session not found.");

    var markdown = textBlock.Text ?? string.Empty;
    var lines = markdown.Split('\n');

    QuestPDF.Settings.License = LicenseType.Community;

    var pdfBytes = Document.Create(container =>
    {
        container.Page(page =>
        {
            page.Size(PageSizes.A4);
            page.Margin(40);
            page.DefaultTextStyle(x => x.FontSize(11));

            page.Content().Column(column =>
            {
                foreach (var line in lines)
                {
                    var trimmed = line.TrimEnd('\r');

                    if (trimmed.StartsWith("# "))
                    {
                        column.Item().PaddingBottom(10).Text(trimmed[2..])
                            .FontSize(22).Bold();
                    }
                    else if (trimmed.StartsWith("## "))
                    {
                        column.Item().PaddingTop(15).PaddingBottom(5).Text(trimmed[3..])
                            .FontSize(16).Bold();
                    }
                    else if (trimmed.StartsWith("**") && trimmed.EndsWith("**"))
                    {
                        column.Item().PaddingBottom(3).Text(trimmed.Trim('*'))
                            .Bold();
                    }
                    else if (trimmed == "---")
                    {
                        column.Item().PaddingVertical(8).LineHorizontal(0.5f).LineColor(Colors.Grey.Medium);
                    }
                    else if (trimmed.StartsWith("*") && trimmed.EndsWith("*"))
                    {
                        column.Item().PaddingBottom(3).Text(trimmed.Trim('*'))
                            .Italic().FontColor(Colors.Grey.Darken1);
                    }
                    else if (!string.IsNullOrWhiteSpace(trimmed))
                    {
                        column.Item().PaddingBottom(3).Text(trimmed);
                    }
                }
            });

            page.Footer().AlignCenter().Text(text =>
            {
                text.Span("Page ");
                text.CurrentPageNumber();
                text.Span(" of ");
                text.TotalPages();
            });
        });
    }).GeneratePdf();

    return Results.File(pdfBytes, "application/pdf", $"interview-summary-{sessionId}.pdf");
});

await app.RunAsync();
