# Interview Coach with Microsoft Agent Framework

An interview-practice application built with Microsoft Agent Framework, models hosted in Microsoft Foundry, MCP tools, and Aspire. It collects a resume and job description, asks behavioural and technical questions, gives feedback, and saves an interview summary.

## Two ways to engage with this repository

**[Learn by building](https://codemillmatt.github.io/interview-coach-agent-framework/workshop/):** The workshop guides you through constructing the application from a cloud-free starter. Fifteen lessons start with tool setup and a completed-example run in Chapter 0. Then keep working in a separate starter: create an agent, stream its replies, add tools and records, read documents, and build specialist handoffs. The starter supplies the UI, repository, and a source-derived `WorkshopHosting.cs` helper for model authentication, client setup, optional Copilot support, and DevUI. It starts cloud-free. In the first-agent lesson you write the `ChatClientAgent` constructor and coaching instructions, then activate the supplied hosting. Core orchestration edits stay in root `apphost.cs`; the capstone's explicit support patch prepares the completed deployment entry point.

**[Run the finished application](#run-the-repository):** This repository contains the completed application. Clone it, configure it, and run it to see the interview coach in action. Use the reference documentation below to understand the architecture, configuration, and data contracts. You don't need the workshop to run the finished version.

For an exact setting or contract, use the [architecture](docs/ARCHITECTURE.md), [configuration](docs/CONFIGURATION.md), [agent modes](docs/MULTI-AGENT.md), and [session data](docs/SESSION-DATA.md) references.

## How the application works

The browser connects to a server-interactive Blazor UI. The WebUI server sends chat messages to the .NET agent service through AG-UI. Agent Framework runs either one coach or a handoff workflow with triage, receptionist, behavioural interviewer, technical interviewer, and summariser roles. The workflow transfers control between roles that share the configured model deployment.

InterviewData MCP exposes the Cosmos-backed interview repository. MarkItDown MCP extracts document text. The model requests tool calls, and application code executes them.

The agents run in the application's .NET process. Foundry hosts the model. Aspire starts the local services and supplies their connections. The UI message list and session ID live in the WebUI's server-side Blazor circuit. Refreshing creates a new circuit and session; earlier interview records remain available through InterviewData.

## Run the repository

The commands below run the completed application in this checkout. Both root `apphost.cs` and `src/InterviewCoach.AppHost` contain the completed resource graph here. Workshop downloads have their own staged scaffold; their project-based AppHost stays in its starter state until capstone finalization. See [entry points](docs/ARCHITECTURE.md#local-and-deployed-entry-points).

For the pinned, guided version, start with [Chapter 0](https://codemillmatt.github.io/interview-coach-agent-framework/workshop/00-orientation/). To run the current checkout, install .NET 10, the Aspire CLI, a compatible container engine, and the Azure CLI.

**A local run can provision billable Azure resources.** The default AppHost declares a Foundry resource and model deployment. Before starting, confirm the subscription, region, model availability, quota, provisioning permissions, and cleanup owner. See [Foundry configuration](docs/providers/MICROSOFT-FOUNDRY.md). Use fictional interview data and a development environment you own.

```sh
git clone https://github.com/codemillmatt/interview-coach-agent-framework.git
cd interview-coach-agent-framework
az login
az account show --query "{subscription:name, subscriptionId:id, tenant:tenantId}" --output table
```

Review `apphost.settings.json` before the next command. It selects `MicrosoftFoundry` and `HandOff` by default and requests a specific model version and capacity. The agent uses `DefaultAzureCredential`; do not put API keys in source.

From the repository root, with the container engine running:

```sh
aspire start --apphost ./apphost.cs
```

Open the dashboard URL printed by Aspire, inspect the resources, and use the `webui` endpoint when its dependencies are ready. Try the [fictional samples](samples/) and inspect the saved record as described in [application usage](docs/USER-MANUAL.md).

The application also implements [GitHub Copilot](docs/providers/GITHUB-COPILOT.md) as an optional provider and [single-agent mode](docs/MULTI-AGENT.md#single-mode) as a simpler baseline.

## Stop and clean up

From the folder that started the AppHost:

```sh
aspire stop --apphost ./apphost.cs
```

**Cloud resources remain until cleanup.** Keep an inventory of the resources created by each run. If you later use the optional [Container Apps deployment](https://codemillmatt.github.io/interview-coach-agent-framework/resources/deployment/), its `azd` environment has a separate cleanup scope. Follow the [cleanup reference](docs/DEPLOYMENT.md#remove-only-the-resources-you-own) and remove only resources you own.

This is a learning sample. Review authentication, per-user record access, exposed development endpoints, uploads, and retention before using real interview data or opening it to other users.

## Develop the workshop website

The static Astro/Starlight website is separate from the .NET application. With Node 24 installed:

```sh
cd workshop
npm ci
npm run dev
```

The build generates source-backed checkpoints and imports the canonical reference from `docs/` without Azure credentials. See [workshop authoring](workshop/README.md) for the content and checkpoint contracts.

## Project information

[Contributing](docs/CONTRIBUTING.md) explains how to report issues and submit changes. The project uses the [MIT license](LICENSE.md).
