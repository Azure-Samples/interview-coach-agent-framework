import test from 'node:test';
import assert from 'node:assert/strict';
import { stepReferences, validateCourseContent, validateEditCoverage, validateLegacyRedirects } from './content-contract.mjs';

const course = {
  chapters: [
    { id: 'starter', title: 'Run the starter', kind: 'setup', checkpoints: ['starter'] },
    { id: 'agent', title: 'Create an agent', kind: 'build', from: 'starter', checkpoints: ['agent'] }
  ],
  support: ['setup']
};
const manifest = { stages: [{ id: 'starter' }, { id: 'agent' }] };
const pages = () => new Map([
  ['starter', '---\ntitle: Run the starter\n---\n<LessonProgress lessonId="starter" />'],
  ['agent', '---\ntitle: Create an agent\n---\n## Connect the model client\nExplain the call here.\n<CodeStep id="agent-create" />\n```sh\ndotnet build\n```\n<LessonProgress lessonId="agent" />'],
  ['setup', '---\ntitle: Install the required tools\n---\nInstall the tools before running the example.']
]);
const steps = [{ id: 'agent-create', from: 'starter', to: 'agent', path: 'src/Agent.cs' }];

test('natural headings and curriculum-driven chapter counts are accepted', () => {
  assert.deepEqual(validateCourseContent(course, manifest, pages()), []);
  assert.deepEqual(validateEditCoverage(course, pages(), steps), []);
});

test('literal teaching-rubric headings are not the lesson contract', () => {
  const source = pages();
  source.set('agent', source.get('agent').replace('## Connect the model client', '## How and where'));
  assert.ok(validateCourseContent(course, manifest, source).some(error => error.includes('teaching-rubric')));
});

test('a build lesson must include code edits and a runnable command', () => {
  const source = pages();
  source.set('agent', '---\ntitle: Create an agent\n---\nRead this explanation.\n<LessonProgress lessonId="agent" />');
  const errors = validateCourseContent(course, manifest, source);
  assert.ok(errors.some(error => error.includes('source-backed code steps')));
  assert.ok(errors.some(error => error.includes('runnable')));
});

test('unknown milestones and broken chapter continuity fail explicitly', () => {
  const changed = structuredClone(course);
  changed.chapters[1].from = 'missing';
  changed.chapters[1].checkpoints = ['missing'];
  const errors = validateCourseContent(changed, manifest, pages());
  assert.ok(errors.some(error => error.includes('unknown checkpoint')));
  assert.ok(errors.some(error => error.includes('starting checkpoint')));
  assert.ok(errors.some(error => error.includes('previous chapter')));
});

test('every required edit is taught once in the chapter that produces it', () => {
  assert.ok(validateEditCoverage(course, pages(), [...steps, { id: 'agent-import', to: 'agent', path: 'src/Agent.cs' }])
    .some(error => error.includes('missing learner edit "agent-import"')));
  const source = pages();
  source.set('agent', source.get('agent') + '\n<CodeStep id="agent-create" />\n<CodeStep id="unknown" />');
  const errors = validateEditCoverage(course, source, steps);
  assert.ok(errors.some(error => error.includes('repeated')));
  assert.ok(errors.some(error => error.includes('unknown edit step')));
});

test('code-step references support formatted MDX and either quote style', () => {
  assert.deepEqual(stepReferences('<CodeStep\n id="first"\n/>\n<CodeStep id=\'second\' />'), ['first', 'second']);
});

test('displayed edits must follow the order that was replayed', () => {
  const source = pages();
  source.set('agent', source.get('agent').replace('<CodeStep id="agent-create" />',
    '<CodeStep id="agent-register" />\n<CodeStep id="agent-create" />'));
  const errors = validateEditCoverage(course, source, [
    ...steps,
    { id: 'agent-register', from: 'starter', to: 'agent', path: 'src/Program.cs' }
  ]);
  assert.ok(errors.some(error => error.includes('replay order')));
});

test('support pages cannot mark a lesson complete', () => {
  const source = pages();
  source.set('setup', '<LessonProgress lessonId="agent" />');
  assert.ok(validateCourseContent(course, manifest, source).some(error => error.includes('support pages')));
});

