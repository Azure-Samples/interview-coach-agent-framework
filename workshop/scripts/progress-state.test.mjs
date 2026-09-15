import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  continueLink, createProgressStore, nextChapterLink, parseProgress, progressKey,
  progressSummary, progressView
} from '../src/scripts/progress-state.mjs';

const course = JSON.parse(readFileSync(new URL('../src/data/course.json', import.meta.url), 'utf8'));
const chapters = course.chapters;
const ids = chapters.map(chapter => chapter.id);
const base = '/interview-coach-agent-framework';
const key = progressKey(base, course.version);

function fixture(initial = {}) {
  const records = new Map(Object.entries(initial));
  const storage = {
    getItem: key => records.get(key) ?? null,
    setItem: (key, value) => records.set(key, value),
    removeItem: key => records.delete(key)
  };
  const store = createProgressStore({ ...course, base }, () => storage);
  return { records, storage, store };
}

test('the UI consumes all fifteen chapters with explicit zero-based numbers and groups', () => {
  assert.equal(course.version, '5');
  assert.deepEqual(course.previousVersions, ['1', '2', '3', '4']);
  assert.equal(chapters.length, 15);
  assert.deepEqual(chapters.map(chapter => chapter.number), Array.from({ length: 15 }, (_, index) => index));
  assert.deepEqual([...new Set(chapters.map(chapter => chapter.group))], [
    'Getting started', 'Tools and interview context', 'Specialist workflows'
  ]);
});

test('fresh landing links to the overview, which starts at chapter zero for either base path', () => {
  for (const base of ['', '/', '/interview-coach-agent-framework', '/interview-coach-agent-framework/']) {
    const prefix = base.replace(/\/$/, '');
    assert.deepEqual(continueLink([], chapters, base), {
      href: `${prefix}/workshop/`, label: 'Start the workshop'
    });
    assert.deepEqual(continueLink([], chapters, base, 'chapter'), {
      href: `${prefix}/workshop/${ids[0]}/`, label: `Start: 0. ${chapters[0].title}`
    });
  }
});

test('continue uses the first incomplete chapter, including gaps before later completions', () => {
  const value = continueLink([ids[0], ids[2], ids[10]], chapters, base);
  assert.equal(value.href, `${base}/workshop/${ids[1]}/`);
  assert.equal(value.label, `Continue: 1. ${chapters[1].title}`);
  assert.equal(continueLink([ids[10]], chapters, base).href, `${base}/workshop/${ids[0]}/`);
});

test('complete progress offers a review link and reset returns the original fresh CTA', () => {
  const { store } = fixture({ [key]: JSON.stringify(ids) });
  const state = store.read();
  assert.equal(progressView(state.ids, chapters).complete, true);
  assert.equal(progressView(state.ids, chapters).next, undefined);
  assert.equal(continueLink(state.ids, chapters, base).href, `${base}/workshop/${ids.at(-1)}/`);
  assert.equal(continueLink(state.ids, chapters, base).label, 'Review the completed workshop');
  const cleared = store.reset();
  assert.equal(continueLink(cleared.ids, chapters, base).label, 'Start the workshop');
  assert.equal(progressView(cleared.ids, chapters).count, 0);
});

test('the next link skips completed chapters and returns to an earlier gap before the overview', () => {
  assert.equal(nextChapterLink([ids[1]], chapters, base, ids[0]).href, `${base}/workshop/${ids[2]}/`);
  assert.equal(nextChapterLink(ids.slice(1), chapters, base, ids.at(-1)).href, `${base}/workshop/${ids[0]}/`);
  assert.equal(nextChapterLink(ids, chapters, base, ids[0]).href, `${base}/workshop/`);
  assert.throws(() => nextChapterLink([], chapters, base, 'unknown'), /Unknown chapter/);
});

test('stored progress is validated and normalized in course order', () => {
  assert.deepEqual(parseProgress(JSON.stringify([ids[2], ids[0], ids[2]]), chapters), {
    ids: [ids[0], ids[2]], warning: '', migrated: false
  });
  for (const raw of ['null', '{}', '2', '["unknown"]', '[7]', `["${ids[0]}", null]`]) {
    const parsed = parseProgress(raw, chapters);
    assert.equal(parsed.ids, null);
    assert.match(parsed.warning, /not valid/);
  }
  for (const raw of ['', '{broken']) assert.match(parseProgress(raw, chapters).warning, /could not be read/);
  assert.deepEqual(parseProgress(null, chapters), { ids: [], warning: '', migrated: false });
});

test('current-version aliases map to chapters rather than checkpoint numbers', () => {
  for (const [previous, current] of Object.entries(course.legacyChapterIds)) {
    assert.deepEqual(parseProgress(JSON.stringify([previous]), chapters, course.legacyChapterIds), {
      ids: [current], warning: '', migrated: true
    });
    assert.equal(parseProgress(JSON.stringify([previous]), chapters).ids, null);
  }
});

