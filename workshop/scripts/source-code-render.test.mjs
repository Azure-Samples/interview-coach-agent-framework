import test from 'node:test';
import assert from 'node:assert/strict';
import { parseEntities } from 'parse-entities';
import { buildCopyFixture, sample, shell, steps } from './code-copy-fixture.mjs';

test('isolated Astro components render native controls, exact payloads and operation-specific guidance', () => {
  const fixture = buildCopyFixture();
  try {
    const blocks = fixture.html.match(/<workshop-source-code\b[\s\S]*?<\/workshop-source-code>/g);
    const payload = block => JSON.parse(parseEntities(block.match(/\bdata-copy-source="([^"]*)"/)[1]));
    const expected = [
      sample, shell, shell,
      ...steps.flatMap(step => step.operation === 'replace' && step.after
        ? [step.before, step.after] : [step.after || step.before])
    ];
    assert.deepEqual(blocks.map(payload), expected);
    const ordinary = fixture.html.match(/<section id="ordinary">([\s\S]*?)<\/section>/)[1];
    assert.doesNotMatch(ordinary, /workshop-source-code/);
    assert.match(ordinary, /class="copy"/);
    for (const block of blocks) {
      assert.match(block, /class="expressive-code"/);
      assert.match(block, /class="copy"/);
      assert.match(block, /<button\b[^>]*title="Copy to clipboard"/);
      assert.equal(block.match(/<button\b/g).length, 1, 'no competing custom control');
      assert.match(block, /data-copy-status[^>]*role="status"[^>]*aria-live="polite"/);
      assert.match(block, /<textarea\b[^>]*data-copy-fallback[^>]*readonly[^>]*hidden/);
    }
    for (const step of steps) {
      const section = fixture.html.match(new RegExp(`<section class="code-step" data-code-step="${step.id}"[\\s\\S]*?<\\/section>`))[0];
      const location = section.match(/<\/h3>\s*<div class="code-step-location">([\s\S]*?)<\/div>/)[1];
      const text = parseEntities(location.replace(/<[^>]*>/g, ''));
      assert.ok(text.includes(`File to edit: ${step.file}`));
      const label = step.location.kind === 'function' ? `Function to edit: ${step.location.name}` : 'Scope to edit:';
      assert.ok(text.includes(label));
      if (step.location.kind !== 'function') assert.ok(!text.includes('Function to edit:'));
      assert.equal((section.match(/<details\b/g) ?? []).length, step.operation === 'replace' && step.after ? 1 : 0);
      const result = section.slice(section.indexOf('data-step-result'));
      assert.equal(payload(result), step.after || step.before);
      if (step.operation === 'delete') assert.match(section, /Delete this file/);
      else if (step.operation === 'create') assert.match(section, /Create this file/);
      else if (!step.after) assert.match(section, /Keep the rest of the file/);
    }
  } finally { fixture.dispose(); }
});
