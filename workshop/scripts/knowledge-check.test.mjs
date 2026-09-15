import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const component = readFileSync(new URL('../src/components/KnowledgeCheck.astro', import.meta.url), 'utf8');
const script = component.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script);
const javascript = ts.transpileModule(script, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;

function form() {
  const feedback = { textContent: '' };
  const listeners = new Map();
  const control = {
    dataset: {},
    selected: null,
    querySelector: selector => selector === '.check-feedback' ? feedback : control.selected,
    addEventListener: (name, listener) => {
      assert.ok(!listeners.has(name), `Duplicate ${name} handler`);
      listeners.set(name, listener);
    },
  };
  return { control, feedback, listeners };
}

test('knowledge checks explain both answers, reset feedback, and connect once per form', () => {
  const first = form();
  const forms = [first.control];
  const events = new Map();
  const document = {
    querySelectorAll: () => forms,
    addEventListener: (name, listener) => events.set(name, listener),
  };
  vm.runInNewContext(javascript, { document });
  let prevented = 0;
  const submit = () => first.listeners.get('submit')({ preventDefault: () => { prevented++; } });
  submit();
  assert.equal(first.feedback.textContent, '');
  first.control.selected = { dataset: { correct: 'false', explanation: 'The model requests a call; application code executes it.' } };
  submit();
  assert.equal(first.feedback.textContent, 'Incorrect. The model requests a call; application code executes it.');
  first.control.selected = { dataset: { correct: 'true', explanation: 'The runtime invokes the registered function.' } };
  submit();
  assert.equal(first.feedback.textContent, 'Correct. The runtime invokes the registered function.');
  assert.equal(prevented, 3);
  first.listeners.get('reset')();
  assert.equal(first.feedback.textContent, '');

  const second = form();
  forms.push(second.control);
  events.get('astro:page-load')();
  events.get('astro:page-load')();
  assert.equal(first.listeners.size, 2);
  assert.equal(second.listeners.size, 2);
});

test('knowledge checks retain native labels, validation, live feedback, and no-JavaScript explanations', () => {
  assert.match(component, /<fieldset>[\s\S]*<legend>/);
  assert.match(component, /<label>[\s\S]*type="radio"[\s\S]*required/);
  assert.match(component, /aria-live="polite" aria-atomic="true"/);
  assert.match(component, /<noscript>[\s\S]*options\.map[\s\S]*o\.explanation[\s\S]*<\/noscript>/);
  assert.match(component, /o\.correct \? 'Correct\.' : 'Incorrect\.'/);
});

test('the six conceptual checks have unique IDs and useful explanations for every option', () => {
  const expected = new Map([
    ['02-first-coach', 'agent-responsibility'],
    ['04-tools', 'tool-execution'],
    ['06-mcp-state', 'mcp-discovery'],
    ['07-persistence', 'transcript-append'],
    ['10-first-handoff', 'handoff-tool-access'],
    ['12-handoffs', 'summary-completion'],
  ]);
  const ids = new Set();
  for (const [chapter, expectedId] of expected) {
    const source = readFileSync(new URL(`../src/content/docs/workshop/${chapter}.mdx`, import.meta.url), 'utf8');
    const checks = [...source.matchAll(/<KnowledgeCheck\b[\s\S]*?\/>/g)];
    assert.equal(checks.length, 1, chapter);
    const check = checks[0][0];
    const id = check.match(/\bid="([^"]+)"/)?.[1];
    assert.equal(id, expectedId);
    assert.ok(!ids.has(id));
    ids.add(id);
    const optionsSource = check.match(/options=\{(\[[\s\S]*?\])\}/)?.[1];
    assert.ok(optionsSource, chapter);
    const options = vm.runInNewContext(`(${optionsSource})`);
    assert.equal(options.filter(option => option.correct).length, 1, chapter);
    for (const option of options) {
      assert.ok(option.text.trim());
      assert.ok(option.explanation.trim());
      assert.notEqual(option.explanation, option.text);
    }
  }
});
