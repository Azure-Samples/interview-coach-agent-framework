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

Learners clone the finished app once into `interview-coach-example` in Chapter 0, then download `interview-coach-lab-starter.zip` once into a sibling `interview-coach-lab` folder in Chapter 1 (`01-starter`). They keep editing that same learner project through Chapter 14. The course splits MCP server exposure (`05-mcp-server`) from client connection (`06-mcp-state`), and extraction (`08-document-extraction`) from document use (`09-documents`). The specialist sequence is `10-first-handoff`, `11-interviewers`, then `12-handoffs`. Capstone finalization (`13-capstone`) reaches checkpoint `08-complete`; `14-debugging` uses that same completed checkpoint for verification.

Use headings about the work. Explain the change and why it belongs there, show the file and exact replacement point, then give a concrete run check. Keep the ordinary lesson focused on a few meaningful edits and its next working result. Use `Hint` for optional explanations. Keep billing, data handling, and cleanup warnings visible before the relevant action.

`CodeStep` renders a named edit from the generated contract. Each heading is followed by `File to edit` and `Function to edit`, derived from the source; file-level edits say so explicitly. Each required step must appear once, in replay order, in its owning lesson. Explain important API calls beside focused fragments. Preserve exact replacement anchors; avoid full finished-file dumps per lesson. `CodeSample` is for reading supplied code. Checkpoint downloads support comparison and recovery.

Put build/run instructions at completed stage boundaries. Individual edits can leave a temporarily incomplete method; readers must finish the ordered group before building. Every declared checkpoint must compile.

The component imports `.generated/edit-contract.json` as build data. Its copy controls preserve the original fragment, including trailing newlines. Copy from that contract. A `replace` step with an empty `after` removes a block, while `delete` removes a file. Use unique source anchors for insertion points and generated line numbers for diagnostics.

Use `ConceptDiagram` where a process boundary needs a picture. The server-only MCP stage retains the local practice-guidance function; the MCP client lesson replaces it. The first handoff has two agents, the interviewer stage has four, and the summary lesson completes all five roles and eleven edges. Label the introductory diagram as the usual interview path and the infrastructure diagram as application architecture. The roles transfer control and share the selected model.

The website stores its own chapter progress. Application conversations and interview records have separate owners. Changes to chapter meaning need an explicit curriculum-version decision.

Version 3 retains versions 1 and 2 in `previousVersions`. Earlier completion records remain untouched; the new version starts its own record and explains the change to returning learners.

The chapter renumbering keeps version 3 because the lessons and their completion criteria are unchanged. `legacyChapterIds` maps the old version-3 route IDs to their new names. Progress reads migrate these IDs in place, including mixed old/new records, while preserving completion and course order. Invalid records stay untouched until the learner explicitly toggles or resets progress. If a migration cannot be saved, the page keeps the completion marks and reports the storage failure.

`astro.config.mjs` uses the same mapping for public redirects, including the Pages base path. The removed `01-readiness` URL redirects separately to Chapter 0's tool checks; it is not a version-3 completion ID. Keep checkpoint IDs in `from`, `checkpoints`, `Checkpoint`, `CodeStep`, and `SuppliedSteps` unchanged when renaming a lesson route.

## Show both shells

Every shell-command example on the site has **Bash** and **PowerShell** tabs, even when the commands are identical. In lesson and resource MDX, import `Tabs` and `TabItem` from `@astrojs/starlight/components`. Put a `bash` fence in `<TabItem label="Bash">` and a `powershell` fence in `<TabItem label="PowerShell">`, inside `<Tabs syncKey="shell">`. Leave blank lines around each fence. The shared key carries the learner's shell choice between examples and pages.

Keep C#, JSON, sample prompts, and expected output in their own code blocks. Translate shell-specific variable assignments, environment variables, quoting, and line continuations rather than copying Bash syntax into the PowerShell tab.

For commands built from source metadata, use `src/components/ShellCommands.astro`: pass `command` when both shells use the same text, or explicit `bash` and `powershell` strings when they differ. The pinned checkout command and supplied capstone patch use this component.

In canonical `docs/` Markdown, write adjacent Bash and PowerShell fenced blocks. The reference importer turns each pair into the same tabs on the website while leaving both versions readable on GitHub. Edit those source files rather than generated reference pages.

## Supply hosting while keeping agent creation visible

The starter includes `src/InterviewCoach.Agent/WorkshopHosting.cs`, derived from the pinned `Program.cs`. It supplies the Foundry connection, authentication, and DevUI services/endpoints. The starter leaves it inactive and starts cloud-free.

The first-agent lesson begins with the learner's `ChatClientAgent` constructor and coaching instructions. Learners then activate the helper, register the coach, map DevUI, and add the model reference to root `apphost.cs`. Keep that deliberate activation and its cost warning visible.

