# User Manual — Interview Coach

A step-by-step guide to using the Interview Coach application once it's running. This document walks you through a complete interview practice session from start to finish.

## Prerequisites

The application must be running. Start it with:

```bash
aspire run --file ./apphost.cs
```

Once all services show ✅ **Running** in the Aspire Dashboard, click the **webui** endpoint to open the Interview Coach chat interface.

> **Tip:** The Aspire Dashboard URL appears in your terminal (typically `https://localhost:17xxx`). The WebUI endpoint is listed under the **webui** resource.

---

## Quick Overview

The Interview Coach guides you through a mock interview session. Here's the typical flow:

```
1. Greet the coach → Session is created
2. Share your resume (link or text) → Coach parses it
3. Share the job description (link or text) → Coach parses it
4. Behavioral interview questions → You answer, get feedback
5. Technical interview questions → You answer, get feedback
6. Request summary → Coach generates a comprehensive review
```

You can skip steps, stop at any time, or go back and forth between sections.

---

## Step-by-Step Walkthrough

### Step 1: Start a Conversation

Open the WebUI and type a greeting to begin. The coach will create an interview session and provide you with a **Session ID**.

**Example:**

```
You:   Hi! I'd like to practice for an interview.
Coach: Welcome! I've created a new interview session for you.
       Your Session ID is: a1b2c3d4-...
       Would you like to share your resume to get started?
```

> **Note:** Save your Session ID if you want to resume this session later.

---

### Step 2: Share Your Resume

Provide your resume in one of three ways:

| Method | What to type |
|--------|-------------|
| **URL link** | `Here's my resume: https://www.linkedin.com/in/elbruno/` |
| **File link** | `My resume is at https://example.com/resume.pdf` |
| **Paste text** | Paste the full text of your resume directly into the chat |
| **Skip** | `I'd like to proceed without a resume` |

**Example using a LinkedIn profile:**

```
You:   Hi, my CV is here: https://www.linkedin.com/in/elbruno/
Coach: Thanks! Let me parse your profile...
       I can see you have experience in AI, Innovation, and Microsoft technologies.
       Would you like to provide a job description as well?
```

The coach uses the **MarkItDown MCP server** to convert documents (PDF, DOCX, web pages) into readable text. Supported formats include PDF, Word documents, web URLs, and LinkedIn profile pages.

> **Tip:** The `samples/` folder includes sample resumes and job descriptions you can reference:
> - `samples/resume-natasha-romanoff.pdf`
> - `samples/resume-peter-parker.pdf`
> - `samples/jd-cloud-solution-architect.pdf`

---

### Step 3: Share the Job Description

Next, provide the job description for the role you're preparing for. The same input methods apply (URL, file link, text, or skip).

**Example:**

```
You:   The job description is here: https://example.com/jobs/cloud-architect
Coach: Got it! I've parsed the job description. The role is looking for
       experience in cloud architecture, Azure services, and team leadership.
       I'll tailor the interview questions to this role.
       Ready to start the behavioral interview?
```

If you skip both the resume and job description, the coach will ask general interview questions.

---

### Step 4: Behavioral Interview

The coach begins with behavioral questions tailored to your resume and job description. Questions follow the **STAR method** (Situation, Task, Action, Result).

**Example:**

```
Coach: Let's start with a behavioral question.
       Tell me about a time you led a technical project through a challenging deadline.
       Try to structure your answer using the STAR method.

You:   In my previous role, we had a project to migrate our infrastructure to Azure.
       The deadline was tight because of a contract renewal. I organized the team into
       workstreams, set up daily standups, and we delivered two days early.

Coach: Great answer! Here's my feedback:
       ✅ Situation: Clear context about the migration project
       ✅ Task: Well-defined goal with deadline pressure
       ✅ Action: Good leadership actions (workstreams, standups)
       💡 Improvement: Add specific metrics — how many services migrated?
          What was the team size? Quantifiable results strengthen your answer.

       Would you like another behavioral question, or move to technical questions?
```

Typically the coach asks **3-5 behavioral questions**. After each answer, you receive:

- Constructive feedback on your response
- Analysis of your STAR structure
- Suggestions for improvement

---

### Step 5: Technical Interview

When you're ready, the coach switches to technical questions based on the skills in your resume and job description.

**Example:**

```
You:   Let's move to technical questions.

Coach: Sure! Here's a technical question:
       You need to design a microservices architecture for a high-traffic
       e-commerce platform on Azure. Walk me through your approach,
       including service communication, data management, and scaling.

You:   I'd use Azure Container Apps for the services, with Azure Service Bus
       for async messaging between them. Each service would have its own
       database — SQL for orders, Cosmos DB for the product catalog...

Coach: Solid approach! Here's my analysis:
       ✅ Good choice of Azure Container Apps for managed containers
       ✅ Event-driven with Service Bus — good for decoupling
       ✅ Polyglot persistence is appropriate
       💡 Consider: How would you handle distributed transactions?
          What's your caching strategy for the product catalog?

       Want to continue with more technical questions?
```

