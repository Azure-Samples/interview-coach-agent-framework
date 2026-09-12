import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { normalizeCheckpointPatch, sourceOnlyPatch } from './checkpoint-patch.mjs';

test('source-only support patches apply from a continuous learner folder and remove helpers safely', () => {
  const root = mkdtempSync(join(tmpdir(), 'workshop-patch-test-'));
  try {
    const before = join(root, 'before');
    const after = join(root, 'after');
    const learner = join(root, 'learner');
    for (const folder of [before, after, learner]) mkdirSync(folder);
    for (const folder of [before, learner]) {
      writeFileSync(join(folder, 'Program.cs'), 'start\nhelper();\nend\n');
      writeFileSync(join(folder, 'Helper.cs'), 'supplied helper\n');
    }
    writeFileSync(join(after, 'Program.cs'), 'start\ninline();\nend\n');
    writeFileSync(join(before, 'WORKSHOP.txt'), 'previous checkpoint\n');
    writeFileSync(join(after, 'WORKSHOP.txt'), 'final checkpoint\n');
    writeFileSync(join(learner, 'WORKSHOP.txt'), 'original starter instructions\n');
    writeFileSync(join(learner, 'private-settings.json'), 'keep local settings\n');
    const diff = spawnSync('git', ['diff', '--no-index', '--no-renames', '--binary', '--', before, after], { encoding: 'utf8' });
    assert.equal(diff.status, 1);
    const normalized = normalizeCheckpointPatch(diff.stdout, before, after);
    assert.equal(normalized.includes(root), false);
    const patch = sourceOnlyPatch(normalized, ['Program.cs', 'Helper.cs']);
    assert.doesNotMatch(patch, /WORKSHOP\.txt/);
    const path = join(root, 'support.patch');
    writeFileSync(path, patch);
    execFileSync('git', ['apply', '--check', path], { cwd: learner });
    execFileSync('git', ['apply', path], { cwd: learner });
    assert.equal(readFileSync(join(learner, 'Program.cs'), 'utf8'), 'start\ninline();\nend\n');
    assert.equal(existsSync(join(learner, 'Helper.cs')), false);
    assert.equal(readFileSync(join(learner, 'WORKSHOP.txt'), 'utf8'), 'original starter instructions\n');
    assert.equal(readFileSync(join(learner, 'private-settings.json'), 'utf8'), 'keep local settings\n');
    assert.notEqual(spawnSync('git', ['apply', '--check', path], { cwd: learner }).status, 0);
  } finally {
    rmSync(root, { recursive: true });
  }
});

test('support patches reject undeclared, missing, duplicate or unnormalized files', () => {
  const section = 'diff --git a/Program.cs b/Program.cs\n--- a/Program.cs\n+++ b/Program.cs\n';
  assert.throws(() => sourceOnlyPatch(section, ['different.cs']), /Unexpected support patch file/);
  assert.throws(() => sourceOnlyPatch('', ['Program.cs']), /every declared/);
  assert.throws(() => sourceOnlyPatch(section + section, ['Program.cs']), /Unexpected support patch file/);
  assert.throws(() => sourceOnlyPatch(section.replace('b/Program.cs\n', 'b/tmp/before/Program.cs\n'), ['Program.cs']), /header/);
});

test('relative checkpoint roots normalize both sides of added and deleted files', () => {
  const patch = 'diff --git a/previous/Helper.cs b/previous/Helper.cs\n--- a/previous/Helper.cs\n+++ /dev/null\n'
    + 'diff --git a/next/New.cs b/next/New.cs\n--- /dev/null\n+++ b/next/New.cs\n';
  const normalized = normalizeCheckpointPatch(patch, 'previous', 'next');
  assert.equal(normalized.includes('previous/'), false);
  assert.equal(normalized.includes('next/'), false);
  assert.equal(sourceOnlyPatch(normalized, ['Helper.cs', 'New.cs']), normalized);
});
