import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const workshop = fileURLToPath(new URL('../', import.meta.url));
const folder = resolve(workshop, '.generated/first-agent');
const manifest = JSON.parse(readFileSync(resolve(workshop, 'labs/manifest.json'), 'utf8'));
mkdirSync(folder, { recursive: true });
for (const file of ['Directory.Build.props', 'Directory.Build.targets', 'Directory.Packages.props']) {
  writeFileSync(resolve(folder, file), '<Project />\n');
}
if (!existsSync(resolve(folder, 'FirstAgent.csproj'))) {
  execFileSync('dotnet', ['new', 'console', '--name', 'FirstAgent', '--framework', 'net10.0', '--output', '.', '--no-restore'], {
    cwd: folder, stdio: 'inherit',
  });
}
for (const name of ['Microsoft.Agents.AI.OpenAI', 'Azure.Identity']) {
  const version = manifest.packageVersions[name];
  if (!version) throw new Error(`Missing independent-agent package pin: ${name}`);
  execFileSync('dotnet', ['add', 'package', name, '--version', version, '--no-restore'], {
    cwd: folder, stdio: 'inherit',
  });
}
const source = resolve(workshop, 'labs/first-agent.cs');
copyFileSync(source, resolve(folder, 'Program.cs'));
execFileSync('dotnet', ['build', '--nologo', '-v:q'], { cwd: folder, stdio: 'inherit' });
assert.ok(readFileSync(resolve(folder, 'Program.cs')).equals(readFileSync(source)));

const environment = { ...process.env };
delete environment.FOUNDRY_OPENAI_ENDPOINT;
delete environment.FOUNDRY_DEPLOYMENT;
for (const [values, expected] of [
  [{}, /Set FOUNDRY_OPENAI_ENDPOINT before running/],
  [{ FOUNDRY_OPENAI_ENDPOINT: 'https://workshop-example.openai.azure.com/openai/v1/' },
    /Set FOUNDRY_DEPLOYMENT before running/],
  [{ FOUNDRY_OPENAI_ENDPOINT: 'http://workshop-example.openai.azure.com/openai/v1/', FOUNDRY_DEPLOYMENT: 'chat' },
    /must be an HTTPS endpoint/],
  [{ FOUNDRY_OPENAI_ENDPOINT: 'https://workshop-example.openai.azure.com/openai/v1/', FOUNDRY_DEPLOYMENT: ' ' },
    /must contain the existing deployment name/],
]) {
  const result = spawnSync('dotnet', ['bin/Debug/net10.0/FirstAgent.dll'], {
    cwd: folder, env: { ...environment, ...values }, encoding: 'utf8', timeout: 15_000,
  });
  if (result.error) throw result.error;
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, expected);
}
console.log('Built the independent agent and checked configuration failures without model calls.');
