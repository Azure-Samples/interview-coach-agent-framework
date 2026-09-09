# Questions and limitations

## Where should I start?

Use the [workshop](https://codemillmatt.github.io/interview-coach-agent-framework/workshop/) to build the application step by step. Use these reference pages when you need the actual configuration, topology, or data contracts.

## Is Foundry running the agents?

Not in this repository. The default path uses a Foundry-hosted model; Agent Framework executes the agents in the .NET service. Container Apps is the existing cloud application-hosting target. Foundry agent hosting is a different architecture.

## Is Aspire required by Agent Framework?

No. This app uses Aspire for its multi-service resource graph, configuration, service discovery, and diagnostics. Agent Framework can be used independently.

## Why use MCP instead of a local function?

An in-process function can be enough for a small application-owned capability. MCP is useful when a separate service owns reusable tools. It adds transport and operational responsibilities, so it is not automatically preferable for every function.

## Does multiple agents mean better results?

No. Specialists can clarify instructions and tool scope, but they add routing, latency, cost, and failure modes. This repository preserves `Single` and `HandOff` so you can compare them.

## Can I resume after refreshing the page?

The business record persists in Cosmos, but the current UI does not recover a previous conversation. It creates a new session ID and keeps its message list in memory. A persisted transcript alone does not restore UI or agent context.

## Are uploaded documents permanent?

No. The agent holds uploaded bytes in memory. A restart loses them. See [application usage](USER-MANUAL.md).

## Can I swap providers?

The implemented options are Microsoft Foundry and GitHub Copilot. Both support the two agent modes. Other providers require code changes; they are not documented as working configuration-only options. See [provider configuration](providers/README.md).

## Is the sample production-ready?

Treat it as a learning application. Review endpoint exposure, development tooling, identity, per-user data access, tool permissions, uploads, untrusted document content, retries, logging, costs, and retention before use with real users.

## Why does a local run need Azure?

The default provider provisions and calls a Foundry model. The UI and agent can be local while the model resources are in Azure. Starting or stopping local processes is not the same as provisioning or deleting cloud resources.

## Where are failure details?

Start with the named resource in the Aspire dashboard and the exact failing operation. Use [troubleshooting](TROUBLESHOOTING.md), not prompt changes, for a missing SDK, failed container, denied identity, or inaccessible endpoint.
