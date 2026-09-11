using System.Text.Json;

using InterviewCoach.Mcp.InterviewData;

using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;

using ModelContextProtocol;
using ModelContextProtocol.Client;
using ModelContextProtocol.Protocol;

using Xunit;

namespace InterviewCoach.Agent.Tests;

public class InterviewSessionToolTests
{
    [Fact]
    public async Task MissingWrites_ReportActionableErrorsWithoutCreatingRecords()
    {
        var repository = new MemoryRepository();
        var tool = new InterviewSessionTool(repository, NullLogger<InterviewSessionTool>.Instance);
        var id = Guid.NewGuid();

        Assert.Null(await tool.GetInterviewSessionAsync(id));
        var update = await Assert.ThrowsAsync<McpException>(() => tool.UpdateInterviewSessionAsync(new() { Id = id }));
        var complete = await Assert.ThrowsAsync<McpException>(() => tool.CompleteInterviewSessionAsync(id));

        Assert.Contains("add_interview_session", update.Message);
        Assert.Contains("add_interview_session", complete.Message);
        Assert.Contains(id.ToString(), update.Message);
        Assert.Empty(await repository.GetAllInterviewSessionsAsync());
    }

    [Fact]
    public async Task HttpTools_PreserveErrorDetailsAndSupportCreateUpdateReadComplete()
    {
        var repository = new MemoryRepository();
        var builder = WebApplication.CreateBuilder();
        builder.Logging.ClearProviders();
        builder.Services.AddSingleton<IInterviewSessionRepository>(repository);
        builder.Services.AddMcpServer().WithHttpTransport(options => options.Stateless = true)
            .WithTools<InterviewSessionTool>();
        await using var app = builder.Build();
        app.Urls.Add("http://127.0.0.1:0");
        app.MapMcp("/mcp");
        await app.StartAsync();
        try
        {
            using var http = new HttpClient();
            await using var transport = new HttpClientTransport(new()
            {
                Endpoint = new Uri($"{app.Urls.Single()}/mcp")
            }, http, NullLoggerFactory.Instance);
            await using var client = await McpClient.CreateAsync(transport);
            var tools = await client.ListToolsAsync();
            Assert.Equal(5, tools.Count);
            var id = Guid.NewGuid();
            var record = new InterviewSession { Id = id, ResumeText = "Fictional API work", Transcript = "First answer" };
            var arguments = new Dictionary<string, object?> { ["record"] = record };
            var missing = await client.CallToolAsync("update_interview_session", arguments);
            Assert.True(missing.IsError);
            Assert.Contains("add_interview_session", Text(missing));
            Assert.Contains(id.ToString(), Text(missing));
            var missingComplete = await client.CallToolAsync("complete_interview_session", new Dictionary<string, object?> { ["id"] = id });
            Assert.True(missingComplete.IsError);
            Assert.Contains("add_interview_session", Text(missingComplete));
            Assert.Empty(await repository.GetAllInterviewSessionsAsync());

            var created = await client.CallToolAsync("add_interview_session", arguments);
            Assert.NotEqual(true, created.IsError);
            Assert.Equal(id, Record(created).Id);
            record.Transcript = "Second answer";
            var updated = await client.CallToolAsync("update_interview_session", arguments);
            Assert.NotEqual(true, updated.IsError);
            var fetched = await client.CallToolAsync("get_interview_session", new Dictionary<string, object?> { ["id"] = id });
            var saved = Record(fetched);
            Assert.Equal("Fictional API work", saved.ResumeText);
            Assert.Contains("First answer", saved.Transcript);
            Assert.Contains("Second answer", saved.Transcript);
            var completed = await client.CallToolAsync("complete_interview_session", new Dictionary<string, object?> { ["id"] = id });
            Assert.NotEqual(true, completed.IsError);
            Assert.True(Record(completed).IsCompleted);
            Assert.Single(await repository.GetAllInterviewSessionsAsync());
        }
        finally
        {
            await app.StopAsync();
        }
    }

    private static string Text(CallToolResult result) =>
        string.Join("\n", result.Content.OfType<TextContentBlock>().Select(block => block.Text));

    private static InterviewSession Record(CallToolResult result) =>
        JsonSerializer.Deserialize<InterviewSession>(Text(result), JsonSerializerOptions.Web)!;

    private sealed class MemoryRepository : IInterviewSessionRepository
    {
        private readonly Dictionary<Guid, InterviewSession> records = [];

        private static InterviewSession Copy(InterviewSession value) =>
            JsonSerializer.Deserialize<InterviewSession>(JsonSerializer.Serialize(value))!;

        public Task<InterviewSession> AddInterviewSessionAsync(InterviewSession record)
        {
            records.Add(record.Id, Copy(record));
            return Task.FromResult(Copy(record));
        }

        public Task<IEnumerable<InterviewSession>> GetAllInterviewSessionsAsync() =>
            Task.FromResult<IEnumerable<InterviewSession>>(records.Values.Select(Copy).ToArray());

        public Task<InterviewSession?> GetInterviewSessionAsync(Guid id) =>
            Task.FromResult(records.TryGetValue(id, out var record) ? Copy(record) : null);

        public Task<InterviewSession?> UpdateInterviewSessionAsync(InterviewSession record)
        {
            if (!records.TryGetValue(record.Id, out var stored))
                return Task.FromResult<InterviewSession?>(null);
            var updated = Copy(record);
            updated.Transcript = $"{stored.Transcript}\n\n{record.Transcript}";
            records[record.Id] = updated;
            return Task.FromResult<InterviewSession?>(Copy(updated));
        }

        public Task<InterviewSession?> CompleteInterviewSessionAsync(Guid id)
        {
            if (!records.TryGetValue(id, out var record))
                return Task.FromResult<InterviewSession?>(null);
            record.IsCompleted = true;
            return Task.FromResult<InterviewSession?>(Copy(record));
        }
    }
}