All core orchestration edits use root `apphost.cs`. Keep `src/InterviewCoach.AppHost/AppHost.cs` and its settings in their cloud-free starter state through `07-handoffs`. The completed repository remains the reference application with both fully wired entry points.

At the capstone, `<SuppliedSteps transition="08-complete" />` accounts for the entire required supplied-support transition. Its source-only `08-complete-support.patch` restores the packaged reference `Program.cs`, project-based AppHost and settings, and removes `WorkshopHosting.cs` and `tools/list-mcp-tools.cs`. It also restores topology comments in `AgentDelegateFactory.cs`, bringing the patch to six files. All agent definitions and prompts stay unchanged.

The component lists the affected files and provides `git apply --check` followed by `git apply`. Apply only after the check succeeds; resolve mismatches by comparing the named files while preserving local work. The patch excludes `WORKSHOP.txt`, secrets, and packaging-only changes. Every source change remains in the declared edit contract and full replay/parity checks. Optional deployment starts after this finalization.

## Keep the reference in one place

Canonical reference Markdown lives in root `docs/`. `scripts/import-reference.mjs` imports it into the ignored generated reference directory and rewrites local links. `scripts/reference-scope.mjs` selects the Foundry-only workshop material and applies reviewed prose replacements; it rejects unreviewed alternative-provider references and links to excluded pages. Make general reference edits in the canonical sources and workshop-specific exclusions in that explicit scope. The standalone documentation keeps both providers.

Reference pages hold state mechanics, authentication, update semantics, hosting, upload retention, security boundaries, and cleanup. Keep resource pages short and task-based, linking to the relevant reference heading. Use direct, positive explanations throughout prose, tables, and diagram labels. Keep fictional-data guidance practical: name the sample to use and explain where its contents can travel.

## Preserve the checkpoint contract

`labs/manifest.json` records the immutable reference in `sourceTag`, its exact `sourceRevision`, and direct NuGet package versions. The manifest defines 13 checkpoint stages; checkpoint IDs are independent of lesson numbering. The initial archive is named `interview-coach-lab-starter.zip`.

`labs/reference.mjs` derives the Foundry-only workshop profile from that tagged source. It removes the alternative provider implementation, configuration, and dependencies and excludes the standalone test project from learner downloads. It also requires existing-model reuse in both AppHost settings, selects root `apphost.cs` in `aspire.config.json`, and removes the inherited `UserSecretsId` from `Directory.Build.props`; file-based learner apps get path-specific stores. The original repository and its tests retain both providers and their default provisioning behavior. All other runtime source files must remain byte-identical. The generated manifest records both source and packaged hashes, plus the complete list of files changed or omitted by the profile.

`labs/recipes.mjs` derives stages from that packaged reference; `labs/edits.mjs` defines their source-backed transition steps. The generated contract records each step's file, operation, before/after code, and learner or supplied ownership.

Replay validation applies every documented edit in order and compares the resulting files with the target checkpoint. Require complete changed-file coverage, unique anchors, exact ordering, and explicit supplied steps. Keep those checks alongside checkpoint compilation.

The MCP server stage must support real tool discovery with the supplied probe. The extraction stage must return parsed text on request while keeping its existing record lifecycle. The four-agent stage must route among its available roles; the summary agent arrives in `07-handoffs`.

The final application matches the declared Foundry-only workshop reference exactly, including its pinned direct package versions. `WORKSHOP.txt` supplies packaging instructions. MarkItDown retains the reference's `latest` image tag, so runtime reports should record its digest.

The generator rejects source drift. Commit source fixes first, then create a new immutable reference tag and update the manifest, recipes, step contracts, and lesson expectations together. Never move an existing published tag or suppress a comparison failure to make a build pass.

Archives exclude build outputs, local secrets, and unrelated files. Recovery instructions must extract into a separate folder without discarding existing work, then configure that folder's existing-model identifiers. Missing reuse configuration must fail before any model provisioning. Keep the example's shared model until every dependent project is finished.

## Publish the site

`.github/workflows/static.yml` builds pull requests without deploying, then publishes main/manual builds through its Pages deployment job. Only `dist/` is published. Existing root-level PDF URLs remain alongside `/samples/`.

`GITHUB_REPOSITORY` controls source links and the default Pages base path. For a custom host, set `SITE_URL` and `BASE_PATH` consistently during both build and validation, for example:

```sh
BASE_PATH=/ SITE_URL=https://example.com npm run build
```

Inspect the rendered opening and lessons at desktop and mobile sizes. Confirm code remains readable, diagrams have text equivalents, and the application explanation appears before a long chapter index. Automated content checks cannot decide whether the teaching is clear.
