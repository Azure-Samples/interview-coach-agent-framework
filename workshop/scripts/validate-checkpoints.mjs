import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { assertSameFiles, replayTransition } from '../labs/edits.mjs';
import { referenceProfile } from '../labs/reference.mjs';

const workshop = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(readFileSync(resolve(workshop, 'labs/manifest.json'), 'utf8'));
const generatedManifest = JSON.parse(readFileSync(resolve(workshop, 'public/downloads/manifest.json'), 'utf8'));
const contract = JSON.parse(readFileSync(resolve(workshop, '.generated/edit-contract.json'), 'utf8'));
if (contract.version !== 1 || contract.sourceRevision !== manifest.sourceRevision ||
    generatedManifest.sourceRevision !== manifest.sourceRevision ||
    generatedManifest.referenceProfile !== referenceProfile ||
    JSON.stringify(manifest.stages.map(stage => stage.id)) !== JSON.stringify(['02-starter', ...contract.transitions.map(item => item.to)])) {
  throw new Error('Generated checkpoints are stale. Run node scripts/build-checkpoints.mjs first.');
}
const paths = new Set([
  ...Object.keys(generatedManifest.packagedHashes),
  ...contract.transitions.flatMap(item => item.changedFiles),
]);
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
    for (const [path, expectedHash] of Object.entries(generatedManifest.packagedHashes)) {
      const contents = files.get(path);
      if (!contents || createHash('sha256').update(contents).digest('hex') !== expectedHash) {
        throw new Error(`Completed checkpoint differs from the declared workshop reference: ${path}`);
      }
    }
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
