import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

test('handoff conversations use WebUI and its session IDs rather than the DevUI graph', () => {
  for (const chapter of ['10-first-handoff', '11-interviewers', '12-handoffs', '13-debugging']) {
    const source = readFileSync(new URL(`../src/content/docs/workshop/${chapter}.mdx`, import.meta.url), 'utf8');
    assert.match(source, /(?:open (?:the \*\*http\*\* endpoint for )?`webui`|Find the `webui` row and open its link)/i, chapter);
    assert.match(source, /\*\*New chat\*\*/, chapter);
    if (chapter === '10-first-handoff') {
      assert.match(source, /Started new chat session with SessionId/, chapter);
    } else {
      assert.match(source, /copy the \*\*Session ID\*\* shown above the conversation/i, chapter);
    }
    assert.match(source, /`mcp-interview-data` logs/, chapter);
    assert.doesNotMatch(source, /Use session ID [0-9a-f-]{36}/i, chapter);
    assert.doesNotMatch(source, /(?:fresh .*conversation in DevUI|In the run details|Inspect the transfer events)/, chapter);
  }
});

test('Chapter 11 teaches the UI display and later lessons use it without assuming a saved record', () => {
  const read = chapter => readFileSync(new URL(`../src/content/docs/workshop/${chapter}.mdx`, import.meta.url), 'utf8');
  const chapter = read('11-interviewers');
  assert.equal(stepReferences(chapter).filter(id => id === 'interviewers-session-id').length, 1);
  assert.ok(chapter.indexOf('<CodeStep id="interviewers-session-id" />') > chapter.indexOf('<CodeStep id="specialists-interviewer-graph" />'));
  assert.ok(chapter.indexOf('<CodeStep id="interviewers-session-id" />') < chapter.indexOf('dotnet build'));
  assert.match(chapter, /src\/InterviewCoach.WebUI\/Components\/Pages\/Chat\/Chat.razor/);
  assert.match(chapter, /`@sessionId` displays the existing value/);
  assert.match(chapter, /before you send a message/);
  assert.match(chapter, /displayed ID changes/);
  assert.match(chapter, /session ID stays the same as you move between interviewers/);
  assert.match(chapter, /before a record is saved/);
  for (const id of ['11-interviewers', '12-handoffs', '13-debugging']) {
    const source = read(id);
    assert.match(source, /copy the \*\*Session ID\*\* shown above the conversation/i, id);
    assert.doesNotMatch(source, /Started new chat session with SessionId/, id);
    assert.match(source, /Cosmos Data Explorer/, id);
  }
  assert.doesNotMatch(read('10-first-handoff'), /interviewers-session-id|Copy the \*\*Session ID\*\* shown/);
});

