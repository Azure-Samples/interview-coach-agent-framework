import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { makeStage, replaceOnce } from '../labs/recipes.mjs';
const manifest = JSON.parse(readFileSync(new URL('../labs/manifest.json', import.meta.url), 'utf8'));
const root = new URL('../../', import.meta.url);
const paths = ['src/InterviewCoach.Agent/Program.cs', 'src/InterviewCoach.Agent/AgentDelegateFactory.cs', 'apphost.cs', 'apphost.settings.json', 'src/InterviewCoach.AppHost/AppHost.cs', 'src/InterviewCoach.AppHost/appsettings.json', 'src/InterviewCoach.WebUI/Components/Pages/Chat/Chat.razor', 'src/InterviewCoach.Mcp.InterviewData/InterviewSessionTool.cs'];
const reference = new Map(paths.map(path => [path, execFileSync('git', ['show', `${manifest.sourceRevision}:${path}`], { cwd: root })]));
test('anchors reject missing or ambiguous source', () => {
  assert.throws(() => replaceOnce('one one', 'one', 'two'));
  assert.throws(() => replaceOnce('one', 'missing', 'two'));
});
test('starter neither connects Foundry nor exposes the completed chat', () => {
  const stage = makeStage(reference, '02-starter');
  assert.doesNotMatch(stage.get('apphost.cs').toString(), /\.WithLlmReference|var cosmos|var mcpMarkItDown/);
  assert.match(stage.get(paths[6]).toString(), /Coaching is not connected/);
});
test('capstone preserves all reference bytes', () => {
  for (const id of ['07-handoffs', '08-complete']) {
    const stage = makeStage(reference, id);
    for (const [path, contents] of reference) assert.deepEqual(stage.get(path), contents);
  }
});
test('tool and MCP stages introduce only their intended services', () => {
  const tools = makeStage(reference, '04-tools');
  assert.match(tools.get(paths[1]).toString(), /Name = "get_practice_guidance"/);
  assert.doesNotMatch(tools.get(paths[0]).toString(), /AddKeyedSingleton<McpClient>/);
  const data = makeStage(reference, '05-mcp-state');
  assert.doesNotMatch(data.get(paths[0]).toString(), /AddHttpClient\("mcp-markitdown"/);
  assert.match(data.get(paths[0]).toString(), /AddHttpClient\("mcp-interview-data"/);
});
