# Tutorial links

The [workshop](https://codemillmatt.github.io/interview-coach-agent-framework/workshop/) is the guided build. Chapter 0 combines prerequisites and a completed-app run; the following lessons build agent capabilities in your separate starter.

**If you're using the finished application as a reference** (not learning the build), see [architecture reference](ARCHITECTURE.md) and [configuration reference](CONFIGURATION.md) for how the components work together and how to configure them. This page maps topics to the workshop lessons; you don't need them to run or understand the sample.

## Tutorial 1: Understanding the Interview Flow

[Check your tools and run the completed example](https://codemillmatt.github.io/interview-coach-agent-framework/workshop/00-orientation/#check-your-tools), then [start your workshop app](https://codemillmatt.github.io/interview-coach-agent-framework/workshop/01-starter/). The [architecture reference](ARCHITECTURE.md) maps the finished processes and supplied scaffold.

## Tutorial 2: Creating a Custom MCP Server

Start with [an in-process C# tool](https://codemillmatt.github.io/interview-coach-agent-framework/workshop/04-tools/), then [expose InterviewData's MCP server](https://codemillmatt.github.io/interview-coach-agent-framework/workshop/05-mcp-server/) and [connect the coach to its tools](https://codemillmatt.github.io/interview-coach-agent-framework/workshop/06-mcp-state/). [Persistence](https://codemillmatt.github.io/interview-coach-agent-framework/workshop/07-persistence/) follows a record through its lifecycle.

## Tutorial 3: Customizing the Agent

[Create the Foundry-backed agent](https://codemillmatt.github.io/interview-coach-agent-framework/workshop/02-first-coach/) and [connect the chat UI](https://codemillmatt.github.io/interview-coach-agent-framework/workshop/03-streaming/). Change instructions only after you can trace a real request through that path.

[Extract a sample resume](https://codemillmatt.github.io/interview-coach-agent-framework/workshop/08-document-extraction/), then [use its text as interview context](https://codemillmatt.github.io/interview-coach-agent-framework/workshop/09-documents/). The [upload contract](USER-MANUAL.md#upload-contract) covers attached files.

## Tutorial 4: Extending the handoff workflow

[Make the first two-agent handoff](https://codemillmatt.github.io/interview-coach-agent-framework/workshop/10-first-handoff/), [add the interviewers](https://codemillmatt.github.io/interview-coach-agent-framework/workshop/11-interviewers/), then [finish with the summary agent](https://codemillmatt.github.io/interview-coach-agent-framework/workshop/12-handoffs/). The [agent-mode reference](MULTI-AGENT.md) lists the completed graph's eleven edges and tool assignments.

## Tutorial 5: Adding Evaluation and Feedback

[Run your completed interview and check the saved result](https://codemillmatt.github.io/interview-coach-agent-framework/workshop/13-capstone/), then [trace a failed step and an early finish](https://codemillmatt.github.io/interview-coach-agent-framework/workshop/14-debugging/). Check tool results, routing, and stored data alongside feedback quality. After the capstone, use [optional extensions](https://codemillmatt.github.io/interview-coach-agent-framework/resources/extensions/) or the [deployment reference](DEPLOYMENT.md).
