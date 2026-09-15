# Workshop authoring

This static Astro/Starlight site teaches Microsoft Agent Framework and Foundry by building the interview coach. Learners run the application in their own environment.

## Work locally

Use Node 24, Git, and `zip` for downloadable checkpoints. From this directory:

```sh
npm ci
npm run dev
```

Open the URL printed by Astro, including the repository base path. The existing checks are:

| Command | Coverage |
| --- | --- |
| `npm test` | Script tests, including edit contracts and checkpoint recipes |
| `npm run build` | Content generation, site build, rendered links and anchors |
| `npm run check` | Astro and TypeScript diagnostics |
| `npm run check:labs` | Generated .NET solutions; requires .NET 10 and NuGet access |

Static checks need no Azure credentials. Live model calls and deployment require an approved environment and a resource inventory. Record the checks actually performed in maintainer or release notes, with live walkthrough results listed separately. Keep editorial verification status off learner pages.

## Author a chapter around an edit

Core chapters live in `src/content/docs/workshop/`. `src/data/course.json` owns all 15 lessons, numbered 0 through 14, their groups, and their entry/exit stages. Chapter 0, `00-orientation`, combines prerequisites and the completed-example run. Link tool checks to `workshop/00-orientation/#check-your-tools`; `01-readiness` is a legacy redirect.

Learners clone the finished app once into `interview-coach-example` in Chapter 0, then download `interview-coach-lab-starter.zip` once into a sibling `interview-coach-lab` folder in Chapter 1 (`01-starter`). They keep editing that same learner project through the course. The course splits MCP server exposure (`05-mcp-server`) from client connection (`06-mcp-state`), and extraction (`08-document-extraction`) from document use (`09-documents`). The specialist sequence is `10-first-handoff`, `11-interviewers`, then `12-handoffs`. Chapter 13 (`13-debugging`) practices failure recovery with the completed workflow. Chapter 14 (`14-summary`) reviews the concepts, their implementation, and why they matter. Both use `08-complete`, which has the same application source as `07-handoffs`.

Use headings about the work. Explain the change and why it belongs there, show the file and exact replacement point, then give a concrete run check. Keep the ordinary lesson focused on a few meaningful edits and its next working result. Use `Hint` for optional explanations. Keep billing, data handling, and cleanup warnings visible before the relevant action.

`CodeStep` renders a named edit from the generated contract. Each heading is followed by `File to edit` and `Function to edit`, derived from the source; file-level edits say so explicitly. Each required step must appear once, in replay order, in its owning lesson. Explain important API calls beside focused fragments. Preserve exact replacement anchors; avoid full finished-file dumps per lesson. `CodeSample` is for reading supplied code. Checkpoint downloads support comparison and recovery.

Put build/run instructions at completed stage boundaries. Individual edits can leave a temporarily incomplete method; readers must finish the ordered group before building. Every declared checkpoint must compile.

The component imports `.generated/edit-contract.json` as build data. Its copy controls preserve the original fragment, including trailing newlines. Copy from that contract. A `replace` step with an empty `after` removes a block, while `delete` removes a file. Use unique source anchors for insertion points and generated line numbers for diagnostics.

Use `ConceptDiagram` where a process boundary needs a picture. The server-only MCP stage retains the local practice-guidance function; the MCP client lesson replaces it. The first handoff has two agents, the interviewer stage has four, and the summary-agent lesson completes all five roles and eleven edges. Label the introductory diagram as the usual interview path and the infrastructure diagram as application architecture. The roles transfer control and share the selected model.

The website stores its own chapter progress. Application conversations and interview records have separate owners. Changes to chapter meaning need an explicit curriculum-version decision.

Version 4 replaces the capstone exercise with a workshop summary and moves debugging to Chapter 13. These are changed completion criteria, not just renamed routes. `previousVersions` retains versions 1, 2, and 3. Earlier completion records remain untouched. Version 4 starts its own record and explains the change to returning learners, so a completed old course does not automatically complete the new summary.

