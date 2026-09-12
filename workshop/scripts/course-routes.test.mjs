import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import { stepReferences, validateCourseContent } from './content-contract.mjs';

const course = JSON.parse(readFileSync(new URL('../src/data/course.json', import.meta.url), 'utf8'));
const manifest = JSON.parse(readFileSync(new URL('../labs/manifest.json', import.meta.url), 'utf8'));
const lessonRoot = new URL('../src/content/docs/workshop/', import.meta.url);
const pages = new Map(readdirSync(lessonRoot)
  .filter(name => name.endsWith('.mdx'))
  .map(name => [name.slice(0, -4), readFileSync(new URL(name, lessonRoot), 'utf8')]));
const ids = [
  '00-orientation', '01-starter', '02-first-coach', '03-streaming', '04-tools',
  '05-mcp-server', '06-mcp-state', '07-persistence', '08-document-extraction',
  '09-documents', '10-first-handoff', '11-interviewers', '12-handoffs',
  '13-capstone', '14-debugging'
];
const oldIds = [
  '00-orientation', '02-starter', '03-first-coach', '03-streaming', '04-tools',
  '05-mcp-server', '05-mcp-state', '05-persistence', '06-document-extraction',
  '06-documents', '07-first-handoff', '07-interviewers', '07-handoffs',
  '08-capstone', '08-debugging'
];
const expectedAliases = Object.fromEntries(oldIds.flatMap((id, index) => id === ids[index] ? [] : [[id, ids[index]]]));

test('public lesson IDs, filenames, titles, and completion controls follow chapters 00 through 14', () => {
  assert.deepEqual(course.chapters.map(chapter => chapter.id), ids);
  assert.deepEqual(course.chapters.map(chapter => chapter.number), ids.map((_, index) => index));
  assert.deepEqual([...pages.keys()].sort(), [...ids, 'index'].sort());
  assert.deepEqual(validateCourseContent(course, manifest, pages), []);
});

test('only public route IDs are renumbered; checkpoint IDs and chapter transitions stay unchanged', () => {
  assert.deepEqual(course.legacyChapterIds, expectedAliases);
  const checkpoints = ['08-complete', ...oldIds.slice(1, -2), '08-complete', '08-complete'];
  assert.deepEqual(course.chapters.map(chapter => chapter.checkpoints), checkpoints.map(id => [id]));
  assert.deepEqual(course.chapters.map(chapter => chapter.from), [undefined, undefined, ...checkpoints.slice(1, -1)]);
  for (const chapter of course.chapters) {
    for (const [, checkpoint] of pages.get(chapter.id).matchAll(/<Checkpoint\b[^>]*\bstage=["']([^"']+)["']/g)) {
      assert.ok(chapter.checkpoints.includes(checkpoint), `${chapter.id}: unexpected checkpoint ${checkpoint}`);
    }
  }
});

test('the actual Astro config redirects every old public URL for both root and Pages hosting', async () => {
  const previousBase = process.env.BASE_PATH;
  try {
    for (const base of ['', '/', '/interview-coach-agent-framework', '/interview-coach-agent-framework/']) {
      process.env.BASE_PATH = base;
      const { default: config } = await import(`../astro.config.mjs?route-test=${encodeURIComponent(base)}`);
      const prefix = base.replace(/\/$/, '');
      assert.equal(config.trailingSlash, 'always');
      assert.deepEqual(config.redirects, {
        ...Object.fromEntries(Object.entries(expectedAliases).map(([previous, current]) => [
          `/workshop/${previous}/`, `${prefix}/workshop/${current}/`
        ])),
        '/workshop/01-readiness/': `${prefix}/workshop/00-orientation/#check-your-tools`
      });
      for (const path of Object.keys(config.redirects)) {
        assert.ok(!ids.some(id => path === `/workshop/${id}/`), `${path} shadows a current chapter`);
      }
    }
  } finally {
    if (previousBase === undefined) delete process.env.BASE_PATH;
    else process.env.BASE_PATH = previousBase;
  }
});

