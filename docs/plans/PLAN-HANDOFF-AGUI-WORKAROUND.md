# Plan: Extract MAF Handoff + AG-UI Workaround

| Field            | Value |
|------------------|-------|
| **Status**       | Ready |
| **Branch**       | `bruno-AddMultiAgentsScenario` |
| **PR**           | [#9](https://github.com/Azure-Samples/interview-coach-agent-framework/pull/9) |
| **Created**      | 2026-02-24 |

---

## 1. Context

Mode 2 (multi-agent handoff via `AgentWorkflowBuilder`) exposed over AG-UI
(`MapAGUI`) hits two open bugs in Microsoft Agent Framework (MAF):

| Issue | Title | Impact |
|-------|-------|--------|
| [#2775](https://github.com/microsoft/agent-framework/issues/2775) | JSON parsing exception when Handoff tool returns plain string content instead of JSON in AGUIChatClient | **Blocks Mode 2 entirely.** The handoff tool returns `"Transferred."` as plain text. `AGUIChatClient.DeserializeResultIfAvailable` tries `JsonSerializer.Deserialize<JsonElement>("Transferred.")`, throws `JsonException`, kills the SSE stream. No assistant text is ever delivered after the first handoff. |
| [#3962](https://github.com/microsoft/agent-framework/issues/3962) | MapAGUI reuses the same messageId for consecutive TOOL_CALL_RESULT SSE events | Duplicate `messageId` values on tool-result SSE events. Causes React key collisions in CopilotKit frontends and may cause rendering glitches in Blazor-based Chat. |

Current workaround code lives inline in `Program.cs` as two top-level static
methods (`WrapWithHandoffToolResultFix`, `FixHandoffToolResults`). This plan
extracts them into a dedicated file for clarity, and documents the removal path.

---

## 2. Strategy Evaluation

| Approach | Verdict | Reason |
|----------|---------|--------|
| **New class library** (`InterviewCoach.AgentFramework.Fixes`) | **Rejected** | Over-engineering. The fix is ~30 lines of code, tightly coupled to MAF internals (`AIAgentBuilder`, `AgentResponseUpdate`, `FunctionResultContent`). Adding a project means extra `.csproj`, solution entry, NuGet references, build time — all for something that will be deleted. Users learning MAF would need to trace through an extra project to understand the fix, which adds cognitive load without teaching them anything about MAF patterns. |
| **Keep inline in Program.cs** | **Rejected** | Program.cs is the primary learning surface for MAF patterns (agents, handoff topology, tools). Mixing workaround code with business logic makes it harder for learners to distinguish "this is how MAF works" from "this is a temporary bug workaround." |
| **Tests in web app project** | **Rejected** | `dotnet test` doesn't work on `Microsoft.NET.Sdk.Web` projects. Test runners (xUnit/MSTest) require a proper test project. |
| **Single helper class + dedicated test project** | **Accepted** | Clean separation: `HandoffToolResultFix.cs` in Agent project, unit tests in a new `InterviewCoach.Agent.Tests` project. The test project has long-term value beyond the workaround (can test agent creation, mode toggling, etc). When the upstream fix ships, delete the workaround file and its test file — the test project stays for future tests. |

---

## 3. Implementation Plan

### Step 1: Create `HandoffToolResultFix.cs` in the Agent project

**File**: `src/InterviewCoach.Agent/HandoffToolResultFix.cs`

Create a new static class that encapsulates the workaround:

```csharp
// ============================================================================
// TEMPORARY WORKAROUND — Remove when upstream fix is released.
//
// Upstream issues:
//   https://github.com/microsoft/agent-framework/issues/2775
//   https://github.com/microsoft/agent-framework/issues/3962
//
// Problem:
//   Handoff tools return plain string content (e.g. "Transferred.") which
//   causes AGUIChatClient to throw JsonException in DeserializeResultIfAvailable.
//
// Fix:
//   Wraps the workflow AIAgent with a streaming middleware that converts any
//   plain-string FunctionResultContent.Result values to JsonElement before
//   the AGUI serialization pipeline processes them.
// ============================================================================

using System.Runtime.CompilerServices;
using System.Text.Json;

using Microsoft.Agents.AI;
using Microsoft.Extensions.AI;

namespace InterviewCoach.Agent;

/// <summary>
/// Temporary workaround for microsoft/agent-framework#2775.
/// Wraps a handoff workflow <see cref="AIAgent"/> so that plain-string tool
/// results are serialized to <see cref="JsonElement"/> before the AG-UI
/// pipeline processes them. Safe to remove once the upstream fix ships.
/// </summary>
internal static class HandoffToolResultFix
{
    /// <summary>
    /// Wraps the given <paramref name="agent"/> with a streaming middleware
    /// that fixes plain-string <see cref="FunctionResultContent.Result"/>
    /// values by converting them to <see cref="JsonElement"/>.
    /// </summary>
    internal static AIAgent Apply(AIAgent agent)
    {
        return new AIAgentBuilder(agent)
            .Use(
                runFunc: null,
                runStreamingFunc: static (messages, session, options, inner, ct) =>
                    FixToolResults(inner.RunStreamingAsync(messages, session, options, ct)))
            .Build();
    }

    private static async IAsyncEnumerable<AgentResponseUpdate> FixToolResults(
        IAsyncEnumerable<AgentResponseUpdate> updates,
        [EnumeratorCancellation] CancellationToken ct = default)
    {
        await foreach (var update in updates.WithCancellation(ct))
        {
            foreach (var content in update.Contents)
            {
                if (content is FunctionResultContent frc && frc.Result is string s)
                {
                    frc.Result = JsonSerializer.SerializeToElement(s);
                }
            }

            yield return update;
        }
    }
}
```

### Step 2: Update `Program.cs` — Replace inline workaround with class call

In `Program.cs`, find the Mode 2 `CreateHandoffAgents` return statement and change:

```csharp
// BEFORE (current inline fix)
return WrapWithHandoffToolResultFix(workflow.AsAIAgent(name: "coach"));
```

to:

```csharp
// AFTER (delegated to helper class)
return HandoffToolResultFix.Apply(workflow.AsAIAgent(name: "coach"));
```

Do the same for Mode 3 `CreateCopilotHandoffAgents` return statement.

### Step 3: Remove inline workaround methods from `Program.cs`

Delete the following top-level static methods from `Program.cs`:

- `WrapWithHandoffToolResultFix` (the entire method block)
- `FixHandoffToolResults` (the entire method block)
- The comment block above them referencing issue #2775

Also remove these `using` statements from `Program.cs` if they are no longer
needed by any other code:

- `using System.Runtime.CompilerServices;`
- `using System.Text.Json;`

### Step 4: Create test project `InterviewCoach.Agent.Tests`

**File**: `tests/InterviewCoach.Agent.Tests/InterviewCoach.Agent.Tests.csproj`

```xml
<Project Sdk="Microsoft.NET.Sdk">

  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <IsPackable>false</IsPackable>
    <IsTestProject>true</IsTestProject>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Microsoft.NET.Test.Sdk" Version="17.*" />
    <PackageReference Include="xunit" Version="2.*" />
    <PackageReference Include="xunit.runner.visualstudio" Version="3.*-*" />
  </ItemGroup>

  <ItemGroup>
    <ProjectReference Include="..\..\src\InterviewCoach.Agent\InterviewCoach.Agent.csproj" />
  </ItemGroup>

  <ItemGroup>
    <InternalsVisibleTo Include="InterviewCoach.Agent.Tests" />
  </ItemGroup>

</Project>
```

> **Note**: The `HandoffToolResultFix` class is `internal`, so the Agent project
> needs an `InternalsVisibleTo` attribute. Add to `src/InterviewCoach.Agent/InterviewCoach.Agent.csproj`:
>
> ```xml
> <ItemGroup>
>   <InternalsVisibleTo Include="InterviewCoach.Agent.Tests" />
> </ItemGroup>
> ```

### Step 5: Create unit tests for the workaround

**File**: `tests/InterviewCoach.Agent.Tests/HandoffToolResultFixTests.cs`

Write the following tests. Each test creates a mock `AIAgent` using
`AIAgentBuilder` with a `runStreamingFunc` that yields controlled
`AgentResponseUpdate` sequences, then passes it through
`HandoffToolResultFix.Apply()` and asserts the output.

| Test Method | What It Verifies |
|-------------|-----------------|
| `Apply_StringToolResult_ConvertedToJsonElement` | A `FunctionResultContent` with `Result = "Transferred."` (string) is converted to a `JsonElement` of kind `String` with value `"Transferred."`. This is the core fix for #2775. |
| `Apply_JsonElementToolResult_PassesThrough` | A `FunctionResultContent` with `Result` already a `JsonElement` is not modified. Ensures the fix only touches string results. |
| `Apply_NullToolResult_PassesThrough` | A `FunctionResultContent` with `Result = null` passes through unmodified. |
| `Apply_TextContentOnly_PassesThrough` | An `AgentResponseUpdate` containing only `TextContent` (no tool results) passes through completely unmodified. |
| `Apply_MixedContent_OnlyFixesStringResults` | An update containing both `TextContent` and `FunctionResultContent` with string result — only the `FunctionResultContent` is fixed, `TextContent` is untouched. |
| `Apply_EmptyStream_CompletesWithoutError` | An empty async enumerable completes without throwing. |

Example test implementation:

```csharp
using System.Text.Json;
using Microsoft.Agents.AI;
using Microsoft.Extensions.AI;

namespace InterviewCoach.Agent.Tests;

public class HandoffToolResultFixTests
{
    [Fact]
    public async Task Apply_StringToolResult_ConvertedToJsonElement()
    {
        // Arrange — create a mock agent that yields one update with a string tool result
        var innerAgent = CreateMockAgent(
            new AgentResponseUpdate(ChatRole.Tool,
            [
                new FunctionResultContent("call_1", "Transferred.")
            ]));

        // Act
        var fixedAgent = HandoffToolResultFix.Apply(innerAgent);
        var updates = new List<AgentResponseUpdate>();
        await foreach (var update in fixedAgent.RunStreamingAsync([], cancellationToken: CancellationToken.None))
        {
            updates.Add(update);
        }

        // Assert
        var frc = updates.SelectMany(u => u.Contents).OfType<FunctionResultContent>().Single();
        Assert.IsType<JsonElement>(frc.Result);
        Assert.Equal("Transferred.", ((JsonElement)frc.Result!).GetString());
    }

    [Fact]
    public async Task Apply_JsonElementToolResult_PassesThrough()
    {
        var jsonResult = JsonSerializer.SerializeToElement(new { status = "ok" });
        var innerAgent = CreateMockAgent(
            new AgentResponseUpdate(ChatRole.Tool,
            [
                new FunctionResultContent("call_1", jsonResult)
            ]));

        var fixedAgent = HandoffToolResultFix.Apply(innerAgent);
        var updates = new List<AgentResponseUpdate>();
        await foreach (var update in fixedAgent.RunStreamingAsync([], cancellationToken: CancellationToken.None))
        {
            updates.Add(update);
        }

        var frc = updates.SelectMany(u => u.Contents).OfType<FunctionResultContent>().Single();
        Assert.IsType<JsonElement>(frc.Result);
        Assert.Equal("ok", ((JsonElement)frc.Result!).GetProperty("status").GetString());
    }

    [Fact]
    public async Task Apply_TextContentOnly_PassesThrough()
    {
        var innerAgent = CreateMockAgent(
            new AgentResponseUpdate(ChatRole.Assistant, "Hello, I'm the interview coach!"));

        var fixedAgent = HandoffToolResultFix.Apply(innerAgent);
        var updates = new List<AgentResponseUpdate>();
        await foreach (var update in fixedAgent.RunStreamingAsync([], cancellationToken: CancellationToken.None))
        {
            updates.Add(update);
        }

        Assert.Single(updates);
        Assert.Equal("Hello, I'm the interview coach!", updates[0].Text);
    }

    [Fact]
    public async Task Apply_EmptyStream_CompletesWithoutError()
    {
        var innerAgent = CreateMockAgent(); // no updates

        var fixedAgent = HandoffToolResultFix.Apply(innerAgent);
        var updates = new List<AgentResponseUpdate>();
        await foreach (var update in fixedAgent.RunStreamingAsync([], cancellationToken: CancellationToken.None))
        {
            updates.Add(update);
        }

        Assert.Empty(updates);
    }

    /// <summary>
    /// Helper: creates a mock AIAgent that yields the given updates when streamed.
    /// Uses AIAgentBuilder with a runStreamingFunc delegate.
    /// </summary>
    private static AIAgent CreateMockAgent(params AgentResponseUpdate[] updates)
    {
        // Create a minimal "inner" agent that does nothing
        var noop = new AIAgentBuilder(
            new AnonymousAIAgent())
            .Use(
                runFunc: null,
                runStreamingFunc: (messages, session, options, inner, ct) =>
                    ToAsyncEnumerable(updates))
            .Build();
        return noop;
    }

    private static async IAsyncEnumerable<AgentResponseUpdate> ToAsyncEnumerable(
        AgentResponseUpdate[] items)
    {
        foreach (var item in items)
        {
            yield return item;
        }
        await Task.CompletedTask;
    }

    /// <summary>
    /// Minimal AIAgent implementation for testing. All operations throw.
    /// Only used as an "inner" agent seed for AIAgentBuilder.
    /// </summary>
    private sealed class AnonymousAIAgent : AIAgent
    {
        protected override Task<AgentResponse> RunCoreAsync(
            IEnumerable<ChatMessage> messages,
            AgentSession? session = null,
            AgentRunOptions? options = null,
            CancellationToken cancellationToken = default)
            => throw new NotImplementedException();

        protected override IAsyncEnumerable<AgentResponseUpdate> RunCoreStreamingAsync(
            IEnumerable<ChatMessage> messages,
            AgentSession? session = null,
            AgentRunOptions? options = null,
            CancellationToken cancellationToken = default)
            => throw new NotImplementedException();
    }
}
```

> **Note**: The exact mock agent pattern may need minor adjustments depending on
> `AIAgent` constructor requirements in the installed MAF version. The agent
> should verify that `CreateMockAgent` compiles first. If `AIAgent` has a
> required constructor parameter, use a `ChatClientAgent` with a mock
> `IChatClient` instead.

### Step 6: Add test project to solution

**File**: `InterviewCoach.slnx`

Add the test project under a `/tests/` folder:

```xml
<Solution>
  <Folder Name="/src/">
    <Project Path="src/InterviewCoach.Agent/InterviewCoach.Agent.csproj" />
    <Project Path="src/InterviewCoach.AppHost/InterviewCoach.AppHost.csproj" />
    <Project Path="src/InterviewCoach.Mcp.InterviewData/InterviewCoach.Mcp.InterviewData.csproj" />
    <Project Path="src/InterviewCoach.ServiceDefaults/InterviewCoach.ServiceDefaults.csproj" />
    <Project Path="src/InterviewCoach.WebUI/InterviewCoach.WebUI.csproj" />
  </Folder>
  <Folder Name="/tests/">
    <Project Path="tests/InterviewCoach.Agent.Tests/InterviewCoach.Agent.Tests.csproj" />
  </Folder>
</Solution>
```

### Step 7: Build and run tests

```bash
dotnet build
dotnet test tests/InterviewCoach.Agent.Tests/InterviewCoach.Agent.Tests.csproj
```

Expected: All tests pass, 0 errors.

### Step 8: Verify all 3 modes still compile

Temporarily toggle each mode in `Program.cs` and build:

```csharp
// Toggle Mode 1 — should build
builder.AddAIAgent("coach", createAgentDelegate: CreateSingleAgent);

// Toggle Mode 2 — should build
builder.AddAIAgent("coach", createAgentDelegate: CreateHandoffAgents);

// Toggle Mode 3 — should build
builder.AddAIAgent("coach", createAgentDelegate: CreateCopilotHandoffAgents);
```

Restore Mode 2 as active after verification.

### Step 9: Add workaround documentation to `docs/TROUBLESHOOTING.md`

Add a new section to `docs/TROUBLESHOOTING.md` under a heading like
"## Known Issues — Multi-Agent Handoff (Mode 2)". The section must include:

- A clear description of the symptom (user sends a message, no response in chat)
- Links to both upstream issues (#2775 and #3962)
- Explanation of the workaround (`HandoffToolResultFix.cs`)
- Which files are involved
- Statement that Mode 1 is unaffected and works without the workaround

Example content to append:

```markdown
---

## Known Issues — Multi-Agent Handoff (Mode 2)

### No response in chat after sending a message (Mode 2 only)

**Symptoms**: You switch to Mode 2 (multi-agent handoff) in `Program.cs`, send
a message in the WebUI, and get no response. The agent logs may show a
`JsonException` with `"'T' is an invalid start of a value"`.

**Cause**: This is a known bug in the Microsoft Agent Framework AG-UI package.
When the handoff workflow transfers control between agents, the internal
transfer tool returns a plain string like `"Transferred."`. The AG-UI serialization
layer tries to parse this as JSON and crashes.

**Upstream issues**:

- [microsoft/agent-framework#2775](https://github.com/microsoft/agent-framework/issues/2775) — JSON parsing exception when Handoff tool returns plain string content
- [microsoft/agent-framework#3962](https://github.com/microsoft/agent-framework/issues/3962) — Duplicate messageId for consecutive TOOL_CALL_RESULT events

**Current workaround**: The file `src/InterviewCoach.Agent/HandoffToolResultFix.cs`
wraps the handoff agent with a streaming middleware that converts plain-string
tool results to `JsonElement` before the AG-UI pipeline processes them. This is
applied automatically in `CreateHandoffAgents` and `CreateCopilotHandoffAgents`.

**Mode 1 is unaffected** — the single-agent mode does not use handoff tools and
works without any workaround.

> **Reminder**: Check the upstream issues periodically. When a fixed version of
> `Microsoft.Agents.AI.AGUI` is released, follow the removal steps in
> [docs/plans/PLAN-HANDOFF-AGUI-WORKAROUND.md](plans/PLAN-HANDOFF-AGUI-WORKAROUND.md#4-future-removal-steps-when-upstream-fix-ships)
> to remove the workaround and update packages.
```

### Step 10: Runtime validation (manual)

1. Run `aspire run` from the repo root
2. Open the WebUI chat
3. Send a message like "Hi, I'd like to practice for a job interview"
4. Verify the triage agent hands off to the receptionist and the response text streams back to the UI
5. Confirm no `JsonException` in the agent logs

---

## 4. Future Removal Steps (When Upstream Fix Ships)

When Microsoft publishes a new `Microsoft.Agents.AI.AGUI` package that includes
the fix for [#2775](https://github.com/microsoft/agent-framework/issues/2775):

1. **Update packages**: Change `Version="1.*-*"` constraints or pin to the
   fixed version in `InterviewCoach.Agent.csproj` and
   `InterviewCoach.WebUI.csproj`.

2. **Delete the workaround file**:

   ```
   del src/InterviewCoach.Agent/HandoffToolResultFix.cs
   ```

3. **Delete the workaround test file**:

   ```
   del tests/InterviewCoach.Agent.Tests/HandoffToolResultFixTests.cs
   ```

4. **Revert to direct return** in `CreateHandoffAgents` and
   `CreateCopilotHandoffAgents`:

   ```csharp
   // Change this:
   return HandoffToolResultFix.Apply(workflow.AsAIAgent(name: "coach"));

   // Back to:
   return workflow.AsAIAgent(name: "coach");
   ```

5. **Remove `InternalsVisibleTo`** from `InterviewCoach.Agent.csproj` if no
   other test files reference internal types.

6. **Build and test** all 3 modes as described in Steps 7–8.

7. **Run tests**: `dotnet test` — ensure remaining tests still pass.

8. **Update `docs/TROUBLESHOOTING.md`** — remove or update the
   "Known Issues — Multi-Agent Handoff (Mode 2)" section.

9. **Update `docs/CHANGELOG.md`** to note the workaround removal.

---

## 5. Reminder: Periodic Upstream Check

> **Action**: Periodically check the status of the upstream issues to know
> when the workaround can be removed:
>
> - [microsoft/agent-framework#2775](https://github.com/microsoft/agent-framework/issues/2775)
> - [microsoft/agent-framework#3962](https://github.com/microsoft/agent-framework/issues/3962)
>
> **How to check**: Visit the issue links above and look for a "Closed" status
> or a merged fix PR. Then check the
> [NuGet version history](https://www.nuget.org/packages/Microsoft.Agents.AI.AGUI#versions-body-tab)
> for a release that includes the fix.
>
> **Suggested cadence**: Every 2 weeks, or whenever updating MAF package versions.

---

## 6. Files Changed Summary

| File | Action | Description |
|------|--------|-------------|
| `src/InterviewCoach.Agent/HandoffToolResultFix.cs` | **Create** | New `internal static` class encapsulating the streaming workaround middleware |
| `src/InterviewCoach.Agent/Program.cs` | **Edit** | Replace inline fix methods with `HandoffToolResultFix.Apply()` calls; remove `WrapWithHandoffToolResultFix`, `FixHandoffToolResults`, and unused `using` directives |
| `src/InterviewCoach.Agent/InterviewCoach.Agent.csproj` | **Edit** | Add `InternalsVisibleTo` for test project |
| `tests/InterviewCoach.Agent.Tests/InterviewCoach.Agent.Tests.csproj` | **Create** | New xUnit test project referencing the Agent project |
| `tests/InterviewCoach.Agent.Tests/HandoffToolResultFixTests.cs` | **Create** | Unit tests for the workaround (6 test cases) |
| `InterviewCoach.slnx` | **Edit** | Add test project under `/tests/` folder |
| `docs/TROUBLESHOOTING.md` | **Edit** | New section documenting the known issue, workaround, and reminder to check upstream |

No new NuGet packages are added to the Agent project. The test project adds
`Microsoft.NET.Test.Sdk`, `xunit`, and `xunit.runner.visualstudio`.