test('mixed old and new IDs migrate once, deduplicate, and persist in course order', () => {
  const { store, records, storage } = fixture({
    [key]: JSON.stringify(['08-debugging', '01-starter', '02-starter', '03-first-coach', '00-orientation', '14-debugging'])
  });
  const expected = ['00-orientation', '01-starter', '02-first-coach', '13-debugging'];
  let writes = 0;
  const write = storage.setItem;
  storage.setItem = (key, value) => { writes++; write(key, value); };
  assert.deepEqual(store.read(), { ids: expected, warning: '', saved: true });
  assert.equal(records.get(key), JSON.stringify(expected));
  assert.equal(writes, 1);
  assert.deepEqual(createProgressStore({ ...course, base }, () => storage).read().ids, expected);
  assert.equal(writes, 1);
  assert.equal(continueLink(expected, chapters, base).href, `${base}/workshop/03-streaming/`);
});

test('a completed version-3 course stays saved without completing the new summary', () => {
  const oldIds = [...ids.slice(0, 13), '13-capstone', '14-debugging'];
  for (const base of ['', '/', '/interview-coach-agent-framework', '/interview-coach-agent-framework/']) {
    const key = progressKey(base, course.version);
    const previousKey = progressKey(base, '3');
    const raw = JSON.stringify(oldIds);
    const { storage, records } = fixture({ [previousKey]: raw });
    const store = createProgressStore({ ...course, base }, () => storage);
    assert.deepEqual(store.read().ids, []);
    assert.match(store.read().warning, /earlier progress is still saved/);
    assert.equal(records.has(key), false);
    for (const id of ids.slice(0, -1)) store.toggle(id, true);
    assert.equal(progressView(store.read().ids, chapters).complete, false);
    assert.equal(continueLink(store.read().ids, chapters, base).href, `${base.replace(/\/$/, '')}/workshop/14-summary/`);
    assert.equal(records.get(previousKey), raw);
    store.reset();
    assert.equal(records.has(key), false);
    assert.deepEqual(store.read().ids, []);
    assert.equal(records.get(previousKey), raw);
  }
});

test('version-4 completion remains saved without completing the new learning activities', () => {
  const previousKey = progressKey(base, '4');
  const raw = JSON.stringify(ids);
  const { store, records } = fixture({ [previousKey]: raw });
  assert.deepEqual(store.read().ids, []);
  assert.match(store.read().warning, /earlier progress is still saved/);
  store.toggle('02-first-coach', true);
  assert.deepEqual(store.read().ids, ['02-first-coach']);
  assert.equal(records.get(previousKey), raw);
  store.reset();
  assert.equal(records.get(previousKey), raw);
});

test('migration rejects invalid mixed records and inherited or unknown aliases without overwriting storage', () => {
  for (const values of [
    ['02-starter', 'unknown'], ['02-starter', null], ['02-starter', 7],
    ['01-readiness'], ['08-complete'], ['toString'], ['__proto__']
  ]) {
    const raw = JSON.stringify(values);
    const { store, records } = fixture({ [key]: raw });
    assert.deepEqual(store.read().ids, []);
    assert.match(store.read().warning, /not valid/);
    assert.equal(records.get(key), raw);
    assert.equal(parseProgress(raw, chapters, course.legacyChapterIds).migrated, false);
  }
  assert.equal(parseProgress('["old"]', chapters, { old: 'missing' }).ids, null);
  assert.equal(parseProgress('["old"]', chapters, Object.create({ old: ids[0] })).ids, null);
});

test('a failed migration keeps completion on the page and saves it with the next successful edit', () => {
  const raw = '["02-starter","03-first-coach"]';
  const { store, storage, records } = fixture({ [key]: raw });
  const write = storage.setItem;
  storage.setItem = () => { throw new Error('quota exceeded'); };
  const state = store.read();
  assert.deepEqual(state.ids, ['01-starter', '02-first-coach']);
  assert.equal(state.saved, false);
  assert.match(state.warning, /storage is unavailable/);
  assert.equal(records.get(key), raw);
  assert.deepEqual(store.read().ids, state.ids);
  storage.setItem = write;
  assert.deepEqual(store.toggle('00-orientation', true).ids, ids.slice(0, 3));
  assert.equal(records.get(key), JSON.stringify(ids.slice(0, 3)));
  assert.equal(store.read().saved, true);
});

test('cross-tab old IDs are migrated and earlier curriculum versions are never imported', () => {
  const earlierKey = progressKey(base, '2');
  const earlier = '["02-starter","01-readiness"]';
  const { store, records } = fixture({ [earlierKey]: earlier });
  store.toggle('00-orientation', true);
  records.set(key, '["03-first-coach","02-starter"]');
  assert.deepEqual(store.sync(key).ids, ['01-starter', '02-first-coach']);
  assert.equal(records.get(key), '["01-starter","02-first-coach"]');
  assert.equal(records.get(earlierKey), earlier);
  store.reset();
  assert.deepEqual(store.read().ids, []);
  assert.equal(records.get(earlierKey), earlier);
});