`legacyChapterIds` maps old routes directly to current routes. Both previous debugging URLs lead to Chapter 13. The removed capstone URLs lead to the workshop summary. Progress can normalize aliases within the current version, but it never imports an earlier version's completion record. Invalid records stay untouched until the learner explicitly toggles or resets progress. If normalization cannot be saved, the page keeps the completion marks and reports the storage failure.

Chapter 13 remains a `verification` lesson. Chapter 14 uses `kind: "summary"` and a review-specific completion label. It explains existing code without introducing edits or another interview exercise. Keep the summary's terminology consistent with the lessons and link back to their implementation.

`astro.config.mjs` uses the same mapping for public redirects, including the Pages base path. The removed `01-readiness` URL redirects separately to Chapter 0's tool checks; it is not a current completion ID. Keep checkpoint IDs in `from`, `checkpoints`, `Checkpoint`, and `CodeStep` unchanged when renaming a lesson route.

## Show both shells

Every shell-command example on the site has **Bash** and **PowerShell** tabs, even when the commands are identical. In lesson and resource MDX, import `Tabs` and `TabItem` from `@astrojs/starlight/components`. Put a `bash` fence in `<TabItem label="Bash">` and a `powershell` fence in `<TabItem label="PowerShell">`, inside `<Tabs syncKey="shell">`. Leave blank lines around each fence. The shared key carries the learner's shell choice between examples and pages.

Keep C#, JSON, sample prompts, and expected output in their own code blocks. Translate shell-specific variable assignments, environment variables, quoting, and line continuations rather than copying Bash syntax into the PowerShell tab.

For commands built from source metadata, use `src/components/ShellCommands.astro`: pass `command` when both shells use the same text, or explicit `bash` and `powershell` strings when they differ. The pinned checkout command uses this component.

In canonical `docs/` Markdown, write adjacent Bash and PowerShell fenced blocks. The reference importer turns each pair into the same tabs on the website while leaving both versions readable on GitHub. Edit those source files rather than generated reference pages.

## Supply hosting while keeping agent creation visible

The starter includes `src/InterviewCoach.Agent/WorkshopHosting.cs`, derived from the pinned `Program.cs`. It supplies the Foundry connection, authentication, and DevUI services/endpoints. The starter leaves it inactive and starts cloud-free.

The first-agent lesson begins with the learner's `ChatClientAgent` constructor and coaching instructions. Learners then activate the helper, register the coach, map DevUI, and add the model reference to root `apphost.cs`. Keep that deliberate activation and its cost warning visible.

All core orchestration edits use root `apphost.cs`. Keep `src/InterviewCoach.AppHost/AppHost.cs` and its settings in their cloud-free starter state throughout the core course. The standalone repository retains both fully wired entry points.

The completed application keeps `WorkshopHosting.cs`, its calls in `Program.cs`, and `tools/list-mcp-tools.cs`. The `07-handoffs` to `08-complete` transition has no source edits. The generator verifies that this transition preserves the application and removes stale patches. Learners check the saved summary in Chapter 12 and practice recovery in Chapter 13. They do not need to match the standalone repository's file layout.

Optional deployment has a separate `deployment-apphost.patch`, named in the lab manifest. `makeDeploymentProject` replaces only the project-based AppHost and its settings with their source-derived completed versions. The patch retains the learner's startup helper, agent instructions, UI, and root AppHost. The deployment guide requires `git apply --check` before application and explains how to preserve local work if the check fails. The patch excludes `WORKSHOP.txt`, secrets, and packaging-only changes. Generation checks its exact two-file scope; `check:labs` also builds the deployment variant.

## Keep the reference in one place

Canonical reference Markdown lives in root `docs/`. `scripts/import-reference.mjs` imports it into the ignored generated reference directory and rewrites local links. `scripts/reference-scope.mjs` selects the Foundry-only workshop material and applies reviewed prose replacements; it rejects unreviewed alternative-provider references and links to excluded pages. It also updates references to the final chapters for the workshop site without changing standalone documentation. Workshop-only changes belong in that projection. The standalone documentation keeps both providers.

