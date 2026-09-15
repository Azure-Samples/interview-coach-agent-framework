import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const code = readFileSync(new URL('../src/scripts/source-copy.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(code, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;

function fixture(source, clipboard = { async writeText() {} }) {
  const listeners = [];
  const button = {
    type: '', dataset: { code: 'normalized, not the source', copied: 'Copied!' },
    addEventListener(type, handler, options) { listeners.push({ type, handler, options }); }
  };
  const status = { textContent: '' };
  const fallback = {
    value: '', hidden: true, rows: 0, focused: false, selected: false,
    selectionStart: 0, selectionEnd: 0, copy: undefined,
    focus() { this.focused = true; },
    select() { this.selected = true; this.selectionStart = 0; this.selectionEnd = this.value.length; },
    addEventListener(type, handler) { assert.equal(type, 'copy'); this.copy = handler; }
  };
  const elements = {
    '.expressive-code .copy button[data-code]': button,
    '[data-copy-status]': status, '[data-copy-fallback]': fallback
  };
  const root = { dataset: { copySource: JSON.stringify(source) }, querySelector: selector => elements[selector] };
  const exports = {};
  vm.runInNewContext(compiled, { exports, navigator: { clipboard } });
  const connect = () => exports.connectSourceCopy(root);
  const click = async () => {
    let stopped = false;
    await listeners[0].handler({ stopImmediatePropagation() { stopped = true; } });
    assert.equal(stopped, true, 'the native normalized copy must not also run');
  };
  return { root, elements, button, status, fallback, listeners, connect, click };
}

test('copy uses exact source bytes, not rendered or native normalized code', async () => {
  const sources = ['\n\treturn "<tag>&quoted";  \r\n\r\n', '\uFEFF// cafe\u0301 \u{1F600}\n', '\0\u007f\r\n', 'no trailing newline'];
  for (const source of sources) {
    const writes = [];
    const ui = fixture(source, { async writeText(value) { writes.push(value); } });
    ui.connect();
    await ui.click();
    assert.deepEqual(writes, [source]);
    assert.equal(ui.status.textContent, 'Copied!');
    assert.equal(ui.fallback.hidden, true);
    assert.equal(ui.fallback.focused, false);
    assert.equal(ui.button.type, 'button');
    assert.equal(ui.listeners[0].options.capture, true);
  }
});

test('denied or missing Clipboard API reveals and selects the exact fallback source', async () => {
  for (const clipboard of [undefined, {}, { async writeText() { throw new Error('Denied'); } }]) {
    const source = '\n\treturn agent;  \r\n';
    const ui = fixture(source, clipboard ?? null);
    ui.connect();
    await ui.click();
    assert.equal(ui.fallback.value, source);
    assert.equal(ui.fallback.hidden, false);
    assert.equal(ui.fallback.focused, true);
    assert.equal(ui.fallback.selected, true);
    assert.match(ui.status.textContent, /Ctrl\+C or Command\+C/);
    assert.doesNotMatch(ui.status.textContent, /Copied/);
  }
});

test('successful retry clears fallback and resets status for repeated live announcements', async () => {
  let denied = true;
  const ui = fixture('return agent;\n', { async writeText() {
    assert.equal(ui.status.textContent, '');
    if (denied) throw new Error('Denied');
  } });
  ui.connect();
  await ui.click();
  denied = false;
  await ui.click();
  assert.equal(ui.fallback.hidden, true);
  assert.equal(ui.status.textContent, 'Copied!');
  await ui.click();
});

test('manual full-selection copy retains CRLF even when the textarea normalizes its value', async () => {
  const source = 'first\r\nsecond\r\n';
  const ui = fixture(source, {});
  ui.connect();
  await ui.click();
  ui.fallback.value = source.replaceAll('\r\n', '\n');
  ui.fallback.select();
  let copied;
  let prevented = false;
  ui.fallback.copy({
    clipboardData: { setData(type, text) { assert.equal(type, 'text/plain'); copied = text; } },
    preventDefault() { prevented = true; }
  });
  assert.equal(copied, source);
  assert.equal(prevented, true);
  assert.equal(ui.status.textContent, 'Copied!');
  ui.fallback.selectionStart = 1;
  copied = undefined;
  ui.fallback.copy({ clipboardData: { setData() { copied = 'unexpected'; } } });
  assert.equal(copied, undefined, 'partial selections keep the browser default');
});

test('reconnecting a wrapper does not double-bind and different blocks stay independent', async () => {
  const writes = [];
  const first = fixture('current\n', { async writeText(text) { writes.push(text); } });
  const second = fixture('updated\n', { async writeText(text) { writes.push(text); } });
  first.connect();
  first.connect();
  second.connect();
  assert.equal(first.listeners.length, 1);
  await first.click();
  assert.equal(second.status.textContent, '');
  await second.click();
  assert.deepEqual(writes, ['current\n', 'updated\n']);
});

test('broken controls or source fail rather than silently copying different text', () => {
  for (const selector of ['.expressive-code .copy button[data-code]', '[data-copy-status]', '[data-copy-fallback]']) {
    const ui = fixture('text');
    delete ui.elements[selector];
    assert.throws(ui.connect, /missing its copy control/);
  }
  for (const value of [undefined, '{', 'null', '{}']) {
    const ui = fixture('text');
    ui.root.dataset.copySource = value;
    assert.throws(ui.connect);
  }
});

test('custom source blocks share native Starlight controls without trimming input or global DOM mutation', () => {
  const source = name => readFileSync(new URL(`../src/components/${name}.astro`, import.meta.url), 'utf8');
  const wrapper = source('SourceCode');
  assert.match(wrapper, /import \{ Code \} from '@astrojs\/starlight\/components'/);
  assert.match(wrapper, /data-copy-source=\{JSON.stringify\(code\)/);
  assert.match(wrapper, /role="status" aria-live="polite" aria-atomic="true"/);
  assert.match(wrapper, /aria-label="Code to copy" readonly hidden/);
  assert.doesNotMatch(code, /document\.|MutationObserver|innerHTML|execCommand/);
  for (const name of ['CodeSample', 'CodeStep', 'ShellCommands']) {
    assert.match(source(name), /import SourceCode from '.\/SourceCode.astro'/);
    assert.doesNotMatch(source(name), /trimEnd\(|data-copy-step|data-copy-source|astro:components/);
  }
  assert.match(source('CodeStep'), /<h3[^>]*>[\s\S]*?<\/h3>\s*<div class="code-step-location">/);
  assert.match(source('CodeStep'), /File to edit: <code>\{step.file\}/);
  assert.match(source('CodeStep'), /Function to edit: <code>\{step.location.name\}/);
});
