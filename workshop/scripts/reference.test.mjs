import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { readReference } from '../labs/reference.mjs';

const validTags = ['3.0.0-workshop', '12.34.56-workshop', 'workshop-v3-reference.1'];
const invalidTags = ['3.0.0', 'v3.0.0-workshop', '3.0-workshop', '3.0.0-workshop-extra',
  '3x0x0-workshop', 'refs/tags/3.0.0-workshop', '--help', 'workshop-tag:other', 'workshop-tag name', ''];
const workflow = readFileSync(new URL('../../.github/workflows/static.yml', import.meta.url), 'utf8');
const workflowPattern = workflow.match(/if \[\[ ! "\$source_tag" =~ (.+) \]\]; then/);
assert.ok(workflowPattern, 'The workflow must validate the source tag before fetching it.');
const tagPattern = new RegExp(workflowPattern[1]);

test('release and legacy workshop tags retain exact revision and source-drift checks', t => {
  const root = mkdtempSync(join(tmpdir(), 'workshop-reference-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  git('init', '--quiet');
  git('config', 'core.autocrlf', 'false');
  mkdirSync(join(root, 'src'));
  const file = join(root, 'src', 'Reference.cs');
  const contents = 'class Reference {}\n';
  writeFileSync(file, contents);
  git('add', 'src');
  git('-c', 'user.name=Workshop test', '-c', 'user.email=workshop-test@example.com',
    '-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'Create reference fixture');
  const sourceRevision = git('rev-parse', 'HEAD');

  for (const sourceTag of validTags) {
    assert.ok(tagPattern.test(sourceTag), `Workflow must accept ${sourceTag}`);
    git('tag', sourceTag);
    const reference = readReference(root, { sourceRevision, sourceTag });
    assert.equal(reference.get('src/Reference.cs').toString('utf8'), contents);
    assert.throws(() => readReference(root, { sourceRevision: '0'.repeat(40), sourceTag }),
      /source tag.*revision disagree/);
  }

  for (const sourceTag of [...invalidTags, undefined, null, 300]) {
    if (typeof sourceTag === 'string') {
      assert.ok(!tagPattern.test(sourceTag), `Workflow must reject ${JSON.stringify(sourceTag)}`);
    }
    assert.throws(() => readReference(root, { sourceRevision, sourceTag }),
      /immutable workshop source tag/);
  }

  writeFileSync(file, 'class ChangedReference {}\n');
  for (const sourceTag of validTags) {
    assert.throws(() => readReference(root, { sourceRevision, sourceTag }), /Reference drift/);
  }
});