test('toggling and untoggling update the count and persist only known chapter IDs', () => {
  const { store, records } = fixture();
  assert.equal(progressView(store.toggle(ids[2], true).ids, chapters).count, 1);
  assert.deepEqual(store.toggle(ids[0], true).ids, [ids[0], ids[2]]);
  assert.deepEqual(store.toggle(ids[2], false).ids, [ids[0]]);
  assert.equal(records.get(key), JSON.stringify([ids[0]]));
  assert.throws(() => store.toggle('unknown', true), /Unknown chapter/);
});

test('reloading the store retains saved completion', () => {
  const { store, storage } = fixture();
  store.toggle(ids[3], true);
  const reloaded = createProgressStore({ ...course, base }, () => storage);
  assert.deepEqual(reloaded.read().ids, [ids[3]]);
});

test('old versions remain untouched by current marks and resets', () => {
  for (const version of course.previousVersions) {
    const earlierKey = progressKey(base, version);
    const earlierValue = '["old-course-chapter"]';
    const { store, records } = fixture({ [earlierKey]: earlierValue });
    assert.deepEqual(store.read().ids, []);
    assert.match(store.read().warning, /earlier progress is still saved/);
    assert.equal(store.toggle(ids[0], true).warning, '');
    store.reset();
    assert.equal(records.get(earlierKey), earlierValue);
    assert.equal(records.has(key), false);
    assert.match(store.read().warning, /earlier progress/);
  }
});

test('invalid storage has a visible warning and is repaired only by an explicit toggle or reset', () => {
  for (const invalid of ['', '{broken', '["unknown"]']) {
    const { store, records } = fixture({ [key]: invalid });
    assert.equal(store.read().ids.length, 0);
    assert.ok(store.read().warning);
    assert.equal(records.get(key), invalid);
    assert.equal(store.toggle(ids[0], true).warning, '');
    assert.deepEqual(JSON.parse(records.get(key)), [ids[0]]);
    records.set(key, invalid);
    assert.deepEqual(store.read().ids, [ids[0]]);
    assert.equal(store.reset().ids.length, 0);
    assert.equal(records.has(key), false);
  }
});

test('blocked storage preserves page-only toggles and explicitly reports the fallback', () => {
  const store = createProgressStore({ ...course, base }, () => {
    throw new Error('storage denied');
  });
  assert.match(store.read().warning, /storage is unavailable/);
  store.toggle(ids[0], true);
  assert.deepEqual(store.toggle(ids[2], true).ids, [ids[0], ids[2]]);
  assert.equal(store.read().saved, false);
  assert.match(progressSummary(store.read(), chapters), /2 of 15 chapters completed on this page/);
  assert.deepEqual(store.toggle(ids[0], false).ids, [ids[2]]);
  assert.deepEqual(store.reset().ids, []);
  assert.equal(store.read().ids.length, 0);
});

test('a failed write is not overwritten by a successful read of stale storage', () => {
  const { storage, store } = fixture({ [key]: JSON.stringify([ids[0]]) });
  storage.setItem = () => { throw new Error('quota exceeded'); };
  assert.deepEqual(store.toggle(ids[1], true).ids, [ids[0], ids[1]]);
  assert.deepEqual(store.read().ids, [ids[0], ids[1]]);
  assert.deepEqual(store.toggle(ids[0], false).ids, [ids[1]]);
  storage.removeItem = () => { throw new Error('remove denied'); };
  assert.deepEqual(store.reset().ids, []);
  assert.deepEqual(store.read().ids, []);
});

test('a later successful write saves the accumulated page-only marks', () => {
  const { storage, store, records } = fixture();
  const write = storage.setItem;
  storage.setItem = () => { throw new Error('quota exceeded'); };
  store.toggle(ids[0], true);
  storage.setItem = write;
  assert.equal(store.toggle(ids[1], true).saved, true);
  assert.deepEqual(JSON.parse(records.get(key)), [ids[0], ids[1]]);
  assert.equal(store.read().warning, '');
});

test('cross-tab updates, removal and localStorage.clear replace the current view', () => {
  const { store, records } = fixture();
  store.toggle(ids[0], true);
  records.set(key, JSON.stringify([ids[2]]));
  assert.deepEqual(store.sync(key).ids, [ids[2]]);
  records.delete(key);
  assert.deepEqual(store.sync(key).ids, []);
  store.toggle(ids[1], true);
  records.clear();
  assert.deepEqual(store.sync(null).ids, []);
  assert.equal(store.accepts(key), true);
  assert.equal(store.accepts(null), true);
  assert.equal(store.accepts(progressKey(base, '1')), true);
  assert.equal(store.accepts(progressKey('/another-site', '3')), false);
});

test('an external current-version change wins over a page-only edit', () => {
  const { store, storage, records } = fixture();
  storage.setItem = () => { throw new Error('quota exceeded'); };
  store.toggle(ids[0], true);
  records.set(key, JSON.stringify([ids[2]]));
  assert.deepEqual(store.sync(key).ids, [ids[2]]);
  assert.equal(store.read().saved, true);
});
