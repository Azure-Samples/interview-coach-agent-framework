# The hidden 50 ms tax on every AI streaming update

One line added a median 10.3 seconds of waiting to an AI response.

It did not look expensive:

```csharp
await Task.Delay(50);
```

Fifty milliseconds is easy to dismiss in a code review. In a streaming loop, though, the
cost repeats with every update. I used Visual Studio's CPU Usage profiler, a small amount of
application instrumentation, and GitHub Copilot Profiler Agent to find out how much time the
line was really costing.

## Situation

The Interview Coach sample streams an agent response into a Blazor UI. The relevant loop is
in `src/InterviewCoach.WebUI/Components/Pages/Chat/Chat.razor`:

```csharp
await foreach (var update in ChatClient.GetStreamingResponseAsync(
    outboundMessages,
    chatOptions,
    cancellationToken))
{
    await Task.Delay(50);

    messages.AddMessages(update, filter: c => c is not TextContent);

    if (update.Role == ChatRole.Assistant)
    {
        responseText.Text += update.Text;
        ChatMessageItem.NotifyChanged(responseMessage);
    }

    StateHasChanged();
}
```

The delay runs once for every streaming update. A response delivered in 200 updates has a
nominal delay of 10 seconds:

```text
200 updates x 50 ms = 10,000 ms
```

That is only the minimum. `Task.Delay(50)` schedules the continuation to run no earlier than
50 ms later. The continuation can resume later because of thread scheduling and other work.

The application topology made the investigation less straightforward. Interview Coach is an
Aspire application, so AppHost launches the Web UI, agent, MCP servers, and data services as
separate processes. Profiling AppHost would tell me how AppHost behaves. It would not measure
the Blazor loop in `InterviewCoach.WebUI`.

## Task

I wanted to answer two questions:

1. Was the Web UI spending the response time on CPU work or waiting?
2. How much elapsed time did the repeated 50 ms delay add to a real response?

CPU Usage can answer the first question, but not the second. An asynchronous delay consumes
elapsed time without consuming CPU for the full wait. I therefore needed both a CPU profile
of the correct process and a direct timer around the line under investigation.

I also kept the existing `AGUIChatClient` and live agent rather than replacing them with a
scripted client. That made the test representative of the sample, but it meant model output,
response length, and update count could vary between runs.

## Action

### Run the Web UI outside AppHost

I kept the agent and its dependencies under Aspire, then launched the Web UI separately from
Visual Studio.

First, I started AppHost from the repository root:

```powershell
aspire start --apphost .\src\InterviewCoach.AppHost\InterviewCoach.AppHost.csproj
```

I waited for the `agent` resource to become healthy in the Aspire dashboard and verified its
HTTPS health endpoint:

```powershell
Invoke-WebRequest https://localhost:<agent-https-port>/health
```

Aspire assigns local ports dynamically, so the agent port must be checked again after every
AppHost restart.

![Aspire dashboard showing the healthy agent](./images/image-01.jpg)

Next, I stopped only the Aspire-managed Web UI:

```powershell
aspire resource webui stop `
  --apphost .\src\InterviewCoach.AppHost\InterviewCoach.AppHost.csproj
```

The agent, MCP servers, and data services remained running.

![Aspire dashboard showing the stopped Web UI](./images/image-02.jpg)

Aspire's DCP proxy continued to reserve the Web UI's original ports even after the resource
stopped. For that reason, the standalone profile used ports 7201 and 5088 instead of 7200 and
5087.

I added this temporary profile to
`src/InterviewCoach.WebUI/Properties/launchSettings.json`:

```json
"Profiler": {
  "commandName": "Project",
  "dotnetRunMessages": true,
  "launchBrowser": true,
  "applicationUrl": "https://localhost:7201;http://localhost:5088",
  "environmentVariables": {
    "ASPNETCORE_ENVIRONMENT": "Development",
    "Services__agent__https__0": "localhost:<agent-https-port>"
  }
}
```

The Web UI already addresses the agent by its logical service name:

```csharp
client.BaseAddress = new Uri("https+http://agent");
```

`Services__agent__https__0` maps that name to the agent's physical HTTPS endpoint. The value
contains only `localhost:<port>`, without the `https://` prefix. Because the client address is
`https+http://agent`, service discovery tries HTTPS first.

In Visual Studio, I set `InterviewCoach.WebUI` as the startup project, selected the
`Profiler` launch profile, and switched to the Release configuration. At this point,
Performance Profiler launched the Web UI itself rather than AppHost.

### Time the delay in the existing loop

I added `@using System.Diagnostics` to `Chat.razor` and placed temporary counters around the
existing delay:

```csharp
var responseTimer = Stopwatch.StartNew();
var measuredDelay = TimeSpan.Zero;
var updateCount = 0;

await foreach (var update in ChatClient.GetStreamingResponseAsync(
    outboundMessages,
    chatOptions,
    cancellationToken))
{
    updateCount++;

    var delayStarted = Stopwatch.GetTimestamp();
    await Task.Delay(50);
    measuredDelay += Stopwatch.GetElapsedTime(delayStarted);

    // Existing update handling...
}

Logger.LogInformation(
    "Stream completed in {ElapsedMs} ms across {UpdateCount} updates; "
    + "artificial delay consumed {DelayMs} ms",
    responseTimer.Elapsed.TotalMilliseconds,
    updateCount,
    measuredDelay.TotalMilliseconds);
```

