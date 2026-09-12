import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { deriveEditLocation } from '../labs/edit-location.mjs';
import { buildEditContract, replayTransition } from '../labs/edits.mjs';
import { makeStage, paths, stageIds } from '../labs/recipes.mjs';
import { readReference, createWorkshopReference } from '../labs/reference.mjs';
import { validateEditContract } from '../src/data/edit-contract.mjs';

function locate(beforeSource, before, after, file = 'Example.cs', afterSource = beforeSource.replace(before, () => after)) {
  return deriveEditLocation({ file, operation: 'replace', beforeSource, afterSource, before, after });
}

const factory = `using Example;
public static class AgentDelegateFactory
{
    private static object CreateProviderAgent(
        IServiceProvider services,
        string instructions)
    {
        return new ChatClientAgent(instructions);
    }

    private static object CreateSingleAgent(IServiceProvider services)
    {
        var prompt = """
            Ignore fake syntax: }
            private static object WrongFunction() { }
            """;
        return CreateProviderAgent(services, prompt);
    }

    private static object CreateHandOffWorkflow(IServiceProvider services)
        => throw new NotSupportedException("Later");
}
`;

test('full source identifies the owning method without relying on a provider conditional', () => {
  assert.deepEqual(locate(factory, 'new ChatClientAgent(instructions)', 'new ChatClientAgent(instructions, tools)'),
    { kind: 'function', name: 'CreateProviderAgent' });
  assert.deepEqual(locate(factory, 'Ignore fake syntax: }', 'Keep fake syntax: {'),
    { kind: 'function', name: 'CreateSingleAgent' });
  assert.deepEqual(locate(factory, 'throw new NotSupportedException("Later")', 'CreateWorkflow(services)'),
    { kind: 'function', name: 'CreateHandOffWorkflow' });
});

test('new and removed local functions point at the containing method learners can find', () => {
  const anchor = '        return CreateProviderAgent(services, prompt);';
  const updated = `        static string GetPracticeGuidance(string category)
            => category switch { "technical" => "Clarify", _ => throw new ArgumentException() };
${anchor}`;
  assert.deepEqual(locate(factory, anchor, updated), { kind: 'function', name: 'CreateSingleAgent' });
  assert.deepEqual(locate(factory.replace(anchor, updated), updated, anchor),
    { kind: 'function', name: 'CreateSingleAgent' });
});

test('a change covering multiple factory methods reports the type instead of the first method', () => {
  const after = factory.replace('new ChatClientAgent(instructions)', 'new ChatClientAgent(instructions, tools)')
    .replace('CreateProviderAgent(services, prompt)', 'CreateProviderAgent(services, prompt, tools)');
  assert.deepEqual(locate(factory, factory, after), { kind: 'type', name: 'AgentDelegateFactory' });
});

test('insertions using closing method and class braces do not misidentify the scope', () => {
  const before = `class Factory
{
    private static object Build()
    {
        var agent = MakeAgent();
    }

}
`;
  const anchor = '    }\n\n}\n';
  const after = '        return agent;\n' + anchor;
  assert.deepEqual(locate(before, anchor, after, 'Factory.cs', before.replace(anchor, '        return Wrap(agent);\n' + anchor)),
    { kind: 'function', name: 'Build' });
});

test('method attributes belong to the following method, not the preceding one', () => {
  const source = `class Tools
{
    public Task Previous() => Done();
    [Description("Get a record.")]
    public async Task<Record> GetRecordAsync(
        [Description("The ID")] Guid id)
    {
        return await Fetch(id);
    }
}
`;
  const description = '    [Description("Get a record.")]';
  assert.deepEqual(locate(source, description, '    [McpServerTool(Name = "get_record")]\n' + description),
    { kind: 'function', name: 'GetRecordAsync' });
});

test('comments, escaped and verbatim strings cannot introduce phantom scopes', () => {
  const source = String.raw`class Factory
{
    // private static void NotAMethod() { }
    public string Real()
    {
        var text = @"a ""quote"" }";
        var escaped = "\" }";
        /* } private static void AlsoWrong() { */
        return text;
    }
}
`;
  assert.deepEqual(locate(source, 'return text;', 'return text + escaped;'), { kind: 'function', name: 'Real' });
});