test('supplied transitions expand into every required edit and cannot hide learner edits', () => {
  const source = pages();
  source.set('agent', source.get('agent').replace('<CodeStep id="agent-create" />', '<SuppliedSteps transition="agent" />'));
  const supplied = steps.map(step => ({ ...step, ownership: 'supplied' }));
  assert.deepEqual(validateCourseContent(course, manifest, source), []);
  assert.deepEqual(validateEditCoverage(course, source, supplied), []);
  assert.ok(validateEditCoverage(course, source, steps).some(error => error.includes('learner-owned')));
  source.set('agent', source.get('agent').replace('transition="agent"', 'transition="missing"'));
  assert.ok(validateEditCoverage(course, source, supplied).some(error => error.includes('unknown edit')));
});

test('completion-only lessons can reuse a checkpoint while code edits have one owner', () => {
  const revised = structuredClone(course);
  revised.chapters.push({ id: 'check', title: 'Try a failure', kind: 'verification', from: 'agent', checkpoints: ['agent'] });
  const source = pages();
  source.set('check', '---\ntitle: Try a failure\n---\n<LessonProgress lessonId="check" />');
  assert.deepEqual(validateCourseContent(revised, manifest, source), []);
  assert.deepEqual(validateEditCoverage(revised, source, steps), []);
  source.set('check', source.get('check') + '\n<CodeStep id="agent-create" />');
  assert.ok(validateEditCoverage(revised, source, steps).some(error => error.includes('already taught')));
});

test('display numbers begin at Chapter 0 and every numbered lesson has a group', () => {
  const numbered = structuredClone(course);
  numbered.chapters.forEach((chapter, index) => { chapter.number = index; chapter.group = 'Getting started'; });
  assert.deepEqual(validateCourseContent(numbered, manifest, pages()), []);
  numbered.chapters[0].number = 1;
  numbered.chapters[1].group = '';
  const errors = validateCourseContent(numbered, manifest, pages());
  assert.ok(errors.some(error => error.includes('start at zero')));
  assert.ok(errors.some(error => error.includes('navigation group')));
});

test('legacy chapter IDs point directly to current chapters without shadowing them', () => {
  const revised = { ...course, legacyChapterIds: { 'old-agent': 'agent' } };
  assert.deepEqual(validateCourseContent(revised, manifest, pages()), []);
  revised.legacyChapterIds = { agent: 'starter', 'old-agent': 'missing' };
  const errors = validateCourseContent(revised, manifest, pages());
  assert.ok(errors.some(error => error.includes('shadow a current chapter')));
  assert.ok(errors.some(error => error.includes('not a current chapter')));
});

test('legacy static redirects preserve root and Pages bases, including the readiness anchor', () => {
  const course = { legacyChapterIds: { '02-starter': '01-starter' } };
  for (const base of ['', '/', '/interview-coach-agent-framework', '/interview-coach-agent-framework/']) {
    const prefix = base.replace(/\/$/, '');
    const pages = new Map([
      ['02-starter', `<meta http-equiv="refresh" content="0;url=${prefix}/workshop/01-starter/">`],
      ['01-readiness', `<meta content='0;url=${prefix}/workshop/00-orientation/#check-your-tools' http-equiv='refresh'>`]
    ]);
    assert.deepEqual(validateLegacyRedirects(course, base, pages), []);
    pages.delete('02-starter');
    assert.match(validateLegacyRedirects(course, base, pages)[0], /Missing static redirect.*02-starter/);
    pages.set('02-starter', `<script>location.href='${prefix}/workshop/01-starter/'</script>`);
    assert.match(validateLegacyRedirects(course, base, pages)[0], /without requiring JavaScript/);
    pages.set('02-starter', `<meta http-equiv="refresh" content="0;url=/wrong/"><a href="${prefix}/workshop/01-starter/">Continue</a>`);
    assert.match(validateLegacyRedirects(course, base, pages)[0], /must lead to/);
    pages.set('02-starter', `<meta http-equiv="refresh" content="0;url=${prefix}/workshop/01-starter/">`);
    pages.set('01-readiness', `<meta http-equiv="refresh" content="0;url=${prefix}/workshop/00-orientation/">`);
    assert.match(validateLegacyRedirects(course, base, pages)[0], /#check-your-tools/);
  }
});
