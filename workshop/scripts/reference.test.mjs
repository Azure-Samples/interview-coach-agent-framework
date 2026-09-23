import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { readReference } from '../labs/reference.mjs';

const validTags = ['3.0.0-workshop', '12.34.56-workshop', 'workshop-v3-reference.1'];
const invalidTags = ['3.0.0', 'v3.0.0-workshop', '3.0-workshop', '3.0.0-workshop-extra',
  '3x0x0-workshop', 'refs/tags/3.0.0-workshop', '--help', 'workshop-tag:other', 'workshop-tag name', ''];
const workflow = readFileSync(new URL('../../.github/workflows/static.yml', import.meta.url), 'utf8');
const workflowPattern = workflow.match(/if \[\[ ! "\$source_tag" =~ (.+) \]\]; then/);
assert.ok(workflowPattern, 'The workflow must validate the source tag before fetching it.');
const tagPattern = new RegExp(workflowPattern[1]);

function runTagStep({ sourceTag = validTags[0], tagExists = false, headRepository = '', fetchStatus = 0 } = {}) {
  const runBlock = workflow.match(/- name: Fetch workshop reference tag[\s\S]*?        run: \|\n([\s\S]*?)(?=      - name:)/);
  assert.ok(runBlock, 'The workflow must fetch the workshop reference tag.');
  const script = runBlock[1].replace(/^ {10}/gm, '').replaceAll('${{ github.repository }}', 'upstream/workshop');
  const bash = process.platform === 'win32'
    ? resolve(execFileSync('git', ['--exec-path'], { encoding: 'utf8' }).trim(), '..', '..', '..', 'bin', 'bash.exe')
    : 'bash';
  const result = spawnSync(bash, ['-e', '-c', `
jq() {
  printf '%s\\n' "$TEST_SOURCE_TAG"
}
git() {
  printf 'git'
  printf ' <%s>' "$@"
  printf '\\n'
  case "$1" in
    show-ref) return "$TEST_TAG_STATUS" ;;
    fetch) return "$TEST_FETCH_STATUS" ;;
    *) return 99 ;;
  esac
}
${script}`], {
    encoding: 'utf8',
    env: {
      ...process.env,
      HEAD_REPOSITORY: headRepository,
      TEST_SOURCE_TAG: sourceTag,
      TEST_TAG_STATUS: tagExists ? '0' : '1',
      TEST_FETCH_STATUS: String(fetchStatus),
    },
  });
  assert.ifError(result.error);
  return result;
}

test('workflow reuses a checked-out upstream tag without requiring it in the fork', () => {
  const result = runTagStep({ tagExists: true, headRepository: 'contributor/workshop', fetchStatus: 128 });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /git <show-ref> <--verify> <--quiet> <refs\/tags\/3\.0\.0-workshop>/);
  assert.match(result.stdout, /Using checked-out workshop reference tag: 3\.0\.0-workshop/);
  assert.doesNotMatch(result.stdout, /git <fetch>/);
});

test('workflow fetches missing tags from the PR head or upstream for non-PR builds', () => {
  for (const headRepository of ['contributor/workshop', '']) {
    const result = runTagStep({ headRepository });
    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.stdout.includes(`git <fetch> <--no-tags> <https://github.com/${headRepository || 'upstream/workshop'}.git> <refs/tags/3.0.0-workshop:refs/tags/3.0.0-workshop>`));
  }
});

test('workflow fails when a missing reference tag cannot be fetched', () => {
  const result = runTagStep({ headRepository: 'contributor/workshop', fetchStatus: 128 });
  assert.equal(result.status, 128);
  assert.match(result.stdout, /git <fetch>/);
});

test('workflow rejects invalid tags before checking or fetching refs', () => {
  for (const sourceTag of invalidTags) {
    const result = runTagStep({ sourceTag, tagExists: true });
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stdout, /::error::Invalid workshop source tag:/);
    assert.doesNotMatch(result.stdout, /git </);
  }
});

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
