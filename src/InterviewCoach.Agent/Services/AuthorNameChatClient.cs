using System.Runtime.CompilerServices;

using Microsoft.Extensions.AI;

namespace InterviewCoach.Agent.Services;

internal sealed class AuthorNameChatClient : IChatClient, IDisposable
{
    private readonly IChatClient _inner;
    private readonly string _authorName;

    public AuthorNameChatClient(IChatClient inner, string authorName)
    {
        _inner = inner ?? throw new ArgumentNullException(nameof(inner));
        _authorName = string.IsNullOrWhiteSpace(authorName)
            ? throw new ArgumentException("Author name cannot be null or whitespace.", nameof(authorName))
            : authorName;
    }

    public async Task<ChatResponse> GetResponseAsync(
        IEnumerable<ChatMessage> messages,
        ChatOptions? options = null,
        CancellationToken cancellationToken = default)
    {
        var response = await _inner.GetResponseAsync(messages, options, cancellationToken);

        if (response?.Messages is not null)
        {
            foreach (var message in response.Messages)
            {
                if (message.Role == ChatRole.Assistant && string.IsNullOrWhiteSpace(message.AuthorName))
                {
                    message.AuthorName = _authorName;
                }
            }
        }

        return response ?? new ChatResponse();
    }

    public async IAsyncEnumerable<ChatResponseUpdate> GetStreamingResponseAsync(
        IEnumerable<ChatMessage> messages,
        ChatOptions? options = null,
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        await foreach (var update in _inner.GetStreamingResponseAsync(messages, options, cancellationToken))
        {
            if (update.Role == ChatRole.Assistant && string.IsNullOrWhiteSpace(update.AuthorName))
            {
                update.AuthorName = _authorName;
            }

            yield return update;
        }
    }

    public object? GetService(Type serviceType, object? serviceKey = null)
        => _inner.GetService(serviceType, serviceKey);

    public void Dispose()
    {
        if (_inner is IDisposable disposable)
        {
            disposable.Dispose();
        }
    }
}