Reference pages hold state mechanics, authentication, update semantics, hosting, upload retention, security boundaries, and cleanup. Keep resource pages short and task-based, linking to the relevant reference heading. Use direct, positive explanations throughout prose, tables, and diagram labels. Keep fictional-data guidance practical: name the sample to use and explain where its contents can travel.

## Preserve the checkpoint contract

`labs/manifest.json` records the immutable reference in `sourceTag`, its exact `sourceRevision`, and direct NuGet package versions. The manifest defines 13 checkpoint stages; checkpoint IDs are independent of lesson numbering. The initial archive is named `interview-coach-lab-starter.zip`.

`labs/reference.mjs` derives the Foundry-only workshop profile from that tagged source. It removes the alternative provider implementation, configuration, and dependencies and excludes the standalone test project from learner downloads. It also requires existing-model reuse in both AppHost settings, selects root `apphost.cs` in `aspire.config.json`, and removes the inherited `UserSecretsId` from `Directory.Build.props`; file-based learner apps get path-specific stores. The original repository and its tests retain both providers and their default provisioning behavior.

Profile `foundry-workshop-v2` also adds a session ID display to the source-derived `Chat.razor`. This is a declared workshop-only change; the tagged source and standalone application stay unchanged. The recipes omit the display before `07-interviewers`. Chapter 11 teaches its addition through `interviewers-session-id`, and later stages retain it. The display reads the existing `sessionId` field without changing messages, model calls, or record creation.

`labs/recipes.mjs` derives stages from that packaged reference; `labs/edits.mjs` defines their source-backed transition steps. The generated contract records each step's file, operation, before/after code, and learner or supplied ownership.

Replay validation applies every documented edit in order and compares the resulting files with the target checkpoint. Require complete changed-file coverage, unique anchors, exact ordering, and explicit supplied steps. Keep those checks alongside checkpoint compilation.

The MCP server stage must support real tool discovery with the supplied probe. The extraction stage must return parsed text on request while keeping its existing record lifecycle. The four-agent stage must route among its available roles; the summary agent arrives in `07-handoffs`.

The completed workflow and single-agent implementation come from the Foundry-only reference. The generated application keeps its workshop startup layout. Tests cover the complete agent definitions, root service graph, model setup, AG-UI endpoints, tool contracts, and the unchanged final checkpoint transition. The generated manifest records `sourceHashes` for the tagged source, `packagedHashes` for the Foundry-only base reference, and `completedHashes` for the final workshop project. `referenceChanges` and `completedChanges` record the respective source differences. These hashes verify generated downloads; matching the standalone file layout is not a learner completion requirement.

`WORKSHOP.txt` supplies packaging instructions. MarkItDown retains the reference's `latest` image tag, so runtime reports should record its digest.

The generator rejects source drift. Commit source fixes first, then create a new immutable reference tag and update the manifest, recipes, step contracts, and lesson expectations together. Never move an existing published tag or suppress a comparison failure to make a build pass.

Archives exclude build outputs, local secrets, and unrelated files. Recovery instructions must extract into a separate folder without discarding existing work, then configure that folder's existing-model identifiers. Missing reuse configuration must fail before any model provisioning. Keep the example's shared model until every dependent project is finished.

## Publish the site

`.github/workflows/static.yml` builds pull requests without deploying, then publishes main/manual builds through its Pages deployment job. Only `dist/` is published. Existing root-level PDF URLs remain alongside `/samples/`.

`GITHUB_REPOSITORY` controls source links and the default Pages base path. For a custom host, set `SITE_URL` and `BASE_PATH` consistently during both build and validation, for example:

```sh
BASE_PATH=/ SITE_URL=https://example.com npm run build
```

Inspect the rendered opening and lessons at desktop and mobile sizes. Confirm code remains readable, diagrams have text equivalents, and the application explanation appears before a long chapter index. Automated content checks cannot decide whether the teaching is clear.
