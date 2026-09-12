import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { makeStage } from '../labs/recipes.mjs';
import { assertSameFiles, buildEditContract, replayTransition } from '../labs/edits.mjs';
import { normalizeCheckpointPatch, sourceOnlyPatch } from './checkpoint-patch.mjs';
import { readReference, createWorkshopReference, referenceProfile } from '../labs/reference.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const workshop = resolve(root, 'workshop');
const manifest = JSON.parse(readFileSync(resolve(workshop, 'labs/manifest.json'), 'utf8'));
const reference = readReference(root, manifest);
const hash = value => createHash('sha256').update(value).digest('hex');
const output = resolve(workshop, '.generated/checkpoints');
const downloads = resolve(workshop, 'public/downloads');
mkdirSync(output, { recursive: true });
mkdirSync(downloads, { recursive: true });
const sourceHashes = Object.fromEntries([...reference].map(([path, contents]) => [path, hash(contents)]));
const packagedReference = createWorkshopReference(reference, manifest.packageVersions);
const packagedHashes = Object.fromEntries([...packagedReference].map(([path, contents]) => [path, hash(contents)]));
const referenceChanges = [...new Set([...reference.keys(), ...packagedReference.keys()])]
  .filter(path => !reference.has(path) || !packagedReference.has(path) || !reference.get(path).equals(packagedReference.get(path)));
const contract = buildEditContract(packagedReference, manifest.sourceRevision);
if (JSON.stringify(manifest.stages.map(stage => stage.id)) !== JSON.stringify(['02-starter', ...contract.transitions.map(item => item.to)])) {
  throw new Error('Manifest stages and edit-contract transitions differ.');
}
let previous;
let previousFiles;
for (const stage of manifest.stages) {
  if (!/^\d\d-[a-z-]+$/.test(stage.id)) throw new Error(`Invalid stage ID: ${stage.id}`);
  if (stage.archive !== undefined && !/^[a-z0-9-]+\.zip$/.test(stage.archive)) throw new Error(`Invalid archive name: ${stage.archive}`);
  const folder = resolve(output, stage.id);
  // Only these manifest-named build outputs are disposable; never touch a learner's folder.
  if (existsSync(folder)) rmSync(folder, { recursive: true });
  mkdirSync(folder, { recursive: true });
  const files = makeStage(packagedReference, stage.id);
  if (previousFiles) {
    const transition = contract.transitions.find(item => item.to === stage.id);
    assertSameFiles(replayTransition(previousFiles, transition), files, `Replay ${stage.id}`);
  }
  for (const [path, contents] of files) {
    mkdirSync(dirname(resolve(folder, path)), { recursive: true });
    writeFileSync(resolve(folder, path), contents);
  }
  writeFileSync(resolve(folder, 'WORKSHOP.txt'), `${stage.title}
${stage.description}

Checkpoint: ${stage.id}
Source tag: ${manifest.sourceTag}
Reference revision: ${manifest.sourceRevision}
Workshop profile: ${referenceProfile}

${stage.id === '02-starter' ? 'Extract interview-coach-lab-starter.zip into interview-coach-lab once. Continue editing that folder throughout the course.' : 'This is an optional recovery/comparison checkpoint. Extract into a separate folder and keep your existing work.'}
The Chapter 0 example lives in interview-coach-example.
Setup and resource guidance: https://codemillmatt.github.io/interview-coach-agent-framework/workshop/00-orientation/
Run from this directory: aspire start --apphost ./apphost.cs
${stage.id === '02-starter' ? 'This application shell runs without cloud resources. Configure reuse of the Chapter 0 model before activating it in Chapter 2.' : 'Configure reuse of the Chapter 0 account and model deployment before starting. Model calls cost money; confirm the subscription and cleanup owner.'}
Use the root AppHost throughout the course. The project-based deployment entry point is prepared in the capstone.
Cosmos arrives in Expose interview tools with MCP; MarkItDown arrives in Read a resume with a tool.
Stopping local apps keeps the shared Foundry account. Delete cloud resources only when their owner confirms both projects are finished.
Directory.Packages.props pins the direct package versions used by the workshop.
No credentials are included.
`);
  if (stage.id === '08-complete') {
    assertSameFiles(files, packagedReference, 'Final packaged source parity');
  }
  const archive = resolve(downloads, stage.archive ?? `${stage.id}.zip`);
  if (existsSync(archive)) rmSync(archive);
  execFileSync('zip', ['-q', '-r', archive, '.'], { cwd: folder });
  if (stage.archive && existsSync(resolve(downloads, `${stage.id}.zip`))) rmSync(resolve(downloads, `${stage.id}.zip`));
  let patch = '# This is the initial application shell. Download its complete project.\n';
  if (previous) {
    const result = spawnSync('git', ['diff', '--no-index', '--no-renames', '--binary', '--', basename(previous), basename(folder)],
      { cwd: output, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
    if (![0, 1].includes(result.status)) throw new Error(result.stderr || 'Checkpoint diff failed.');
    patch = normalizeCheckpointPatch(result.stdout, basename(previous), basename(folder));
    const transition = contract.transitions.find(item => item.to === stage.id);
    if (transition.steps.length && transition.steps.every(step => step.ownership === 'supplied')) {
      writeFileSync(resolve(downloads, `${stage.id}-support.patch`), sourceOnlyPatch(patch, transition.changedFiles));
    }
    if (!patch) patch = '# No source changes. This checkpoint is the capstone reference.\n';
  }
  writeFileSync(resolve(downloads, `${stage.id}.patch`), patch);
  previous = folder;
  previousFiles = files;
}
const contractJson = `${JSON.stringify(contract, null, 2)}\n`;
writeFileSync(resolve(workshop, '.generated/edit-contract.json'), contractJson);
writeFileSync(resolve(downloads, 'edit-contract.json'), contractJson);
writeFileSync(resolve(downloads, 'manifest.json'), `${JSON.stringify({ ...manifest, referenceProfile, referenceChanges, editContract: 'edit-contract.json', sourceHashes, packagedHashes }, null, 2)}\n`);
mkdirSync(resolve(workshop, 'public/samples'), { recursive: true });
for (const [path, contents] of reference) {
  if (!path.startsWith('samples/')) continue;
  writeFileSync(resolve(workshop, 'public', path), contents);
  writeFileSync(resolve(workshop, 'public', path.slice('samples/'.length)), contents);
}
console.log(`Built ${manifest.stages.length} checkpoint archives and replayed ${contract.transitions.reduce((count, item) => count + item.steps.length, 0)} explicit edits; final source matches ${referenceProfile} derived from ${manifest.sourceRevision.slice(0, 8)}.`);
