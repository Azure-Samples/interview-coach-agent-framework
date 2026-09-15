import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { excludedReferences, workshopReferenceMarkdown } from './reference-scope.mjs';

const docs = fileURLToPath(new URL('../../docs/', import.meta.url));
const walk = path => readdirSync(path, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
  ? walk(resolve(path, entry.name)) : [resolve(path, entry.name)]);

test('workshop reference projection contains only its selected backend', () => {
  for (const path of walk(docs).filter(path => path.endsWith('.md'))) {
    const name = relative(docs, path).replaceAll('\\', '/');
    if (excludedReferences.has(name)) continue;
    const original = readFileSync(path, 'utf8');
    const projected = workshopReferenceMarkdown(name, original);
    assert.doesNotMatch(projected, /copilot/i, name);
    assert.equal(readFileSync(path, 'utf8'), original, 'Projection must not change the canonical sample reference.');
  }
});

test('new unreviewed alternative-provider references fail explicitly', () => {
  assert.throws(() => workshopReferenceMarkdown('NEW.md', 'Try GitHub Copilot here'), /Out-of-scope/);
});

test('workshop references describe the revised final chapters without changing shared sources', () => {
  for (const path of walk(docs).filter(path => path.endsWith('.md'))) {
    const name = relative(docs, path).replaceAll('\\', '/');
    if (excludedReferences.has(name)) continue;
    const original = readFileSync(path, 'utf8');
    const projected = workshopReferenceMarkdown(name, original);
    assert.doesNotMatch(projected, /capstone|workshop\/14-debugging\/|final debugging lesson/i, name);
    assert.equal(readFileSync(path, 'utf8'), original, name);
    if (name === 'LEARNING-OBJECTIVES.md') {
      assert.match(projected, /\[13\. Find and fix a failed step\]\([^)]*\/13-debugging\/\)/);
      assert.match(projected, /\[14\. Review what you built\]\([^)]*\/14-summary\/\)/);
      assert.equal((projected.match(/^\| \[\d+\./gm) ?? []).length, 15);
    }
    if (name === 'TUTORIALS.md') {
      for (const route of ['12-handoffs/#save-the-final-feedback', '13-debugging/', '14-summary/']) {
        assert.ok(projected.includes(`workshop/${route}`), route);
      }
    }
  }
});
