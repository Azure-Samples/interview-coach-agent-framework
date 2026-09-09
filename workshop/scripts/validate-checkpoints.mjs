import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
const manifest = JSON.parse(readFileSync('labs/manifest.json', 'utf8'));
for (const stage of manifest.stages) {
  const cwd = resolve('.generated/checkpoints', stage.id);
  execFileSync('dotnet', ['build', 'InterviewCoach.slnx', '--nologo', '-v:q'], { cwd, stdio: 'inherit' });
  console.log(`Built checkpoint ${stage.id}`);
}
