import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const chapter = name => read(`src/content/docs/workshop/${name}.mdx`);

test('agent and tool explanations precede their first implementation steps', () => {
  const first = chapter('02-first-coach');
  assert.ok(first.indexOf('<ConceptDiagram kind="agent-run"') < first.indexOf('<CodeStep'));
  assert.match(first, /single-argument.*workshop helper/);
  const tools = chapter('04-tools');
  assert.ok(tools.indexOf('<ConceptDiagram kind="tool-loop"') < tools.indexOf('<CodeStep'));
  assert.match(tools, /The model receives that information, not the C# method body/);
  assert.match(chapter('05-mcp-server').split('<CodeStep')[0], /separation adds a connection/);
});

test('the AG-UI diagram introduces the server boundary and both directions before the edits', () => {
  const source = chapter('03-streaming');
  const figure = '<ConceptDiagram kind="ag-ui" />';
  assert.equal(source.split(figure).length - 1, 1);
  assert.ok(source.indexOf(figure) < source.indexOf('<CodeStep'));
  const diagrams = read('src/components/ConceptDiagram.astro');
  const start = diagrams.indexOf("  'ag-ui': {");
  assert.ok(start >= 0);
  const diagram = diagrams.slice(start, diagrams.indexOf("  'tool-loop': {", start));
  assert.match(diagram, /AG-UI between the servers/);
  assert.match(diagram, /AGUIChatClient/);
  assert.match(diagram, /Blazor connection/);
  assert.match(diagram, /HTTP \/ag-ui/);
  assert.match(diagram, /model client, not AG-UI/);
  for (const [from, to] of [[0, 1], [1, 2], [2, 3]]) {
    assert.ok(diagram.includes(`{ from: ${from}, to: ${to} }`));
    assert.ok(diagram.includes(`{ from: ${to}, to: ${from}, fallback: true }`));
  }
});

test('instruction experiments restore their source-backed baseline before later edits', () => {
  const first = chapter('02-first-coach');
  assert.match(first, /Write your own replacement before opening the example/);
  assert.match(first, /restore the original instruction block/);
  assert.match(first, /<CodeSample stage="03-first-coach"[^>]*AgentDelegateFactory\.cs/);
  const persistence = chapter('07-persistence');
  assert.ok(persistence.indexOf('write one sentence') < persistence.indexOf('<CodeStep'));
  const evaluation = chapter('13-debugging');
  assert.match(evaluation, /four short, fresh conversations/);
  assert.match(evaluation, /A weaker prompt may still pass/);
  assert.match(evaluation, /route not observed/);
  assert.match(evaluation, /restore the rule in its original position/);
  assert.match(evaluation, /<CodeSample stage="07-handoffs"[^>]*If the user wants to stop or finish/);
  assert.doesNotMatch(evaluation, /<CodeStep/);
});

test('the independent example is rendered from the same source that lab validation compiles', () => {
  const page = read('src/content/docs/resources/your-own-agent.mdx');
  const example = read('labs/first-agent.cs');
  const validation = read('scripts/validate-first-agent.mjs');
  assert.match(page, /import firstAgent from '[^']*labs\/first-agent\.cs\?raw'/);
  assert.match(page, /<SourceCode code=\{firstAgent\}/);
  assert.doesNotMatch(page, /<LessonProgress|<CodeStep/);
  assert.match(example, /AgentSession session = await agent\.CreateSessionAsync\(\)/);
  assert.equal([...example.matchAll(/await agent\.RunAsync\(/g)].length, 2);
  assert.match(example, /throw new ArgumentException/);
  assert.match(validation, /copyFileSync\(source, resolve\(folder, 'Program.cs'\)\)/);
  assert.match(validation, /manifest\.packageVersions\[name\]/);
  assert.match(read('scripts/validate-checkpoints.mjs'), /validate-first-agent\.mjs/);
  assert.match(read('astro.config.mjs'), /resources\/your-own-agent/);
});
