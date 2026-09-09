# Workshop authoring

This is a static Astro/Starlight website. It never connects to learners' Azure accounts or runs their applications.

## Local development

Use Node 24 and Git. `zip` is required for downloadable checkpoints. From this directory:

```sh
npm ci
npm run dev
```

Open the URL printed by Astro, including the repository base path. `npm run build` creates `dist/` and validates lesson structure, internal links/anchors, and existing sample PDF URLs. `npm test` checks the checkpoint recipes. `npm run check:labs` builds each generated .NET solution and needs .NET 10 and NuGet access.

## Content contract

Core lessons are in `src/content/docs/workshop/`. Each has what, why, how/where, observable result, exercise, troubleshooting, and carry-forward sections. Keep examples tied to real checkpoint code using `CodeSample`; invalid source anchors fail the build.

Reference Markdown lives only in root `docs/`. The build imports it into an ignored generated directory and rewrites local links. Do not edit generated reference pages or duplicate their contents in the workshop.

## Checkpoint contract

`labs/manifest.json` names a reference commit, resolved direct NuGet package versions, and milestone IDs. `labs/recipes.mjs` contains explicit, source-anchored transformations for the small number of files that change between stages. The generator derives complete projects and readable incremental patches; it does not keep seven checked-in copies of the application.

The final application sources match the reference. `Directory.Packages.props` is the named exception: generated downloads pin the direct package versions used by this workshop. `WORKSHOP.txt` is additional packaging documentation. The reference container tag remains `latest`, so record the MarkItDown image digest in runtime reports.

The generator rejects source drift in the current checkout. When updating application sources, deliberately update the reference revision, recipes, package pins, lesson snippets, and expected behaviour together. Do not suppress a mismatch to get a green build.

Archives are generated before any build outputs exist, so they exclude `bin/`, `obj/`, local secrets, and unrelated repository files. Extract recovery archives into new directories; do not add destructive catch-up commands to lessons.

## Publishing

The existing `.github/workflows/static.yml` builds PRs without deploying, then publishes main/manual builds through the single Pages deployment job. Only `dist/` is published. The old root-level PDF URLs are retained alongside `/samples/`.

`GITHUB_REPOSITORY` controls repository/source links and the default Pages subpath. Set `SITE_URL` and `BASE_PATH` consistently for a custom domain or root deployment, including during validation. For example, `BASE_PATH=/ SITE_URL=https://example.com npm run build`.

Normal site/checkpoint builds do not need Azure credentials or paid model calls. Live Foundry/Container Apps exercises require a separate, explicitly approved environment, resource inventory, and cleanup procedure. Do not interpret a successful static or .NET build as a completed live model smoke test.