The code logs once after the stream finishes. Logging every update would add work to the loop
being measured.

These counts are streaming updates, not model tokens. An AG-UI response delta does not
necessarily correspond to one token.

### Capture CPU Usage

I opened **Debug > Performance Profiler**, selected **CPU Usage**, and started collection.
Then I submitted the same prompt used for every test run:

```text
Hi, I'm Peter. Here's my resume:
https://justinyoo.github.io/fake-resumes/resume-peter-parker.pdf.
And this is JD:
https://justinyoo.github.io/fake-resumes/jd-cloud-solution-architect.pdf
```

I stopped collection when the response finished and selected the response interval in the
CPU timeline.

![CPU Usage profile for the standalone Web UI](./images/image-03.jpg)

The capture reported 6.7% CPU usage. That number does not mean the remaining 93.3% was all
caused by `Task.Delay`; CPU Usage is not an elapsed-time breakdown. It did show that the Web
UI was not CPU-bound during the capture. The timer supplied the causal measurement.

To inspect the application code in the report, I opened **Call Tree**, enabled **Just My
Code**, searched for `GetStreamingResponseAsync`, and expanded the hot path.

I also gave Profiler Agent the CPU session and the corresponding counter values:

```text
@Profiler Review this CPU Usage session for InterviewCoach.WebUI.
The response contained 193 streaming updates, took 84,813.9868 ms,
and the temporary counter measured 11,871.1964 ms inside Task.Delay(50).
Does the report show significant CPU work in GetStreamingResponseAsync,
or is the elapsed time consistent with asynchronous waiting?
```

This was a useful second reading of the profile, not a replacement for the measurement.
CPU samples cannot recover elapsed time spent inside `Task.Delay`.

### Remove the delay and repeat

For the second test, I removed `await Task.Delay(50)` and left the rest of the loop unchanged.
I kept the timing calls temporarily so both versions produced the same log shape. Their
remaining value in the delay-removed version measures only instrumentation overhead.

I ran each version five times with the same prompt and environment.

## Result

Here are the five baseline runs:

| Run | Total response | Updates | Measured artificial delay | Delay per update |
|---:|---:|---:|---:|---:|
| 1 | 92.39 s | 168 | 10.30 s | 61.31 ms |
| 2 | 84.77 s | 188 | 11.55 s | 61.43 ms |
| 3 | 90.71 s | 153 | 9.38 s | 61.29 ms |
| 4 | 79.03 s | 147 | 9.03 s | 61.42 ms |
| 5 | 69.06 s | 190 | 11.71 s | 61.65 ms |

The delay-removed runs produced these results:

| Run | Total response | Updates | Measured interval |
|---:|---:|---:|---:|
| 1 | 98.45 s | 226 | 0.0262 ms |
| 2 | 69.89 s | 174 | 0.0155 ms |
| 3 | 77.26 s | 289 | 0.0256 ms |
| 4 | 58.25 s | 163 | 0.0171 ms |
| 5 | 86.43 s | 164 | 0.0257 ms |

The summary is easier to read:

| Metric | Baseline | Delay removed |
|---|---:|---:|
| Runs | 5 | 5 |
| Median total response time | 84.77 s | 77.26 s |
| Total response range | 69.06-92.39 s | 58.25-98.45 s |
| Average streaming updates | 169.2 | 203.2 |
| Median streaming updates | 168 | 174 |
| Median measured artificial delay | 10.30 s | None |
| Median observed delay per update | 61.42 ms | None |
| Completed responses | 5/5 | 5/5 |

The baseline loop did not wait for just 50 ms per update. The median observed wait was
61.42 ms, and the median accumulated delay across the five runs was 10.30 seconds.

The delay-removed median response was 7.51 seconds, or 8.9%, shorter. I would not present
that figure as a controlled benchmark. The baseline response times ranged from 69.06 to
92.39 seconds, while the delay-removed runs ranged from 58.25 to 98.45 seconds. Model and
network variation are large enough to move the total in either direction.

The direct measurement is stronger: the baseline spent a median 10.30 seconds inside the
artificial delay, while the delay-removed version spent no time there. The 0.0155-0.0262 ms
values in the second table are timestamp overhead, not application pacing.

## Takeaway

This investigation nearly went wrong before the first profile was collected. AppHost was the
default target, but AppHost did not own the code I wanted to measure. Running the Web UI
separately made the CPU report relevant.

The second lesson is about choosing evidence that fits the behavior. The CPU capture did not
look CPU-bound, but it could not measure an asynchronous wait. A small timer around
`Task.Delay(50)` did.

Removing the delay fixed the known tax. It also removed an accidental throttle from the
render loop, which still calls `NotifyChanged` and `StateHasChanged()` for every update. If
that produces rendering pressure under a faster stream, the next step is to coalesce updates
at a measured refresh cadence. I would profile that as a separate problem rather than
putting an arbitrary delay back into the loop.

The original line looked cheap because 50 ms is a small number. In five real runs, the wait
averaged about 61 ms per update and accumulated to a median 10.30 seconds.

## References

- [Service discovery in .NET](https://learn.microsoft.com/dotnet/core/extensions/service-discovery)
- [Analyze performance by using CPU profiling](https://learn.microsoft.com/visualstudio/profiling/cpu-usage)
- [Profile your app with GitHub Copilot Profiler Agent](https://learn.microsoft.com/visualstudio/profiling/profile-with-copilot-agent)
