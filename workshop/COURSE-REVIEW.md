# Course review: teaching quality and beginner readiness

Reviewed against one question: **can a competent .NET developer who has never built an agent finish this course and then build their own multi-agent app with MAF and Foundry?**

Assumed reader: knows C#, .NET, and Aspire. Comfortable with AI concepts at a consumer level. Has never used Microsoft Agent Framework, has never written agent instructions, and does not know what MCP is.

This is a review of `workshop/` only. The standalone sample and root `docs/` are out of scope except where they feed the workshop.

## Verdict

The mechanics of this course are strong. The progression is real, every chapter ends in something runnable, and the verification habits it teaches (read the tool result, read the logs, read the database, don't trust the chat reply) are better than most agent tutorials.

The gap is conceptual. The course teaches **this application** very well. It teaches **agents** by osmosis. A learner finishes able to modify the interview coach but without the two things they need to start their own project: a mental model of what the framework is doing for them, and any practice writing the instructions that actually drive agent behaviour.

Confidence at the end is likely to be "I followed that and it worked" rather than "I could do this again on a blank repo." Fixing that needs roughly one new short chapter, one expanded chapter, and a handful of paragraph-level additions. It does not need a restructure.

On AI-writing tells: the vocabulary and punctuation tells are already gone. No "crucial", "leverage", "seamless", "showcases", "underscores", no em dash overuse, no curly quotes, no bolded inline-header lists, no title case headings. What remains is structural: templated chapter openings, duplicated sentences, and a few grammar errors clustered in Chapter 0 and the landing page. Details in the AI-tells section.

---

## P1 findings: these block the stated goal

### 1. Nothing explains what an agent is before the learner builds one

Chapter 2 is where the learner first writes agent code. The entire conceptual explanation is:

> `ChatClientAgent` combines an `IChatClient` with the agent's name, description, instructions, and optional tools.
> `workshop/src/content/docs/workshop/02-first-coach.mdx:20`

That is an API description, not a concept. A reader who has only ever called a chat completion API will finish Chapter 3 without knowing what Agent Framework gives them that `IChatClient` alone does not. The landing page defers the question explicitly:

> We'll introduce agents, MCP, and Foundry as we use them.
> `workshop/src/content/docs/index.mdx:52`

"As we use them" turns out to mean "briefly, in a hint, after the code." The glossary does define the terms, but it lives in Resources and nothing in the lesson flow sends the learner there at the moment they need it.

The specific missing idea is the run loop: the model proposes text or a tool call, the framework executes the tool, feeds the result back, and repeats until the model produces a final answer. That is the thing that makes it an agent rather than a chatbot, and it is the thing that makes the rest of the course make sense. It first appears as a diagram in Chapter 4 (`tool-loop`), two chapters after the learner built an agent, and even there it is framed as "what happens when an agent calls a tool" rather than "this is the loop you just built."

**Fix.** Add roughly 400 words to Chapter 2 before the first `CodeStep`, or as a short Chapter 2 opening section: what an agent is (instructions plus model plus tools plus context), what MAF runs on your behalf, and why instructions carry so much weight. Move the `tool-loop` diagram earlier or show a simplified version here. Keep it prose and one diagram; no code.

### 2. Instructions are handed over, never taught

The agent instructions are the highest-leverage code in this application and the learner never writes a line of them. They paste them.

- `07-persistence.mdx` has exactly one code step, and it is a twenty-line instruction block.
- `09-documents.mdx` has two steps, both instruction rewrites.
- Chapters 10, 11, and 12 supply the triage routing prompt, three interviewer prompts, and the summariser prompt fully written.

The lessons explain what the instructions say. They never explain how anyone arrived at them, why they are phrased imperatively, why the session-lifecycle rules are ordered the way they are, or what happens when they are vague. For a learner who wants to build their own system, this is the single most transferable skill in the course and it is invisible.

**Fix.** Two cheap additions, no new chapter required.

- In Chapter 7, before the code step, add a short "why these rules exist" list tying each instruction line to the repository behaviour it protects against (duplicate transcript, erased document fields, false "saved" claims). The material already exists in the surrounding prose; it just needs to come first and be framed as a design decision.
- In Chapter 11 or 12, add a five-minute deliberate-failure exercise: remove or weaken one routing rule in the triage prompt, run it, watch the router misbehave, put it back. The course already has a deliberate-failure exercise for a broken URL in Chapter 13 and it is the most instructive moment in the workshop. Do the same for prompts.

### 3. Developer notes from the source repo are visible in learner code

Chapters 11 and 12 display code that contains comments about a refactor the learner never saw:

```
[07-interviewers] specialists-receptionist-agent   // FIX: Now hands off directly to behavioural_interviewer (next phase)
[07-interviewers] specialists-behavioural-agent    // FIX: Now hands off directly to technical_interviewer (next phase)
[07-handoffs]     summary-triage-agent             // FIX: Made state-aware to prevent re-routing loops. The old instructions
[07-handoffs]     summary-technical-agent          // FIX: Now hands off directly to summariser (next phase)
[07-handoffs]     specialists-handoff-graph        // FIX: Changed from pure hub-and-spoke (every specialist -> Triage -> next)
```

A beginner reads "FIX: Made state-aware to prevent re-routing loops. The old instructions were purely keyword-driven" and reasonably asks which old instructions, since they wrote these ones five minutes ago. It reads like leaked maintenance history, because it is. It is also the most obvious "this was assembled by a machine from another codebase" signal in the whole course.

These comments come from the pinned reference source, so the standalone sample stays as is. The workshop projection in `labs/reference.mjs` already rewrites source for the learner profile (it strips the Copilot provider, adds the session ID display). Stripping or rewriting these `FIX:` comment blocks belongs in the same place.

**Fix.** In `createWorkshopReference`, replace the `// FIX:` comment blocks with short present-tense comments that explain the design to someone seeing it for the first time, for example "Triage checks which phases are already complete before routing." Add a test asserting no `FIX:` or history-referencing comment survives into any checkpoint.

### 4. The learner never starts a project, so they cannot start one afterwards

Every chapter edits a prepared starter. The learner never creates a project, never adds a NuGet package, never registers `AddAIAgent` in a file they own, and never sees the minimum set of moving parts required to get one agent talking to Foundry. `WorkshopHosting.cs` is deliberately supplied and deliberately opaque, which is the right call during the course and a problem at the end of it.

The result: someone who finishes this workshop knows how to change the interview coach. They do not know how to produce an empty repo with one working agent in it.

**Fix.** Add a section to Chapter 14 (the summary) titled something like "Starting your own project", containing the minimum recipe: the packages, the model client registration, one `ChatClientAgent`, `AddAIAgent`, and where the Foundry connection string comes from. Point at `WorkshopHosting.cs` as the worked example they already have. Fifteen to twenty lines of prose and one short code listing. This converts the course from "I did a tutorial" to "I know the shape of the thing."

### 5. Conversation state in MAF is never taught

The application avoids the framework's own conversation abstraction: `Chat.razor` holds the list and resends the full history with every request, and the AG-UI client is stateless. The hints explain this accurately for this app. But a learner who opens the MAF docs the next day meets agent threads and conversation persistence and has no hook for them, having been taught only "send everything every time."

**Fix.** One paragraph, in Chapter 3's existing state hint or in Chapter 14: this app owns its history in the Blazor circuit, the framework also offers its own conversation/thread handling, and here is when you would reach for it.

---

## P2 findings: friction and inconsistency

### 6. There are no comprehension checks anywhere

`workshop/src/components/KnowledgeCheck.astro` is fully implemented, styled in `workshop.css`, has a no-JavaScript fallback, and is imported by exactly zero pages. Fifteen chapters, zero moments where the learner has to answer anything.

Every chapter check is "run this and look at the output." That verifies the code, not the understanding. A learner can complete all fifteen chapters with correct results and never once be asked why the receptionist has both tool sets and triage has none.

**Fix.** Use the component. One question per chapter at the natural decision point: Chapter 4 (why does the model not run your C# function itself), Chapter 6 (what does `ListToolsAsync` actually return), Chapter 7 (what happens if you resend the transcript), Chapter 10 (which agent can write to the record), Chapter 12 (why can the summariser not just set `IsCompleted`). If you would rather not use it, delete the component and its CSS.

`workshop/src/components/Architecture.astro` is also unused and appears superseded by `ConceptDiagram`. Same choice: use it or delete it.

### 7. Checkpoint numbers contradict chapter numbers, in the learner's face

Chapter 6 offers a download called `05-mcp-state`. Chapter 7 offers `05-persistence`. Chapter 11 offers `07-interviewers`. The Resources page lists thirteen archives numbered 02 through 08 under a course numbered 0 through 14.

The reason is sound: checkpoint IDs are immutable so archives, patches, and the edit contract stay stable across renumbering. The learner does not know that and has no way to infer it. At best it is noise; at worst someone downloads what they think is the Chapter 5 checkpoint.

**Fix.** Cheapest option: the `Checkpoint` component already receives the stage. Have it render the chapter title rather than the raw stage ID, and add one sentence to the Resources page explaining that archive names are stable identifiers, not chapter numbers. No generator change required.

### 8. MCP arrives with no justification at the point of use

Chapter 5 opens by telling the learner what they are about to do:

> The **InterviewData** project already has a repository for creating and reading interview records. We'll expose its operations through Model Context Protocol (MCP), start the service, and ask it which tools are available.

The learner has just written a perfectly good in-process C# tool in Chapter 4. Now they are asked to do eleven edits to expose the same kind of capability over HTTP, and nothing says why. The answer exists, but it is in the FAQ reference page ("Why use MCP instead of a local function?"), which is not in the lesson flow.

**Fix.** Two or three sentences at the top of Chapter 5, adapted from the FAQ answer: in-process functions are fine when your app owns the capability; MCP is for when a separate service owns tools that any client can discover; it costs you a transport and an extra thing to operate. Chapter 6's `mcp-connection` diagram then lands much better.

### 9. An unexplained pragma appears in learner-visible code

`#pragma warning disable MAAIW001` shows up in the handoff graph code steps in Chapters 10, 11, and 12. The trailing compiler text says the type is for evaluation purposes and subject to change. No lesson mentions it.

A beginner pasting a suppression for an "evaluation purposes only" API into their code, with no comment from the instructor, is a bad look and a missed teaching moment. It is also genuinely useful information: the handoff builder is preview surface.

**Fix.** One sentence in Chapter 10 next to the graph step: this API is still preview, the pragma acknowledges that, expect it to change.

### 10. Chapter 0 is the weakest writing in the course, and it is the first thing anyone reads

Grammar and typos, all in the first hundred lines:

| Line | Text | Problem |
| --- | --- | --- |
| 46 | "In addition your account will need access to specific regions where the models can be deployed to with appropriate capacity." | Missing comma, trailing preposition, hard to parse |
| 48 | "You will need confirm permission to provision resources and call the model, make sure there is sufficient model quota, and who will handle cleanup" | Missing "to", broken parallel structure, run-on |
| 50 | "This sounds worse than it is, stick to what we outline before and you _should_ be fine." | Comma splice, "outline before" is wrong, italicised hedge undercuts confidence |
| 100 | "So lets first test out that all the prerequisties are installed by running the final version of interview coach application." | "lets", "prerequisties", missing "the" |

Chapter 0 is also the longest chapter in the course at 1,511 words, and almost all of it is Azure setup before the learner has seen a single agent concept. That is a lot of cloud admin to survive on faith.

**Fix.** Copy-edit the four lines. Then consider moving the subscription-selection and resource-group detail into a collapsible or a linked setup page, keeping the critical path (check tools, sign in, clone, run, try it) visible and short. The payoff moment (a working five-agent interview) should arrive sooner.

### 11. Chapter pacing is inverted at the most important moment

| Chapter | Words | Code steps | Note |
| --- | --- | --- | --- |
| 00-orientation | 1511 | 0 | Longest chapter, all setup |
| 02-first-coach | 1075 | 5 | Good |
| **04-tools** | **433** | **3** | Shortest build chapter, most important new concept |
| 05-mcp-server | 495 | 11 | Most edits, least words per edit |
| 07-persistence | 655 | 1 | One giant prompt |
| 10-first-handoff | 1281 | 6 | Long, but earns it |
| 12-handoffs | 455 | 4 | Thin for the payoff chapter |

Chapter 4 is where the learner first sees a model decide to call their code. That is the conceptual centre of the entire course and it gets the fewest words of any build chapter. Chapter 12 completes the five-agent system, the thing the course is named after, in 455 words.

**Fix.** Expand 4 and 12. Chapter 4 should spend real time on the loop, on why the description text matters as much as the code, and on what the model saw when it chose the tool. Chapter 12 should spend more time on the finished graph: why these eleven edges and not a hub, what would break with a different topology.

### 12. Chapter 5 is eleven near-identical edits

Five of the eleven steps are "add an attribute to a method." The lesson does say "Apply the same pattern to listing, lookup, update, and completion", which helps, but the reader still clicks through five nearly identical code blocks.

**Fix.** Consider collapsing the five attribute steps into one step showing two examples, with the remaining three described. This conflicts with the current one-step-per-edit contract in `labs/edits.mjs`, so treat it as optional; the pedagogical gain is modest.

---

## P3 findings: polish

### 13. Voice and spelling drift

- Chapter 0 addresses the reader as "you." Chapters 1 onward use "we." Both are fine; mixing them in the same course is not. Chapter 1 opens "We'll start our own copy" right after a chapter written in "you" throughout.
- "behavioural" everywhere except `03-streaming.mdx:91`, which uses "behavioral" inside a sample prompt.
- The landing page calls the fifth agent a "summarize agent" (`index.mdx:14`) and "summariser" two lines later (`index.mdx:18`).

### 14. The landing page repeats itself

```
index.mdx:12  We'll use Microsoft Agent Framework to run the interview agents in .NET and Foundry to host their model.
index.mdx:16  We'll use Microsoft Agent Framework to create the interview coach's agents and Foundry to host their model.
```

The five roles are also listed at line 14 and again at line 18. This is a patching artifact and reads like it.

Other errors on the same page: "Welcome to the Building a multi-agent application with..." (line 10, dangling article), "The interview coach agents reads a fictional resume" (line 22, agreement), "if want a fresh starting point" (line 36, missing "you").

### 15. Templated chapter openings

Ten chapters open with a near-verbatim "Continue in the same `interview-coach-lab` project from the previous chapter." Nine contain the identical stop/build/start command block, hand-written each time.

The consistency itself is good and worth keeping. The verbatim repetition of the same sentence is what reads generated. Vary the sentence, and consider rendering the repeated command block through `ShellCommands.astro` so it is defined once.

### 16. `workshop/index.mdx` wording

- "Every build and Aspire command will be able to be run from your working folder's root." Double passive. "You can run every build and Aspire command from your working folder's root."
- A raw `<br/>` on line 12 is doing paragraph spacing by hand.
- "How to be successful" is a generic heading in a course that otherwise names the work.

### 17. No evaluation or iteration story

Nothing in the course addresses how you know an agent is behaving well over time, or what to do when the model makes a different choice on the second run. Chapter 13 covers diagnosing one concrete failure, which is good, but non-determinism is never named as a thing the learner will live with. The repo's own tests are stripped from learner downloads, so they do not even see testing modelled.

One paragraph in Chapter 14 acknowledging this, plus a pointer to evaluation tooling, would close the loop honestly.

---

## What works well, and should not be lost in any rewrite

Worth stating plainly, because a revision pass could easily damage these.

- **Single agent before multi-agent.** Building the whole interview as one coach, then splitting it, is the right order and is rarer than it should be in agent tutorials. The learner feels the reason for the split instead of being told.
- **MCP server and client are separate chapters.** Standing the server up and proving discovery with the probe before wiring the client means a failure in Chapter 6 has exactly one possible cause.
- **Extraction separated from document use.** Same discipline. Chapter 8 proves the parser returns text; Chapter 9 makes it matter.
- **Verification is never "the reply looks right."** Every chapter sends the learner to the tool result, the structured logs, or the Cosmos document. Chapter 10's dashboard walkthrough is genuinely excellent and names every UI label it expects the learner to click.
- **The update-contract teaching.** Preserve six fields, append only new transcript text, completion is a separate call. It is specific, it reflects real repository behaviour, and it is reinforced consistently.
- **Chapter 13's deliberate failure.** Breaking something on purpose and tracing it is the best teaching moment in the course.
- **Honest limits.** Fictional data, private endpoints, no per-user authorization, cloud resources persist after `aspire stop`. Stated repeatedly without moralising.

---

## Suggested order of work

1. Add the "what is an agent, what does MAF do for you" section to Chapter 2. (P1.1)
2. Strip the `FIX:` comments in the workshop projection and add a guard test. (P1.3)
3. Add "Starting your own project" to Chapter 14. (P1.4)
4. Copy-edit Chapter 0 lines 46, 48, 50, 100 and the landing page duplicates. (P2.10, P3.14)
5. Add the "why MCP" paragraph to Chapter 5 and the pragma sentence to Chapter 10. (P2.8, P2.9)
6. Add the instruction-design framing to Chapter 7 and the break-the-router exercise to Chapter 11 or 12. (P1.2)
7. Expand Chapters 4 and 12. (P2.11)
8. Decide on `KnowledgeCheck`: five questions, or delete it and `Architecture.astro`. (P2.6)
9. Fix voice, spelling, and templated openings. (P3.13, P3.15, P3.16)
10. Render checkpoint titles instead of raw stage IDs. (P2.7)

Items 1 through 5 are the ones that change whether the learner leaves confident. Everything else is quality.

## Note on scope

Items 1 through 2, 4 through 10 are authored-content or workshop-projection changes and stay inside `workshop/`. Item 3 (`FIX:` comments) is also a workshop-projection change in `labs/reference.mjs`; it does not require touching the standalone sample, though cleaning those comments in the source would be the tidier long-term fix and would need a new reference tag.

Any change to chapter meaning needs a curriculum-version decision, per `workshop/README.md`. Adding explanation to existing chapters does not change completion criteria. Adding a knowledge check or a new required exercise does.