---

### Step 6: End the Interview and Get a Summary

When you're done, ask the coach to wrap up. The coach generates a comprehensive summary.

**Example:**

```
You:   I'd like to stop and get a summary.

Coach: Here's your interview summary:

       📋 Interview Summary
       ═══════════════════════════════════════
       
       Overview:
       You completed a mock interview session with 3 behavioral
       and 2 technical questions for a Cloud Solution Architect role.

       Key Highlights:
       • Strong leadership examples with clear STAR structure
       • Solid technical knowledge of Azure services
       • Good communication and structured thinking

       Areas for Improvement:
       • Add more quantifiable metrics to behavioral answers
       • Dive deeper into distributed systems trade-offs
       • Prepare more examples of cross-team collaboration

       Recommendations:
       1. Practice explaining complex architectures in under 2 minutes
       2. Prepare 3-4 STAR stories with specific metrics ready
       3. Review CAP theorem and consistency patterns for system design

       Overall Readiness: 🟢 Good — ready for interviews with some
       targeted preparation in the areas noted above.

       Good luck with your interview! 🎉
```

---

## Multi-Agent Mode

By default, the application runs in **Multi-Agent Handoff mode** (Mode 2), where five specialized agents collaborate:

| Agent | What It Does |
|-------|-------------|
| **Triage** | Routes your messages to the right specialist |
| **Receptionist** | Sets up your session, parses your resume and job description |
| **Behavioral Interviewer** | Asks behavioral questions using the STAR method |
| **Technical Interviewer** | Asks role-specific technical questions |
| **Summariser** | Generates your final interview summary |

The handoffs happen automatically — you interact naturally and the system routes to the right specialist behind the scenes.

> **Learn more:** See [MULTI-AGENT.md](MULTI-AGENT.md) for architecture details and how to switch between single-agent and multi-agent modes.

---

## Tips for the Best Experience

1. **Provide both resume and job description** — The more context the coach has, the more relevant the questions will be.
2. **Answer in detail** — Longer, structured answers get better feedback.
3. **Use the STAR method** — Structure behavioral answers as Situation → Task → Action → Result.
4. **Ask for clarification** — If a question is unclear, ask the coach to rephrase.
5. **Practice multiple sessions** — Each session is saved. Start fresh with new job descriptions to practice for different roles.
6. **Stop anytime** — Say "stop" or "end the interview" to get your summary at any point.

---

## Monitoring with Aspire Dashboard

While using the app, the Aspire Dashboard provides real-time observability:

| What to Check | Where |
|---------------|-------|
| Service health | **Resources** tab — all services should show ✅ Running |
| Agent tool calls | **Traces** tab — see when the agent calls MCP tools |
| Logs | **Logs** tab — filter by `agent` to see agent reasoning |
| Session data | **SQLite Web** resource — browse interview session records |

This is useful for understanding how the agent works and for debugging if something goes wrong.

---

## Common Scenarios

### Resume from LinkedIn

```
You: Hi my cv is here: https://www.linkedin.com/in/elbruno/
```

The coach uses MarkItDown to extract your profile information and tailors questions to your experience in AI, developer advocacy, and Microsoft technologies.

### Resume from a PDF file

```
You: My resume is at https://mysite.com/resume.pdf
```

### Skip resume, provide only job description

```
You: I don't have a resume handy, but here's the job: https://careers.example.com/job/12345
```

### Practice with sample files

Use the included samples:

```
You: Can you use the sample resume for Peter Parker?
```

> Note: The sample files in `samples/` are PDFs. You would need to provide them as accessible URLs or paste their content.

### Resume later

```
You: I need to go. Can I resume later?
Coach: Of course! Your Session ID is a1b2c3d4-...
       Just mention this ID when you come back and we'll pick up where you left off.
```

---

## Troubleshooting

| Issue | Solution |
|-------|---------|
| Coach doesn't parse my URL | Ensure the URL is publicly accessible. Private LinkedIn profiles may not be fully parseable. |
| No response from the coach | Check the Aspire Dashboard — ensure all services are ✅ Running. |
| Rate limiting errors | If using GitHub Models, you may hit the 15 RPM limit. Wait a moment and try again, or switch to Foundry/Azure OpenAI. |
| Session not found | Start a new session. Session data persists in SQLite but may be cleared between restarts. |

For more help, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

---

## Next Steps

- **[Quick Start Guide](QUICK-START.md)** — Setup and configuration
- **[Architecture](ARCHITECTURE.md)** — How the system works under the hood
- **[Tutorials](TUTORIALS.md)** — Customize the agent and build your own MCP servers
- **[Multi-Agent Guide](MULTI-AGENT.md)** — Understand the multi-agent handoff pattern
- **[FAQ](FAQ.md)** — Common questions