function markdownFiles(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), root);
    return entry.isDirectory() ? markdownFiles(url) : /\.mdx?$/.test(entry.name) ? [url] : [];
  });
}

const authoredPages = [
  ...markdownFiles(lessonRoot),
  ...markdownFiles(new URL('../src/content/docs/resources/', import.meta.url)),
  new URL('../src/content/docs/index.mdx', import.meta.url),
  new URL('../src/content/docs/404.mdx', import.meta.url)
];
const omittedReferenceRoute = /\breference\/(?:changelog|providers(?:\/github-copilot)?)(?:\/(?:index(?:\.html)?)?)?(?=[#?'"`)\s<>}]|$)/i;

test('authored lesson, resource, README, and root-reference links use canonical routes', () => {
  const files = [
    new URL('../../README.md', import.meta.url),
    new URL('../README.md', import.meta.url),
    ...markdownFiles(new URL('../../docs/', import.meta.url)),
    ...authoredPages
  ];
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    for (const [, id] of source.matchAll(/(?:workshop\/|\.\.\/)(\d{2}-[\w-]+)(?=[/#?'"`.)])/g)) {
      assert.ok(ids.includes(id), `${file.pathname}: link uses noncanonical lesson ${id}`);
    }
  }
});

test('omitted reference routes are detected without rejecting the Foundry reference or standalone docs', () => {
  for (const link of [
    '../../reference/changelog/',
    '/reference/changelog/#history',
    "siteLink('reference/providers/')",
    '../../reference/providers/#authentication',
    '../../reference/providers/index.html',
    '../../reference/providers/github-copilot/',
    'https://example.com/workshop-site/reference/providers/github-copilot/?view=all'
  ]) {
    assert.match(link, omittedReferenceRoute);
  }
  for (const link of [
    '../../reference/providers/microsoft-foundry/',
    "siteLink('reference/providers/microsoft-foundry/#authentication')",
    'docs/providers/README.md',
    'docs/providers/GITHUB-COPILOT.md',
    'docs/CHANGELOG.md'
  ]) {
    assert.doesNotMatch(link, omittedReferenceRoute);
  }
});

test('authored workshop pages do not link to omitted imported references', () => {
  for (const file of authoredPages) {
    assert.doesNotMatch(readFileSync(file, 'utf8'), omittedReferenceRoute,
      `${file.pathname}: link targets an omitted reference; use reference/providers/microsoft-foundry/ for provider setup`);
  }
});

test('the example clone and starter download are one-time steps in separate folders', () => {
  const orientation = pages.get('00-orientation');
  const starter = pages.get('01-starter');
  assert.match(orientation, /git clone [^\n]+ interview-coach-example/);
  assert.match(orientation, /[Cc]lone[^.\n]*once/);
  assert.match(orientation, /Chapter 1[^.\n]*download[^.\n]*once[^.\n]*interview-coach-lab/);
  assert.match(starter, /Download `interview-coach-lab-starter\.zip` once/);
  assert.match(starter, /beside `interview-coach-example`, not inside it/);
  assert.match(starter, /same `interview-coach-lab` project[^.\n]*Chapter 14/);
  assert.match(starter, /checkpoint archives[^.\n]*optional[^.\n]*extract them separately/i);
  assert.match(pages.get('02-first-coach'), /What does WorkshopHosting\.cs do/);
  assert.doesNotMatch(pages.get('02-first-coach'), /Copilot/);
});

test('the first-coach lesson replaces the throwing method and retains its five edit IDs', () => {
  const firstCoach = pages.get('02-first-coach');
  assert.match(firstCoach, /Find `CreateProviderAgent` and replace the entire method, including its signature and throwing body/);
  assert.match(firstCoach, /This method calls `CreateProviderAgent`/);
  assert.doesNotMatch(firstCoach, /checking for the Foundry|branch we just wrote/);
  assert.deepEqual(stepReferences(firstCoach), [
    'coach-foundry-agent',
    'coach-single-agent',
    'coach-enable-hosting',
    'coach-enable-devui',
    'coach-model-reference-file-apphost'
  ]);
});
