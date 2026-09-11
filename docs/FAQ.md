# Questions and limitations

## Where should I start?

**If you want to build the application yourself:** Start with the [workshop path](https://codemillmatt.github.io/interview-coach-agent-framework/workshop/). Chapter 0 includes tool checks and a completed-example run. You then open a separate cloud-free starter and build in that folder through 15 lessons.

**If you just want to run and understand the finished application:** See the root README's [Run the repository](../README.md#run-the-repository) section for standalone instructions. Use this FAQ and the reference pages below for settings, topology, and data contracts. You don't need the workshop.

Below is guidance for anyone learning the architecture or extending the application.

## What does the starter supply?

The Blazor UI, EF Core repository, service defaults, and `WorkshopHosting.cs` are supplied. The helper wraps source-derived Foundry model/authentication and DevUI code. You create the `ChatClientAgent` and instructions before activating hosting in the first-agent lesson. Core orchestration edits use root `apphost.cs`; the capstone support patch restores the completed deployment entry point. See [scaffold and finalization](ARCHITECTURE.md#workshop-scaffold-and-finalization).

## Is Foundry running the agents?

The default path uses a Foundry-hosted model. Agent Framework executes the agents in the .NET service. Container Apps is the existing cloud application-hosting target. A move to managed agent hosting needs the architecture work described in [changing the hosting model](ARCHITECTURE.md#changing-the-hosting-model).

## Is Aspire required by Agent Framework?

Agent Framework can be used independently. This app uses Aspire for its multi-service resource graph, configuration, service discovery, and diagnostics.

## Why use MCP instead of a local function?

An in-process function works well for a small application-owned capability. MCP is useful when a separate service owns reusable tools. It adds transport and operational responsibilities. The workshop lets you try both: a local function, then a server and client in separate lessons.

## Do more agents mean better results?

Compare the results for your task. Specialists separate instructions and tool assignments while adding routing, context handling, and model calls. This repository preserves `Single` and `HandOff` for comparison with the same inputs. The five roles share the selected model deployment and transfer control between phases.

## Can I resume after refreshing the page?

Refreshing starts a new Blazor circuit and session. Earlier interview records remain in Cosmos and can be fetched by ID. Conversation recovery would require additional code to restore UI and agent context. See [state ownership](SESSION-DATA.md#state-ownership), which also explains the workshop website's separate chapter-progress storage.

## Are uploaded documents permanent?

Uploads last for the agent process's lifetime. A restart loses those bytes. See the [upload contract](USER-MANUAL.md#upload-contract) for limits and access boundaries.

## Can I swap providers?

The implemented options are Microsoft Foundry and GitHub Copilot. Both support the two agent modes in the standalone repository. The workshop includes only the Foundry implementation. Additional providers require code changes. See [provider configuration](providers/README.md).

## Is the sample production-ready?

Treat it as a learning application in a restricted development environment. Review [endpoint exposure, identity, record access, and retained data](DEPLOYMENT.md#review-access-and-data-handling) before use with real users.

## Why does a local run need Azure?

The default provider declares and calls a Foundry model. The UI and agent can be local while model resources are in Azure. The workshop starter activates that model access in the first-agent lesson. Cloud resources remain until cleanup; inventory the example and learner runs separately. See [cleanup](DEPLOYMENT.md#remove-only-the-resources-you-own).

## Where are failure details?

Start with the named resource in the Aspire dashboard and the exact failing operation. [Troubleshooting](TROUBLESHOOTING.md) covers missing SDKs, failed containers, denied identities, and inaccessible endpoints.
