# Facebook Post

Have you ever been looking for a real-world example of using #MicrosoftAgentFramework running on #MicrosoftFoundry, written in .NET?

We just open-sourced the Interview Coach, a .NET sample app where an AI runs you through a mock job interview. You give it a resume and job description, it asks behavioral and technical questions, then hands you a performance summary at the end.

Here's what the sample app offers:

→ Microsoft Agent Framework (merges Semantic Kernel and AutoGen into one framework)
→ Five agents that pass the conversation between each other: receptionist, behavioral interviewer, technical interviewer, summarizer, and a triage agent for rerouting
→ Two MCP servers running as separate services, one in Python (resume parsing via MarkItDown) and one in .NET (session data in SQLite)
→ Microsoft Foundry as the model backend
→ Aspire wiring it all together with service discovery, health checks, and distributed tracing

Deploys to Azure Container Apps with `azd up`.

If you're building .NET AI agents and want something more substantial than a Hello World to reference, this covers multi-agent handoff, MCP tool integration, and Aspire orchestration in one working app.

https://aka.ms/agentframework/interviewcoach

#dotnet #microsoft #microsoftagentframework #agentframework #foundry #aspire #ai #agents azure #microsoftfoundry #aspire #mcp #cloudnative
