import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { assertSameFiles, replayTransition } from '../labs/edits.mjs';
import { referenceProfile } from '../labs/reference.mjs';
import { deploymentPaths } from '../labs/recipes.mjs';

const workshop = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(readFileSync(resolve(workshop, 'labs/manifest.json'), 'utf8'));
const generatedManifest = JSON.parse(readFileSync(resolve(workshop, 'public/downloads/manifest.json'), 'utf8'));
const contract = JSON.parse(readFileSync(resolve(workshop, '.generated/edit-contract.json'), 'utf8'));
if (contract.version !== 1 || contract.sourceRevision !== manifest.sourceRevision ||
    generatedManifest.sourceRevision !== manifest.sourceRevision ||
    generatedManifest.referenceProfile !== referenceProfile ||
    generatedManifest.deploymentPatch !== manifest.deploymentPatch ||
    !generatedManifest.completedHashes ||
    JSON.stringify(manifest.stages.map(stage => stage.id)) !== JSON.stringify(['02-starter', ...contract.transitions.map(item => item.to)])) {
  throw new Error('Generated checkpoints are stale. Run node scripts/build-checkpoints.mjs first.');
}
const paths = new Set([
  ...Object.keys(generatedManifest.packagedHashes),
  ...Object.keys(generatedManifest.completedHashes),
  ...contract.transitions.flatMap(item => item.changedFiles),
]);

function assertHashes(files, expectedHashes, label) {
  for (const [path, expectedHash] of Object.entries(expectedHashes)) {
    const contents = files.get(path);
    if (!contents || createHash('sha256').update(contents).digest('hex') !== expectedHash) {
      throw new Error(`${label} differs from the generated download manifest: ${path}`);
    }
  }
}

let previous;
const checkedProbes = new Set();
for (const stage of manifest.stages) {
  const cwd = resolve(workshop, '.generated/checkpoints', stage.id);
  const files = new Map([...paths].filter(path => existsSync(resolve(cwd, path)))
    .map(path => [path, readFileSync(resolve(cwd, path))]));
  if (previous) {
    assertSameFiles(replayTransition(previous, contract.transitions.find(item => item.to === stage.id)), files,
      `Generated learner replay ${stage.id}`);
  }
  if (stage.id === '08-complete') {
    assertHashes(files, generatedManifest.completedHashes, 'Completed workshop checkpoint');
  }
  execFileSync('dotnet', ['build', 'InterviewCoach.slnx', '--nologo', '-v:q'], { cwd, stdio: 'inherit' });
  const probe = files.get('tools/list-mcp-tools.cs')?.toString('utf8');
  if (probe && !checkedProbes.has(probe)) {
    execFileSync('dotnet', ['build', 'tools/list-mcp-tools.cs', '--nologo', '-v:q'], { cwd, stdio: 'inherit' });
    checkedProbes.add(probe);
    console.log('Built the supplied MCP discovery probe');
  }
  console.log(`Built checkpoint ${stage.id}`);
  previous = files;
}
const deploymentRoot = resolve(workshop, '.generated/deployment');
const deploymentHashes = {
  ...generatedManifest.completedHashes,
  ...Object.fromEntries(deploymentPaths.map(path => [path, generatedManifest.packagedHashes[path]])),
};
const deployment = new Map(Object.keys(deploymentHashes).filter(path => existsSync(resolve(deploymentRoot, path)))
  .map(path => [path, readFileSync(resolve(deploymentRoot, path))]));
assertHashes(deployment, deploymentHashes, 'Optional deployment project');
execFileSync('dotnet', ['build', 'InterviewCoach.slnx', '--nologo', '-v:q'], { cwd: deploymentRoot, stdio: 'inherit' });
console.log('Built optional deployment project with the workshop helpers retained');