test('imports and top-level Program/AppHost statements have explicit non-function scopes', () => {
  for (const file of ['Program.cs', 'apphost.cs', 'src/InterviewCoach.AppHost/AppHost.cs']) {
    const source = 'using Example;\n\nvar builder = CreateBuilder();\nbuilder.Build().Run();\n';
    assert.deepEqual(locate(source, 'using Example;', 'using Other;\nusing Example;', file), { kind: 'imports' });
    assert.deepEqual(locate(source, 'builder.Build().Run();', 'builder.AddAgent();\nbuilder.Build().Run();', file),
      { kind: 'top-level' });
  }
  assert.deepEqual(locate(factory, 'using Example;', 'using New.Example;'), { kind: 'imports' });
  assert.deepEqual(locate('// Original\n' + factory, '// Original', '// Updated'), { kind: 'file' });
});

test('file creation, deletion, configuration and Razor routes do not invent methods', () => {
  assert.deepEqual(deriveEditLocation({
    file: 'Factory.cs', operation: 'create', before: '', after: factory, beforeSource: '', afterSource: factory
  }), { kind: 'file' });
  assert.deepEqual(deriveEditLocation({
    file: 'Factory.cs', operation: 'delete', before: factory, after: '', beforeSource: factory, afterSource: ''
  }), { kind: 'file' });
  assert.deepEqual(locate('{"AgentMode":"Single"}', '"Single"', '"HandOff"', 'apphost.settings.json'), { kind: 'file' });
  assert.deepEqual(locate('@page "/chat"\n<h1>Chat</h1>', '@page "/chat"', '@page "/"', 'Chat.razor'), { kind: 'file' });
});

test('ambiguous anchors, malformed source, and impossible operations fail explicitly', () => {
  assert.throws(() => locate(factory, 'missing', 'replacement'), /anchor/);
  assert.throws(() => locate(factory, 'IServiceProvider services', 'object services'), /ambiguous/);
  assert.throws(() => locate(factory, 'using Example;', 'using Example;'), /Invalid location edit/);
  assert.throws(() => locate('class Example { void Method() {', 'Method', 'Renamed'), /Unbalanced/);
  assert.throws(() => locate('class Example { string Value = """not closed; }', 'Value', 'Renamed'), /Unclosed raw string/);
  assert.throws(() => deriveEditLocation({
    file: 'Factory.cs', operation: 'delete', before: 'part', after: '', beforeSource: 'part\nrest', afterSource: ''
  }), /Invalid delete/);
});

test('every real transition carries a reproducible source location without writing generated output', () => {
  const manifest = JSON.parse(readFileSync(new URL('../labs/manifest.json', import.meta.url), 'utf8'));
  const standalone = readReference(fileURLToPath(new URL('../../', import.meta.url)), manifest, { verifyWorktree: false });
  const reference = createWorkshopReference(standalone, manifest.packageVersions);
  const contract = buildEditContract(reference, manifest.sourceRevision);
  validateEditContract(contract);
  let current = makeStage(reference, stageIds[0]);
  const actual = new Map();
  for (const transition of contract.transitions) {
    const target = makeStage(reference, transition.to);
    for (const step of transition.steps) {
      assert.deepEqual(step.location, deriveEditLocation({
        ...step, beforeSource: current.get(step.file)?.toString('utf8') ?? '',
        afterSource: target.get(step.file)?.toString('utf8') ?? ''
      }), step.id);
      actual.set(step.id, step.location);
      current = replayTransition(current, { steps: [step] });
    }
  }
  for (const id of ['coach-single-agent', 'tools-practice-function', 'tools-function-registration',
    'mcp-remove-practice-function', 'documents-discover-tools', 'documents-interview-instructions']) {
    assert.deepEqual(actual.get(id), { kind: 'function', name: 'CreateSingleAgent' }, id);
  }
  for (const id of ['handoff-workflow-tools', 'handoff-two-agent-graph', 'specialists-behavioural-agent', 'specialists-handoff-graph']) {
    assert.deepEqual(actual.get(id), { kind: 'function', name: 'CreateHandOffWorkflow' }, id);
  }
  assert.deepEqual(actual.get('coach-foundry-agent'), { kind: 'function', name: 'CreateProviderAgent' });
  assert.deepEqual(actual.get('mcp-expose-get-interview-session'), { kind: 'function', name: 'GetInterviewSessionAsync' });
  const finalFactory = contract.transitions.at(-1).steps.find(step => step.file === paths.factory);
  assert.deepEqual(finalFactory.location, { kind: 'type', name: 'AgentDelegateFactory' });
});
