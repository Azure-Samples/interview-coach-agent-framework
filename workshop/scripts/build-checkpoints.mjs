import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { deploymentPaths, makeDeploymentProject, makeStage } from '../labs/recipes.mjs';
import { assertSameFiles, buildEditContract, replayTransition } from '../labs/edits.mjs';
import { normalizeCheckpointPatch, sourceOnlyPatch } from './checkpoint-patch.mjs';
import { readReference, createWorkshopReference, referenceProfile } from '../labs/reference.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const workshop = resolve(root, 'workshop');
const manifest = JSON.parse(readFileSync(resolve(workshop, 'labs/manifest.json'), 'utf8'));
if (!/^[a-z0-9-]+\.patch$/.test(manifest.deploymentPatch)) throw new Error('Invalid deployment patch name.');
const reference = readReference(root, manifest);
const hash = value => createHash('sha256').update(value).digest('hex');
const output = resolve(workshop, '.generated/checkpoints');
const downloads = resolve(workshop, 'public/downloads');
mkdirSync(output, { recursive: true });
mkdirSync(downloads, { recursive: true });
const sourceHashes = Object.fromEntries([...reference].map(([path, contents]) => [path, hash(contents)]));
const packagedReference = createWorkshopReference(reference, manifest.packageVersions);
const packagedHashes = Object.fromEntries([...packagedReference].map(([path, contents]) => [path, hash(contents)]));
const completedReference = makeStage(packagedReference, '08-complete');
const completedHashes = Object.fromEntries([...completedReference].map(([path, contents]) => [path, hash(contents)]));
const completedChanges = [...new Set([...packagedReference.keys(), ...completedReference.keys()])]
  .filter(path => !packagedReference.has(path) || !completedReference.has(path) || !packagedReference.get(path).equals(completedReference.get(path)));
const referenceChanges = [...new Set([...reference.keys(), ...packagedReference.keys()])]
  .filter(path => !reference.has(path) || !packagedReference.has(path) || !reference.get(path).equals(packagedReference.get(path)));
const contract = buildEditContract(packagedReference, manifest.sourceRevision);
if (JSON.stringify(manifest.stages.map(stage => stage.id)) !== JSON.stringify(['02-starter', ...contract.transitions.map(item => item.to)])) {
  throw new Error('Manifest stages and edit-contract transitions differ.');
}

function writeProject(folder, files) {
  // Only generated project folders are passed here; never touch a learner's folder.
  if (existsSync(folder)) rmSync(folder, { recursive: true });
  mkdirSync(folder, { recursive: true });
  for (const [path, contents] of files) {
    mkdirSync(dirname(resolve(folder, path)), { recursive: true });
    writeFileSync(resolve(folder, path), contents);
  }
}

function projectPatch(before, after) {
  const result = spawnSync('git', ['diff', '--no-index', '--no-renames', '--binary', '--', before, after],
    { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (![0, 1].includes(result.status)) throw new Error(result.stderr || 'Checkpoint diff failed.');
  return normalizeCheckpointPatch(result.stdout, before, after);
}

let previous;
let previousFiles;
for (const stage of manifest.stages) {
  if (!/^\d\d-[a-z-]+$/.test(stage.id)) throw new Error(`Invalid stage ID: ${stage.id}`);
  if (stage.archive !== undefined && !/^[a-z0-9-]+\.zip$/.test(stage.archive)) throw new Error(`Invalid archive name: ${stage.archive}`);
  const folder = resolve(output, stage.id);
  const files = makeStage(packagedReference, stage.id);
  const transition = contract.transitions.find(item => item.to === stage.id);
  if (previousFiles) {
    assertSameFiles(replayTransition(previousFiles, transition), files, `Replay ${stage.id}`);
  }
  writeProject(folder, files);
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
Use the root AppHost throughout the course. Keep WorkshopHosting.cs and the MCP discovery probe.
Chapter 13 practices debugging with the completed application. Chapter 14 reviews the workshop.
Prepare the separate project-based AppHost only for optional deployment: https://codemillmatt.github.io/interview-coach-agent-framework/resources/deployment/
Cosmos arrives in Expose interview tools with MCP; MarkItDown arrives in Read a resume with a tool.
Stopping local apps keeps the shared Foundry account. Delete cloud resources only when their owner confirms both projects are finished.
Directory.Packages.props pins the direct package versions used by the workshop.
No credentials are included.
`);
  if (stage.id === '08-complete') {
    assertSameFiles(files, completedReference, 'Completed workshop checkpoint');
  }
  const archive = resolve(downloads, stage.archive ?? `${stage.id}.zip`);
  if (existsSync(archive)) rmSync(archive);
  execFileSync('zip', ['-q', '-r', archive, '.'], { cwd: folder });
  if (stage.archive && existsSync(resolve(downloads, `${stage.id}.zip`))) rmSync(resolve(downloads, `${stage.id}.zip`));
  const patchPath = resolve(downloads, `${stage.id}.patch`);
  rmSync(resolve(downloads, `${stage.id}-support.patch`), { force: true });
  if (!previous) {
    writeFileSync(patchPath, '# This is the initial application shell. Download its complete project.\n');
  } else if (transition.changedFiles.length) {
    writeFileSync(patchPath, projectPatch(previous, folder));
  } else {
    rmSync(patchPath, { force: true });
  }
  previous = folder;
  previousFiles = files;
}
const deploymentFolder = resolve(workshop, '.generated/deployment');
writeProject(deploymentFolder, makeDeploymentProject(packagedReference));
writeFileSync(resolve(downloads, manifest.deploymentPatch),
  sourceOnlyPatch(projectPatch(resolve(output, '08-complete'), deploymentFolder), deploymentPaths));
const contractJson = `${JSON.stringify(contract, null, 2)}\n`;
writeFileSync(resolve(workshop, '.generated/edit-contract.json'), contractJson);
writeFileSync(resolve(downloads, 'edit-contract.json'), contractJson);
writeFileSync(resolve(downloads, 'manifest.json'), `${JSON.stringify({ ...manifest, referenceProfile, referenceChanges, completedChanges, editContract: 'edit-contract.json', sourceHashes, packagedHashes, completedHashes }, null, 2)}\n`);
mkdirSync(resolve(workshop, 'public/samples'), { recursive: true });
for (const [path, contents] of reference) {
  if (!path.startsWith('samples/')) continue;
  writeFileSync(resolve(workshop, 'public', path), contents);
  writeFileSync(resolve(workshop, 'public', path.slice('samples/'.length)), contents);
}
console.log(`Built ${manifest.stages.length} checkpoint archives and replayed ${contract.transitions.reduce((count, item) => count + item.steps.length, 0)} explicit edits. The final lessons retain the working workshop layout; ${manifest.deploymentPatch} prepares only the optional deployment AppHost.`);
