# The hidden 50 ms costs on every AI streaming update

Streaming is supposed to make an AI application feel fast. The first part of an answer appears while the model is still producing the rest, so the user can start reading almost immediately.

However, that benefit is easy to lose in application code.

Let's look at the [Interview Coach](https://aka.ms/agentframework/interviewcoach) sample application. The web UI app sends prompts to the backend agent app, and the agent app returns with streaming responses.

Here's the prompt that I use:

```
Hi, I'm Peter. Here's my resume: https://justinyoo.github.io/fake-resumes/resume-peter-parker.pdf. And this is JD: https://justinyoo.github.io/fake-resumes/jd-cloud-solution-architect.pdf
```

It takes 1.5 mins to 2 mins to get the first response, because the first turn processes many things at once, like parsing the PDF document into markdown and storing the initial data to Cosmos DB. Once everything is processed, then the agent responses back to the web UI app. But it seems to be slower than I expected. Why is that? What has caused the delay? Does my machine takes higher CPU while dealing with agents? Is there a problem with the streaming responses?

Visual Studio has the [Profiler](https://learn.microsoft.com/visualstudio/profiling/what-is-a-profiler) feature. Let's use this for analysis.

## Split WebUI from Aspire

Due to the characteristics of Aspire, the profiling result may be contaminated from the other factors, if it's tied to Aspire's AppHost. Therefore, we need to take the `webui` app out from Aspire while the rest is still bound to it.

> [!INFO]
> We assume that you're ready to run Aspire on your local machine with by following this [Local Azure provisioning](https://aspire.dev/integrations/cloud/azure/local-provisioning/) doc.

1. Run Aspire first in a background.

    ```bash
    aspire start --apphost ./src/InterviewCoach.AppHost/InterviewCoach.AppHost.csproj
    ```

   It provisions Microsoft Foundry instance for the locally hosted Aspire app to use. Wait for a minute or two. Then, it will be ready for service.

   ![Aspire dashboard](./images/image-01.jpg)


1. Make sure both `agent` and `webui` app are up and running.

    ```bash
    Invoke-WebRequest https://localhost:7048/health
    Invoke-WebRequest https://localhost:7200/health
    ```

   Each command should return the status code of 200, which means both apps are running properly.

1. Stop the `webui` app so that it's not the part of Aspire any longer. But the rest apps are still tied with Aspire.

    ```bash
    aspire resource webui stop
    ```

   ![Aspire dashboard showing `webui` is terminated](./images/image-02.jpg)


Now, we've split the `webui` app from Aspire.

## Performance Profiler for CPU Usage.

The Profiler shipped with Visual Studio provides various features. One of the features is to verify how the CPU is involved for the processing. We've stopped the `webui` app in the previous section. Now, it should be back and running outside Aspire.

1. Update the `launchSettings.json` for the `InterviewCoach.WebUI` project for profiling.

    ```jsonc
    {
      "Profiler": {
        "commandName": "Project",
        "dotnetRunMessages": true,
        "launchBrowser": true,
        "applicationUrl": "https://localhost:7201;http://localhost:5088",
        "environmentVariables": {
          "ASPNETCORE_ENVIRONMENT": "Development",
          "services__agent__https__0": "localhost:7048"
        }
      }
    }
    ```

   Although we stopped running the `webui` app from Aspire, the original port (`7200`) is still occupied. Therefore, the Profiler should use a different port like `7201`.

   In addition to that, when running `aspire describe webui`, it says the `services__agent__https__0` value is `https://localhost:7048`. However, Aspire automatically resolves the HTTP schema, so the profiler doesn't need that schema part.

1. Open the Interview Coach solution in Visual Studio and set the WebUI project as the start-up project.
1. Set the configuration to `Release` and launch profile to `Profiler`.
1. Open the "Profiler" menu by navigating **"Debug"** 👉 **"Performance Profiler"** or typing **"Alt"**+**"F2"**.

   ![Profiler](./images/image-03.jpg)

   Make sure that the target project is set to "InterviewCoach.WebUI". Check the "CPU Usage" item and "Start with the collection paused" option.

1. Click the "Start" button to run the `webui` app outside Aspire. Once the web UI app is up and running, click the "record" button in the Profiler to start capturing and enter the exactly same prompt above and see the result.

   ![Profiler - CPU Usage](./images/image-04.jpg)

The profiler analysis result says that CPU is NOT involved for the processing, because the kernel used most of the CPU resources, which is irrelevant to the delay. What could be the reason then? The codebase might have a clue.

## The magic of `Task.Delay(50)`

Let's look at the codebase and see how it processes the response stream in `src/InterviewCoach.WebUI/Components/Pages/Chat/Chat.razor`:

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

This line looks suspicious. It gives intentional delay of 50 ms so that the users feeling that the response is **really** streaming.

```csharp
await Task.Delay(50);
```

Suppose that one response comes with 200 delta updates. And this `Task.Delay(50)` runs once for every streaming update. As a result, the app adds at least 10 seconds of waiting:

```text
200 updates x 50 ms = 10,000 ms
```

Let's check how it actually delays the responses.

1. Add the `@using System.Diagnostics` directive to `Chat.razor`.
1. Wrap the existing `await foreach` loop with the counters. Each time `Task.Delay(50)` is invoked, stopwatch records the elapsed time around it.

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

   After processing whole response, it will log the streaming response time like:

    ```text
    Stream completed in {{ total elapsed time }} ms across {{ number of delta updates }} updates; artificial delay consumed {{ delay time }} ms
    ```

Because the code uses async/await, `Task.Delay(50)` may add extra time from thread scheduling and other works. Therefore, measured total delay time would be slightly higher than expected.

## Capture the delay

Use the same prompt above, I ran 5 times got the response time like below:

```text
1. Stream completed in 92386.3482 ms across 168 updates; artificial delay consumed 10299.8094 ms
2. Stream completed in 84772.663 ms across 188 updates; artificial delay consumed 11549.6042 ms
3. Stream completed in 90705.5531 ms across 153 updates; artificial delay consumed 9376.839 ms
4. Stream completed in 79027.4327 ms across 147 updates; artificial delay consumed 9028.3215 ms
5. Stream completed in 69061.6113 ms across 190 updates; artificial delay consumed 11714.1005 ms
```

Here's the table of summary:

| Run | Total elapsed (ms) | Update count | Expected delay (ms) | Measured delay (ms) | Delay/update (ms) |
|----:|-------------------:|-------------:|--------------------:|--------------------:|------------------:|
| 1   | 92386.3482         | 168          | 8400                | 10299.8094          | 61.3084           |
| 2   | 84772.6630         | 188          | 9400                | 11549.6042          | 61.4341           |
| 3   | 90705.5531         | 153          | 7650                |  9376.8390          | 61.2865           |
| 4   | 79027.4327         | 147          | 7350                |  9028.3215          | 61.4172           |
| 5   | 69061.6113         | 190          | 9500                | 11714.1005          | 61.6532           |
| AVG | 83190.7217         | 169          | 8460                | 10393.7349          | 61.4199           |
| MED | 84772.6630         | 168          | 8400                | 10299.8094          | 61.4172           |

It's obvious that the difference between the measured delay and expected delay is the evidence of this issue. Each time `Task.Delay(50)` adds around 61 ms which is 11 ms longer than expected. The more update count gets, the longer the delay spans.

## Compare the current code with the fix

Let's remove the `Task.Delay(50)` line, and run the app with the same prompt. Here are the result.

I ran 5 times with the prompt above and got the response time like below:

```
1. Stream completed in 98450.7463 ms across 226 updates; artificial delay consumed 0.0262 ms
2. Stream completed in 69886.973 ms across 174 updates; artificial delay consumed 0.0155 ms
3. Stream completed in 77264.4819 ms across 289 updates; artificial delay consumed 0.0256 ms
4. Stream completed in 58254.1312 ms across 163 updates; artificial delay consumed 0.0171 ms
5. Stream completed in 86431.5633 ms across 164 updates; artificial delay consumed 0.0257 ms
```

And here's the talbe of summary:

| Run | Total elapsed (ms) | Update count | Expected delay (ms) | Measured delay (ms) | Delay/update (ms) |
|----:|-------------------:|-------------:|--------------------:|--------------------:|------------------:|
| 1   | 98450.7463         | 226          | 11300               | 0.0262              | 0.0001            |
| 2   | 69886.9730         | 174          |  8700               | 0.0155              | 0.0001            |
| 3   | 77264.4819         | 289          | 14450               | 0.0256              | 0.0001            |
| 4   | 58254.1312         | 163          |  8150               | 0.0171              | 0.0001            |
| 5   | 86431.5633         | 164          |  8200               | 0.0257              | 0.0002            |
| AVG | 78057.5791         | 203          | 10160               | 0.0220              | 0.0001            |
| MED | 77264.4819         | 174          |  8700               | 0.0256              | 0.0001            |

Without `Task.Delay(50)` each update has almost no delay (0.0001 ms).

The response time from LLM and network latency has not been considered to capture. Instead, we capture the delay from the user-experience point of view.

## How Profiler Agent analyses the result

Visual Studio 2026 offers the [Profiler agent](https://learn.microsoft.com/visualstudio/profiling/profile-with-copilot-agent) with GitHub Copilot. It analyses and summarises the profiling result. Let's get a second thought from the Profiler agent.

Run the following prompt or similar in the GitHub Copilot Chat in Visual Studio.

```text
@Profiler Review this CPU Usage session for InterviewCoach.WebUI. The response contained 193 streaming updates, took 84813.9868 ms, and the temporary counter measured 61.5088 ms inside Task.Delay(50). Does the report show significant CPU work in `GetStreamingResponseAsync`, or is the elapsed time consistent with asynchronous waiting?
```

The prompt doesn't have to be same as above, but make sure to keep the question narrow and specific so that the Profiler agent can focus on the issue and intepretation.

Then, it runs the app and measure the value again.

![Profiler agent view](./images/image-05.jpg)

The Profiler agent also concludes that CPU is not bound to the response processing.

## How we take the evidence showing the delay

As the initial design decision, putting the `Task.Delay(50)` was intentional for users to feel as if the response is streaming. It seems to be cheap for less amount of response updates. However, it will become more critical when the response gets longer and longer.

Should we really keep it, then? Well, it depends. If we want to keep the visual representation for streaming, it should remain; otherwise it should be removed.

What's your thought?

## References

- [Service discovery in .NET](https://learn.microsoft.com/dotnet/core/extensions/service-discovery)
- [Analyze performance by using CPU profiling](https://learn.microsoft.com/visualstudio/profiling/cpu-usage)
- [Profile your app with GitHub Copilot Profiler Agent](https://learn.microsoft.com/visualstudio/profiling/profile-with-copilot-agent)
