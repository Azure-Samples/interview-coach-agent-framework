import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { makeStage } from '../labs/recipes.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const workshop = resolve(root, 'workshop');
const manifest = JSON.parse(readFileSync(resolve(workshop, 'labs/manifest.json'), 'utf8'));
const git = (...args) => execFileSync('git', args, { cwd: root, maxBuffer: 32 * 1024 * 1024 });
const allowed = path => /^(src\/|tests\/|samples\/)/.test(path) ||
  /^(Directory\.Build\.(props|targets)|Directory\.Packages\.props|InterviewCoach\.slnx|LICENSE\.md|global\.json|apphost\.cs|apphost\.settings\.json|aspire\.config\.json|azure\.yaml)$/.test(path);
const paths = git('ls-tree', '-r', '--name-only', manifest.sourceRevision).toString().trim().split('\n').filter(allowed);
if (!paths.length) throw new Error('Reference tree is empty.');
const reference = new Map(paths.map(path => [path, git('show', `${manifest.sourceRevision}:${path}`)]));
const hash = value => createHash('sha256').update(value).digest('hex');
for (const [path, contents] of reference) {
  if (!existsSync(resolve(root, path)) || hash(readFileSync(resolve(root, path))) !== hash(contents)) {
    throw new Error(`Reference drift in ${path}. Review the curriculum and advance labs/manifest.json explicitly.`);
  }
}
const output = resolve(workshop, '.generated/checkpoints');
const downloads = resolve(workshop, 'public/downloads');
mkdirSync(output, { recursive: true });
mkdirSync(downloads, { recursive: true });
const sourceHashes = Object.fromEntries([...reference].map(([path, contents]) => [path, hash(contents)]));
let previous;
for (const stage of manifest.stages) {
  if (!/^\d\d-[a-z-]+$/.test(stage.id)) throw new Error(`Invalid stage ID: ${stage.id}`);
  const folder = resolve(output, stage.id);
  // Only these manifest-named build outputs are disposable; never touch a learner's folder.
  if (existsSync(folder)) rmSync(folder, { recursive: true });
  mkdirSync(folder, { recursive: true });
  const files = makeStage(reference, stage.id);
  const pinnedPackages = reference.get('Directory.Packages.props').toString().replace(
    /(<PackageVersion Include="([^"]+)" Version=")[^"]+(")/g,
    (_, prefix, name, suffix) => {
      const version = manifest.packageVersions[name];
      if (!version) throw new Error(`Missing package version pin: ${name}`);
      return `${prefix}${version}${suffix}`;
    }
  );
  files.set('Directory.Packages.props', Buffer.from(pinnedPackages));
  for (const [path, contents] of files) {
    mkdirSync(dirname(resolve(folder, path)), { recursive: true });
    writeFileSync(resolve(folder, path), contents);
  }
  writeFileSync(resolve(folder, 'WORKSHOP.txt'), `${stage.title}\n${stage.description}\n\nCheckpoint: ${stage.id}\nReference: ${manifest.sourceRevision}\n\nExtract to a new folder. Do not overwrite your current work.\nPrerequisites and resource/cost guidance: https://codemillmatt.github.io/interview-coach-agent-framework/workshop/01-readiness/\nRun from this directory: aspire start --apphost ./apphost.cs\nCheckpoints 03 onward can provision Foundry resources. Read the readiness lesson first.\nThe local Cosmos emulator and MarkItDown are introduced at later stages.\nDirectory.Packages.props pins the direct package versions used by the workshop. This is the explicit packaging difference from the reference.\nNo credentials are included.\n`);
  if (stage.id === '08-complete') {
    for (const [path, contents] of reference) {
      const expected = path === 'Directory.Packages.props' ? Buffer.from(pinnedPackages) : contents;
      if (hash(files.get(path)) !== hash(expected)) throw new Error(`Final checkpoint differs: ${path}`);
    }
  }
  const archive = resolve(downloads, `${stage.id}.zip`);
  if (existsSync(archive)) rmSync(archive);
  execFileSync('zip', ['-q', '-r', archive, '.'], { cwd: folder });
  let patch = '# This is the initial application shell. Download its complete project.\n';
  if (previous) {
    const result = spawnSync('git', ['diff', '--no-index', '--binary', '--', previous, folder], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
    if (![0, 1].includes(result.status)) throw new Error(result.stderr || 'Checkpoint diff failed.');
    patch = result.stdout
      .replaceAll(`a${previous}/`, 'a/').replaceAll(`b${folder}/`, 'b/')
      .replaceAll(`a/${previous}/`, 'a/').replaceAll(`b/${folder}/`, 'b/');
    if (!patch) patch = '# No source changes. This checkpoint is the capstone reference.\n';
  }
  writeFileSync(resolve(downloads, `${stage.id}.patch`), patch);
  previous = folder;
}
writeFileSync(resolve(downloads, 'manifest.json'), `${JSON.stringify({ ...manifest, sourceHashes }, null, 2)}\n`);
mkdirSync(resolve(workshop, 'public/samples'), { recursive: true });
for (const [path, contents] of reference) {
  if (!path.startsWith('samples/')) continue;
  writeFileSync(resolve(workshop, 'public', path), contents);
  writeFileSync(resolve(workshop, 'public', path.slice('samples/'.length)), contents);
}
console.log(`Built ${manifest.stages.length} independent checkpoint archives; final sources match ${manifest.sourceRevision.slice(0, 8)}.`);