test('the first handoff explains the observed dashboard filters and saved-record check', () => {
  const page = readFileSync(new URL('../src/content/docs/workshop/10-first-handoff.mdx', import.meta.url), 'utf8');
  const check = page.slice(page.indexOf('## Watch intake change hands'));
  for (const label of [
    'Resources', 'URLs', 'Structured', 'Structured logs', 'Resource', 'Level', '(All)',
    'Message filter', 'Timestamp', 'Log entry details', 'Log entry', 'Data Explorer', 'Explorer',
    'Items', 'Apply Filter',
  ]) {
    assert.ok(check.includes(`**${label}**`), label);
  }
  const tools = readFileSync(new URL('../../src/InterviewCoach.Mcp.InterviewData/InterviewSessionTool.cs', import.meta.url), 'utf8');
  for (const message of [
    'Interview session with ID', 'Added interview session', 'Retrieved interview session', 'Updated interview session',
  ]) {
    assert.ok(tools.includes(message), message);
    assert.ok(check.includes(`\`${message}\``), message);
  }
  assert.match(check, /```sql\nWHERE c\.id = 'YOUR_SESSION_ID'\n```/);
  for (const field of ['id', 'ResumeText', 'JobDescriptionText', 'IsCompleted']) {
    assert.ok(check.includes(`| \`${field}\` |`), field);
  }
  assert.doesNotMatch(check, /localhost:\d+|\b[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\b/i);
});

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

test('debugging follows the summary agent directly without another capstone exercise', () => {
  const curriculum = JSON.parse(readFileSync(new URL('../src/data/course.json', import.meta.url), 'utf8'));
  const chapter = curriculum.chapters.find(item => item.id === '13-debugging');
  assert.equal(chapter.number, 13);
  assert.equal(chapter.kind, 'verification');
  assert.equal(chapter.from, '07-handoffs');
  assert.deepEqual(chapter.checkpoints, ['08-complete']);
  const source = readFileSync(new URL('../src/content/docs/workshop/13-debugging.mdx', import.meta.url), 'utf8');
  assert.deepEqual(stepReferences(source), []);
  assert.doesNotMatch(source, /SuppliedSteps|git apply|support.patch|hosting setup/i);
  assert.match(source, /from Chapter 12/);
  assert.match(source, /Keep `WorkshopHosting.cs`, the MCP discovery probe, and the session ID display unchanged/);
  assert.match(source, /https:\/\/example\.invalid\/workshop-resume\.pdf/);
  assert.match(source, /behavioural_interviewer` to `triage`, then `triage` to `summariser`/);
  assert.match(source, /`IsCompleted` is `true`/);
  assert.match(source, /aspire stop --apphost \.\/apphost.cs[\s\S]*dotnet build InterviewCoach.slnx[\s\S]*aspire start/);
  assert.match(source, /Stopping Aspire leaves cloud resources in place/);
});

test('the final summary connects concepts to implementation without adding another run exercise', () => {
  const curriculum = JSON.parse(readFileSync(new URL('../src/data/course.json', import.meta.url), 'utf8'));
  const chapter = curriculum.chapters.at(-1);
  assert.equal(chapter.id, '14-summary');
  assert.equal(chapter.number, 14);
  assert.equal(chapter.kind, 'summary');
  assert.equal(chapter.from, '08-complete');
  assert.deepEqual(chapter.checkpoints, ['08-complete']);
  const source = readFileSync(new URL('../src/content/docs/workshop/14-summary.mdx', import.meta.url), 'utf8');
  assert.deepEqual(stepReferences(source), []);
  assert.doesNotMatch(source, /```(?:bash|powershell)|aspire start|dotnet build|<Checkpoint/);
  for (const concept of [
    'ChatClientAgent', 'IChatClient', 'WorkshopHosting.cs', 'apphost.cs', 'WithReference', 'WaitFor',
    'AGUIChatClient', 'ChatOptions.ConversationId', 'AIFunctionFactory.Create', 'McpServerTool',
    'ListToolsAsync', 'MarkItDown', 'ResumeText', 'Transcript', 'complete_interview_session',
    'AgentWorkflowBuilder', 'CreateFixedAgent', 'Cosmos Data Explorer',
  ]) assert.ok(source.includes(concept), concept);
  for (const role of ['triage', 'receptionist', 'behavioural_interviewer', 'technical_interviewer', 'summariser']) {
    assert.ok(source.includes(`| \`${role}\` |`), role);
  }
  assert.match(source, /does not replace the message history/);
  assert.match(source, /More agents do not automatically improve/);
  assert.match(source, /Retrying without checking can repeat a write/);
  assert.match(source, /Chapter 13\]\(\.\.\/13-debugging\/\)/);
  const progress = readFileSync(new URL('../src/components/LessonProgress.astro', import.meta.url), 'utf8');
  assert.match(progress, /chapter.kind === 'summary'/);
  assert.match(progress, /I reviewed the concepts and their implementation/);
});

test('only the optional deployment guide asks learners to prepare the project-based AppHost', () => {
  const source = readFileSync(new URL('../src/content/docs/resources/deployment.mdx', import.meta.url), 'utf8');
  const labs = JSON.parse(readFileSync(new URL('../labs/manifest.json', import.meta.url), 'utf8'));
  assert.match(source, /only if you choose to deploy/);
  assert.equal(source.split(`git apply --check ./${labs.deploymentPatch}`).length - 1, 2);
  assert.equal(source.split(`git apply ./${labs.deploymentPatch}`).length - 1, 2);
  assert.match(source, /keeps your agents and `WorkshopHosting.cs` unchanged/);
  assert.doesNotMatch(source, /08-complete-support.patch|capstone.*required/i);
  const extensions = readFileSync(new URL('../src/content/docs/resources/extensions.mdx', import.meta.url), 'utf8');
  assert.match(extensions, /check its saved result before trying an extension/);
  assert.doesNotMatch(extensions, /hosting patch|support.patch/i);
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

test('summary lessons preserve stage continuity without requiring executable steps', () => {
  const revised = structuredClone(course);
  revised.chapters.push({ id: 'summary', title: 'Review the concepts', kind: 'summary', from: 'agent', checkpoints: ['agent'] });
  const source = pages();
  source.set('summary', '---\ntitle: Review the concepts\n---\n<LessonProgress lessonId="summary" />');
  assert.deepEqual(validateCourseContent(revised, manifest, source), []);
  assert.deepEqual(validateEditCoverage(revised, source, steps), []);
  revised.chapters.at(-1).from = 'starter';
  assert.ok(validateCourseContent(revised, manifest, source).some(error => error.includes('previous chapter')));
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
