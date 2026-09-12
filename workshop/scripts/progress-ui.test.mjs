import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import * as progressState from '../src/scripts/progress-state.mjs';

const course = JSON.parse(readFileSync(new URL('../src/data/course.json', import.meta.url), 'utf8'));
const script = ts.transpileModule(
  readFileSync(new URL('../src/scripts/progress.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
).outputText;
const base = '/interview-coach-agent-framework';
const key = progressState.progressKey(base, course.version);
const ids = course.chapters.map(chapter => chapter.id);
const courseExports = {
  chapters: course.chapters,
  previousCurriculumVersions: course.previousVersions,
  legacyChapterIds: course.legacyChapterIds
};

// Only the owned data-attribute contract is modeled; no Starlight DOM structure is assumed.
class Element extends EventTarget {
  constructor(dataset = {}, children = []) {
    super();
    this.dataset = { ...dataset };
    this.children = children;
    this.attributes = {};
    this.textContent = '';
    this.href = '';
    this.checked = false;
  }
  querySelectorAll(selector) {
    const key = selector.slice(6, -1).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    return this.children.flatMap(child => [
      ...(key in child.dataset ? [child] : []),
      ...child.querySelectorAll(selector)
    ]);
  }
  setAttribute(name, value) { this.attributes[name] = value; }
}

function root(children) {
  return new Element({ progressRoot: '', base, version: course.version }, children);
}

function fixture() {
  const records = new Map();
  const storage = {
    getItem: key => records.get(key) ?? null,
    setItem: (key, value) => records.set(key, value),
    removeItem: key => records.delete(key)
  };
  const marks = () => course.chapters.map(chapter => new Element({
    progressId: chapter.id, progressLabel: `Chapter ${chapter.number}: ${chapter.title}`
  }));
  const sidebar = marks();
  const path = marks();
  const toggle = new Element({ progressToggle: ids[0] });
  const reset = new Element({ progressReset: '' });
  const next = new Element({ progressNext: ids[0] });
  const landing = new Element({ continue: '', startAt: 'overview' });
  const overview = new Element({ continue: '', startAt: 'chapter' });
  const summaries = Array.from({ length: 3 }, () => new Element({ progressSummary: '' }));
  const document = new Element({}, [
    root([...sidebar, summaries[0]]),
    root([...path, landing, overview, summaries[1]]),
    root([toggle, reset, next, summaries[2]])
  ]);
  const window = new EventTarget();
  window.localStorage = storage;
  window.confirm = () => true;
  const exports = {};
  vm.runInNewContext(script, {
    exports, document, window,
    require: name => {
      if (name === '../data/course') return courseExports;
      if (name === './progress-state.mjs') return progressState;
      throw new Error(`Unexpected import ${name}`);
    }
  });
  const connect = exports.connectProgress;
  const storageChange = (changedKey = key, area = storage) => {
    const event = new Event('storage');
    Object.assign(event, { key: changedKey, storageArea: area });
    window.dispatchEvent(event);
  };
  return { records, storage, sidebar, path, toggle, reset, next, landing, overview, summaries, document, window, connect, storageChange };
}

test('completion, continue links, next link, and counts update together without reload', () => {
  const ui = fixture();
  ui.connect();
  assert.equal(ui.landing.textContent, 'Start the workshop');
  assert.equal(ui.landing.href, `${base}/workshop/`);
  assert.equal(ui.overview.href, `${base}/workshop/${ids[0]}/`);
  ui.toggle.checked = true;
  ui.toggle.dispatchEvent(new Event('change'));
  for (const marks of [ui.sidebar, ui.path]) {
    assert.equal(marks[0].dataset.completed, 'true');
    assert.match(marks[0].attributes['aria-label'], /, completed$/);
    assert.equal(marks[1].dataset.completed, 'false');
  }
  for (const summary of ui.summaries) assert.match(summary.textContent, /^1 of 15 chapters completed/);
  assert.equal(ui.landing.href, `${base}/workshop/${ids[1]}/`);
  assert.equal(ui.overview.href, ui.landing.href);
  ui.toggle.checked = false;
  ui.toggle.dispatchEvent(new Event('change'));
  assert.equal(ui.sidebar[0].dataset.completed, 'false');
  assert.match(ui.path[0].attributes['aria-label'], /, not completed$/);
  assert.equal(ui.landing.textContent, 'Start the workshop');
  for (const summary of ui.summaries) assert.match(summary.textContent, /^0 of 15/);
});

test('storage events update every mark, checkbox, count and next action', () => {
  const ui = fixture();
  ui.connect();
  ui.records.set(key, JSON.stringify([ids[0], ids[1]]));
  ui.storageChange();
  assert.equal(ui.toggle.checked, true);
  assert.equal(ui.sidebar[1].dataset.completed, 'true');
  assert.equal(ui.path[1].dataset.completed, 'true');
  assert.equal(ui.next.href, `${base}/workshop/${ids[2]}/`);
  assert.equal(ui.landing.href, ui.next.href);
  for (const summary of ui.summaries) assert.match(summary.textContent, /^2 of 15/);
  ui.records.clear();
  ui.storageChange(null);
  assert.equal(ui.toggle.checked, false);
  assert.equal(ui.sidebar[0].dataset.completed, 'false');
  assert.equal(ui.path[1].dataset.completed, 'false');
  assert.equal(ui.landing.textContent, 'Start the workshop');
});

test('version-3 migration updates every navigation surface on load and after an old-tab write', () => {
  const ui = fixture();
  ui.records.set(key, '["02-starter","03-first-coach","00-orientation"]');
  ui.connect();
  assert.equal(ui.records.get(key), '["00-orientation","01-starter","02-first-coach"]');
  assert.equal(ui.toggle.checked, true);
  for (const marks of [ui.sidebar, ui.path]) {
    for (const item of marks.slice(0, 3)) assert.equal(item.dataset.completed, 'true');
    assert.equal(marks[3].dataset.completed, 'false');
  }
  for (const summary of ui.summaries) assert.match(summary.textContent, /^3 of 15 chapters completed in this browser\.$/);
  assert.equal(ui.landing.href, `${base}/workshop/03-streaming/`);
  assert.equal(ui.overview.href, ui.landing.href);
  assert.equal(ui.next.href, ui.landing.href);
  ui.records.set(key, '["00-orientation","02-starter"]');
  ui.storageChange();
  assert.equal(ui.records.get(key), '["00-orientation","01-starter"]');
  assert.equal(ui.sidebar[2].dataset.completed, 'false');
  assert.equal(ui.path[2].dataset.completed, 'false');
  assert.equal(ui.next.href, `${base}/workshop/02-first-coach/`);
  assert.equal(ui.landing.href, ui.next.href);
});

test('a failed migration shows the preserved marks and a visible page-only warning', () => {
  const ui = fixture();
  ui.records.set(key, '["02-starter","00-orientation"]');
  ui.storage.setItem = () => { throw new Error('quota exceeded'); };
  ui.connect();
  assert.equal(ui.records.get(key), '["02-starter","00-orientation"]');
  assert.equal(ui.toggle.checked, true);
  assert.equal(ui.sidebar[1].dataset.completed, 'true');
  assert.equal(ui.landing.href, `${base}/workshop/02-first-coach/`);
  for (const summary of ui.summaries) assert.match(summary.textContent, /^2 of 15.*on this page.*unavailable/);
});

test('reset is confirmed once even after repeated connection and leaves earlier versions alone', () => {
  const ui = fixture();
  const earlierKey = progressState.progressKey(base, '2');
  ui.records.set(earlierKey, '["old-chapter"]');
  ui.records.set(key, JSON.stringify(ids));
  ui.connect();
  ui.connect();
  ui.document.dispatchEvent(new Event('astro:page-load'));
  let confirmations = 0;
  ui.window.confirm = () => { confirmations++; return false; };
  ui.reset.dispatchEvent(new Event('click'));
  assert.equal(confirmations, 1);
  assert.equal(ui.toggle.checked, true);
  ui.window.confirm = () => { confirmations++; return true; };
  ui.reset.dispatchEvent(new Event('click'));
  assert.equal(confirmations, 2);
  assert.equal(ui.records.has(key), false);
  assert.equal(ui.records.get(earlierKey), '["old-chapter"]');
  assert.equal(ui.toggle.checked, false);
  assert.ok(ui.sidebar.every(item => item.dataset.completed === 'false'));
  assert.ok(ui.path.every(item => item.dataset.completed === 'false'));
  assert.equal(ui.landing.textContent, 'Start the workshop');
  for (const summary of ui.summaries) assert.match(summary.textContent, /^0 of 15.*Progress reset/);
});

test('navigation connects new controls and browser history refreshes stored state', () => {
  const ui = fixture();
  ui.connect();
  const anotherToggle = new Element({ progressToggle: ids[2] });
  ui.document.children.push(root([anotherToggle]));
  ui.document.dispatchEvent(new Event('astro:page-load'));
  anotherToggle.checked = true;
  anotherToggle.dispatchEvent(new Event('change'));
  assert.equal(ui.sidebar[2].dataset.completed, 'true');
  ui.records.set(key, JSON.stringify([ids[0]]));
  ui.window.dispatchEvent(new Event('pageshow'));
  assert.equal(anotherToggle.checked, false);
  assert.equal(ui.toggle.checked, true);
  assert.equal(ui.path[2].dataset.completed, 'false');
});

test('storage failures show page-only counts while keeping all navigation surfaces usable', () => {
  const ui = fixture();
  Object.defineProperty(ui.window, 'localStorage', { get() { throw new Error('blocked'); } });
  ui.connect();
  ui.toggle.checked = true;
  ui.toggle.dispatchEvent(new Event('change'));
  assert.equal(ui.sidebar[0].dataset.completed, 'true');
  assert.equal(ui.path[0].dataset.completed, 'true');
  assert.equal(ui.landing.href, `${base}/workshop/${ids[1]}/`);
  for (const summary of ui.summaries) assert.match(summary.textContent, /^1 of 15.*on this page.*unavailable/);
});

test('unrelated localStorage keys and sessionStorage changes do not redraw progress', () => {
  const ui = fixture();
  ui.connect();
  ui.records.set(key, JSON.stringify([ids[0]]));
  ui.storageChange('another-key');
  assert.equal(ui.toggle.checked, false);
  ui.storageChange(key, {});
  assert.equal(ui.toggle.checked, false);
  ui.storageChange();
  assert.equal(ui.toggle.checked, true);
});

test('importing and connecting during SSR accesses no browser globals', () => {
  const exports = {};
  vm.runInNewContext(script, {
    exports,
    require: name => name === '../data/course'
      ? courseExports
      : progressState
  });
  assert.doesNotThrow(() => exports.connectProgress());
});
