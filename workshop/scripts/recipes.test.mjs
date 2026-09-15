import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { anchors, deploymentPaths, makeDeploymentProject, makeStage, paths, replaceOnce, sessionIdDisplay, sourceSlice, stageIds } from '../labs/recipes.mjs';
import { assertSameFiles, buildEditContract, replayTransition } from '../labs/edits.mjs';
import { readReference, createWorkshopReference } from '../labs/reference.mjs';

const manifest = JSON.parse(readFileSync(new URL('../labs/manifest.json', import.meta.url), 'utf8'));
const root = new URL('../../', import.meta.url);
const standaloneReference = readReference(fileURLToPath(root), manifest, { verifyWorktree: false });
const reference = createWorkshopReference(standaloneReference, manifest.packageVersions);
const get = (files, path) => files.get(path).toString('utf8');
const contract = buildEditContract(reference, manifest.sourceRevision);

test('the release reader rejects overrides and mismatched source tags', () => {
  assert.throws(() => readReference(fileURLToPath(root), { ...manifest, sourceOverrides: [] }), /Source overrides/);
  assert.throws(() => readReference(fileURLToPath(root), { ...manifest, sourceRevision: '0'.repeat(40) }), /source tag.*revision disagree/);
});

test('the workshop derives only the selected backend without changing the standalone sample', () => {
  const original = standaloneReference.get(paths.factory).toString('utf8');
  assert.match(original, /CreateCopilotRunAgent/);
  assert.match(standaloneReference.get('Directory.Packages.props').toString('utf8'), /GitHub\.Copilot/);
  const changed = [...standaloneReference.keys()].filter(path =>
    !reference.has(path) || !standaloneReference.get(path).equals(reference.get(path)));
  const allowedChanges = new Set([
    paths.factory, paths.program, paths.chat, ...paths.settings, 'src/InterviewCoach.Agent/Constants.cs',
    'src/InterviewCoach.Agent/InterviewCoach.Agent.csproj', 'src/InterviewCoach.AppHost.Core/LlmProvider.cs',
    'src/InterviewCoach.AppHost.Core/LlmResourceFactory.cs', 'Directory.Build.props', 'Directory.Packages.props', 'InterviewCoach.slnx', 'aspire.config.json',
  ]);
  assert.ok(changed.every(path => path.startsWith('tests/') || allowedChanges.has(path)), changed.join('\n'));
  assert.equal(standaloneReference.get(paths.factory).toString('utf8'), original);
  assert.ok([...reference.keys()].every(path => !path.startsWith('tests/')));
  for (const id of stageIds) {
    for (const [path, contents] of makeStage(reference, id)) {
      if (/\.(cs|csproj|props|json|slnx)$/.test(path))
        assert.doesNotMatch(contents.toString('utf8'), /copilot/i, `${id}: ${path}`);
    }
  }
});

test('every learner stage requires resource reuse and has its own file-based secrets identity', () => {
  assert.match(get(standaloneReference, 'Directory.Build.props'), /<UserSecretsId>/);
  for (const id of stageIds) {
    const stage = makeStage(reference, id);
    assert.doesNotMatch(get(stage, 'Directory.Build.props'), /<UserSecretsId>/, id);
    assert.equal(JSON.parse(get(stage, 'aspire.config.json')).appHost.path, 'apphost.cs', id);
    for (const path of paths.settings) {
      const settings = JSON.parse(get(stage, path));
      assert.equal(settings.MicrosoftFoundry.UseExisting, true, `${id}: ${path}`);
      assert.equal(settings.Azure.AllowResourceGroupCreation, false, `${id}: ${path}`);
      assert.equal(settings.MicrosoftFoundry.Existing, undefined, `${id}: no account identifiers in downloads`);
    }
    const helper = get(stage, 'src/InterviewCoach.AppHost.Core/LlmResourceFactory.cs');
    assert.match(helper, /AddExistingMicrosoftFoundryResource/);
    assert.match(helper, /CognitiveServicesAccountDeployment.FromExisting/);
    assert.match(helper, /GetExistingFoundryConfiguration/);
  }
});

test('unknown provider remnants and incomplete package pins stop packaging', () => {
  const drifted = new Map(standaloneReference);
  drifted.set('src/Unexpected.cs', Buffer.from('using GitHub.Copilot;'));
  assert.throws(() => createWorkshopReference(drifted, manifest.packageVersions), /out-of-scope provider/i);
  assert.throws(() => createWorkshopReference(standaloneReference, {}), /Missing package version/);
});

test('source anchors reject absent, empty and ambiguous text and preserve literal replacement text', () => {
  assert.throws(() => replaceOnce('one one', 'one', 'two'));
  assert.throws(() => replaceOnce('one', 'missing', 'two'));
  assert.throws(() => replaceOnce('one', '', 'two'));
  assert.throws(() => sourceSlice('start end start', 'start', 'end'));
  assert.throws(() => sourceSlice('start', 'start', 'missing'));
  assert.equal(replaceOnce('one', 'one', '$&'), '$&');
});

test('the manifest and recipe stage ordering agree and unknown stages fail explicitly', () => {
  assert.deepEqual(manifest.stages.map(stage => stage.id), stageIds);
  assert.throws(() => makeStage(reference, '03-unknown'), /Unknown checkpoint/);
  assert.match(manifest.sourceRevision, /^[a-f0-9]{40}$/);
});

test('the starter is cloud-free in both AppHost forms and does not instantiate a model agent', () => {
  const starter = makeStage(reference, '02-starter');
  for (const host of paths.hosts) {
    assert.doesNotMatch(get(starter, host), /\.WithLlmReference|var cosmos|var mcpMarkItDown|var mcpInterviewData/);
  }
  assert.doesNotMatch(get(starter, paths.program), /AddAIAgent|AddAGUIServer|MapAGUIServer|new DefaultAzureCredential/);
  assert.doesNotMatch(get(starter, paths.program), /builder.AddWorkshopHosting\(/);
  assert.match(get(starter, paths.bootstrap), /public static void AddWorkshopHosting/);
  assert.match(get(starter, paths.factory), /throw new NotSupportedException\("Create the Foundry ChatClientAgent/);
  assert.match(get(starter, paths.home), /Coaching is not connected/);
});

test('chat changes only its early route and the session ID display introduced in Chapter 11', () => {
  for (const id of stageIds) {
    const stage = makeStage(reference, id);
    const early = ['02-starter', '03-first-coach'].includes(id);
    const displaysId = stageIds.indexOf(id) >= stageIds.indexOf('07-interviewers');
    assert.equal(stage.has(paths.home), early, id);
    const expected = early
      ? replaceOnce(get(standaloneReference, paths.chat), '@page "/"', '@page "/chat"')
      : get(standaloneReference, paths.chat);
    const chat = get(stage, paths.chat);
    assert.equal(chat.includes(sessionIdDisplay), displaysId, id);
    assert.equal(displaysId ? replaceOnce(chat, `\n${sessionIdDisplay}`, '') : chat, expected, id);
  }
});

test('Chapter 11 teaches the existing session ID display once and later checkpoints preserve it', () => {
  const transition = contract.transitions.find(item => item.to === '07-interviewers');
  const step = transition.steps.find(item => item.id === 'interviewers-session-id');
  assert.ok(step);
  assert.equal(step.file, paths.chat);
  assert.equal(step.ownership, 'learner');
  assert.equal(step.operation, 'replace');
  assert.deepEqual(step.location, { kind: 'file' });
  assert.equal(step.before, '<ChatHeader OnNewChat="@ResetConversationAsync" />\n\n');
  assert.equal(step.after, `${step.before.trimEnd()}\n${sessionIdDisplay}\n\n`);
  assert.equal(transition.steps.at(-1), step);
  assert.equal(contract.transitions.flatMap(item => item.steps).filter(item => item.id === step.id).length, 1);
  assert.doesNotMatch(get(standaloneReference, paths.chat), /Session ID: <code>/);
  assert.ok(!contract.transitions.at(-1).changedFiles.includes(paths.chat), 'The final checkpoint must keep the learner display.');
  for (const id of ['07-interviewers', '07-handoffs', '08-complete']) {
    const chat = get(makeStage(reference, id), paths.chat);
    assert.equal(chat.split(sessionIdDisplay).length - 1, 1, id);
    assert.ok(chat.indexOf(sessionIdDisplay) < chat.indexOf('<ChatMessageList '), id);
    assert.match(chat, /sessionId = Guid.NewGuid\(\).ToString\(\)/, id);
    assert.match(chat, /sessionIdMessage = new\(ChatRole.System, \$"SessionId: \{sessionId\}"\)/, id);
    assert.match(chat, /ResetConversationAsync\(\)[\s\S]*?AddSessionSystemMessages\(\);/, id);
  }
});

test('the supplied AG-UI chat resends its full conversation at every stage', () => {
  for (const id of stageIds) {
    const chat = get(makeStage(reference, id), paths.chat);
    assert.match(chat, /var outboundMessages = messages\.ToArray\(\);/, id);
    assert.doesNotMatch(chat, /statefulMessageCount|BuildOutboundMessages|lastSessionId/, id);
    assert.match(chat, /ReferenceEquals\(currentResponseMessage, responseMessage\)/, id);
    assert.match(chat, /catch \(OperationCanceledException ex\)/, id);
    assert.match(chat, /string.IsNullOrWhiteSpace\(responseText.Text\)/, id);
    assert.match(chat, /The coach returned no reply/, id);
    const client = get(makeStage(reference, id), 'src/InterviewCoach.WebUI/Program.cs');
    assert.match(client, /client.Timeout = TimeSpan.FromMinutes\(5\)/, id);
    assert.match(client, /\.RemoveAllResilienceHandlers\(\)/, id);
  }
});

test('upload plumbing remains supplied and byte-identical at every stage', () => {
  const upload = get(reference, paths.program).slice(get(reference, paths.program).indexOf(anchors.upload));
  for (const id of stageIds) {
    const program = get(makeStage(reference, id), paths.program);
    assert.equal(program.slice(program.indexOf(anchors.upload)), upload, id);
  }
});

test('first-coach teaches the real Foundry agent branch and reaches DevUI before AG-UI', () => {
  const stage = makeStage(reference, '03-first-coach');
  const program = get(stage, paths.program);
  const bootstrap = get(stage, paths.bootstrap);
  assert.match(program, /builder.AddWorkshopHosting\(\)/);
  assert.match(bootstrap, /AddSingleton\(client.AsIChatClient\(\)\)/);
  assert.match(program, /builder.AddAIAgent\("coach"\)/);
  assert.match(bootstrap, /AddDevUI/);
  assert.match(bootstrap, /MapOpenAIResponses/);
  assert.match(program, /app.MapWorkshopDevUI\(\)/);
  assert.doesNotMatch(program, /AGUIServer/);
  const branch = source => sourceSlice(source,
    anchors.provider, '    // ============================================================================\n    // MODE 1:');
  assert.equal(branch(get(stage, paths.factory)), branch(get(reference, paths.factory)));
  assert.match(branch(get(stage, paths.factory)), /new ChatClientAgent/);
});

test('the first agent has five focused edits and every checkpoint retains the supplied bootstrap', () => {
  const first = contract.transitions.find(item => item.to === '03-first-coach');
  assert.equal(first.steps.length, 5);
  assert.equal(first.steps.reduce((sum, step) => sum + step.after.split('\n').length, 0) <= 60, true);
  const scaffold = get(makeStage(reference, '02-starter'), paths.bootstrap);
  for (const id of stageIds) {
    const stage = makeStage(reference, id);
    assert.equal(get(stage, paths.bootstrap), scaffold, id);
    assert.match(get(stage, paths.probe), /await client.ListToolsAsync\(\)/);
    assert.doesNotMatch(get(stage, paths.hosts[1]), /\.WithLlmReference|var cosmos|var mcpMarkItDown|var mcpInterviewData/, id);
    assert.equal(JSON.parse(get(stage, paths.settings[1])).AgentMode, 'Single', id);
  }
});

test('all later checkpoints retain the provider helper implemented in the first-agent lesson', () => {
  const step = contract.transitions.find(item => item.to === '03-first-coach').steps
    .find(step => step.id === 'coach-foundry-agent');
  for (const id of stageIds.slice(1)) {
    const factory = get(makeStage(reference, id), paths.factory);
    assert.equal(factory.split(anchors.provider).length - 1, 1, id);
    assert.equal(sourceSlice(factory, anchors.provider, '    // ==='), step.after, id);
  }
});

test('streaming wires the supplied chat without introducing tools or storage', () => {
  const stage = makeStage(reference, '03-streaming');
  assert.match(get(stage, paths.program), /builder.Services.AddAGUIServer\(\)/);
  assert.match(get(stage, paths.program), /app.MapAGUIServer\(agentBuilder, "ag-ui"\)/);
  assert.doesNotMatch(get(stage, paths.program), /AddKeyedSingleton<McpClient>/);
  assert.doesNotMatch(get(stage, paths.factory), /static string GetPracticeGuidance/);
});

test('the temporary function has documented categories and an explicit invalid-input failure', () => {
  const factory = get(makeStage(reference, '04-tools'), paths.factory);
  assert.match(factory, /"behavioural" => "Use STAR:/);
  assert.match(factory, /"technical" => "Clarify assumptions/);
  assert.match(factory, /throw new ArgumentException\("Choose behavioural or technical.", nameof\(category\)\)/);
  assert.match(factory, /AIFunctionFactory.Create\(GetPracticeGuidance/);
  assert.match(factory, /Name = "get_practice_guidance"/);
  for (const id of stageIds.slice(stageIds.indexOf('05-mcp-state'))) {
    assert.doesNotMatch(get(makeStage(reference, id), paths.factory), /GetPracticeGuidance|get_practice_guidance/, id);
  }
});

test('MCP server exposure is runnable before agent-side discovery is connected', () => {
  const server = makeStage(reference, '05-mcp-server');
  assert.equal(get(server, paths.tools), get(reference, paths.tools));
  assert.equal(get(server, paths.server), get(reference, paths.server));
  assert.match(get(server, paths.hosts[0]), /RunAsPreviewEmulator/);
  assert.doesNotMatch(get(server, paths.program), /AddKeyedSingleton<McpClient>/);
  assert.match(get(server, paths.factory), /GetPracticeGuidance/);
  assert.doesNotMatch(get(server, paths.hosts[0]), /\.WaitFor\(mcpInterviewData\)/);
});

test('MCP discovery arrives in the client lesson without lifecycle automation', () => {
  const stage = makeStage(reference, '05-mcp-state');
  assert.equal(get(stage, paths.tools), get(reference, paths.tools));
  assert.equal(get(stage, paths.server), get(reference, paths.server));
  assert.match(get(stage, paths.program), /AddHttpClient\("mcp-interview-data"/);
  assert.doesNotMatch(get(stage, paths.program), /AddHttpClient\("mcp-markitdown"/);
  for (const host of [paths.hosts[0]]) {
    assert.match(get(stage, host), /RunAsPreviewEmulator/);
    assert.match(get(stage, host), /\.WaitFor\(mcpInterviewData\)/);
    assert.doesNotMatch(get(stage, host), /mcpMarkItDown/);
  }
  assert.match(get(stage, paths.factory), /Automatic session setup comes in the next lesson/);
});

test('extraction adds an explicit parser request before the full document intake prompt', () => {
  const stage = makeStage(reference, '06-document-extraction');
  assert.match(get(stage, paths.program), /AddHttpClient\("mcp-markitdown"/);
  assert.match(get(stage, paths.factory), /When explicitly asked to extract a document URL/);
  assert.match(get(stage, paths.factory), /Ask before saving newly extracted document text/);
  const next = contract.transitions.find(item => item.to === '06-documents');
  assert.deepEqual(next.changedFiles, [paths.factory]);
  assert.equal(next.steps.length, 2);
});
test('persistence changes lifecycle instructions, not repository implementations or chat history', () => {
  const before = makeStage(reference, '05-mcp-state');
  const after = makeStage(reference, '05-persistence');
  const changed = [...before.keys()].filter(file => !before.get(file).equals(after.get(file)));
  assert.deepEqual(changed, [paths.factory]);
  const factory = get(after, paths.factory);
  for (const rule of ['Use the SessionId', 'Always call get_interview_session', 'call add_interview_session with that exact ID before any update',
    'Never use update_interview_session to create a record', 'begin your first reply with "Session ID: <id>"',
    'preserve all six resume/job fields', 'Set Transcript to ONLY',
    'Never copy the existing transcript', 'Then call complete_interview_session',
    'returned record has IsCompleted true']) {
    assert.ok(factory.includes(rule), rule);
  }
});

test('missing-record writes fail instead of looking successful', () => {
  const tools = get(makeStage(reference, '05-mcp-server'), paths.tools);
  assert.match(tools, /update_interview_session cannot create one/);
  assert.match(tools, /This cannot create a record or set IsCompleted/);
  assert.match(tools, /throw new McpException\(/);
  assert.doesNotMatch(tools, /if \(updated is null\)[\s\S]*?return default;/);
  assert.doesNotMatch(tools, /if \(completed is null\)[\s\S]*?return default;/);
});

test('documents restores the exact source single-agent method while handoff is still disabled', () => {
  const stage = makeStage(reference, '06-documents');
  assert.equal(sourceSlice(get(stage, paths.factory), anchors.single, anchors.handoff),
    sourceSlice(get(reference, paths.factory), anchors.single, anchors.handoff));
  assert.match(get(stage, paths.program), /builder.AddWorkshopHosting\(\)/);
  for (const file of paths.settings) assert.equal(JSON.parse(get(stage, file)).AgentMode, 'Single');
});

test('the first handoff only instantiates and routes between triage and receptionist', () => {
  const stage = makeStage(reference, '07-first-handoff');
  const workflow = get(stage, paths.factory).slice(get(stage, paths.factory).indexOf(anchors.workflow));
  assert.match(workflow, /name: "triage"/);
  assert.match(workflow, /name: "receptionist"/);
  assert.doesNotMatch(workflow, /behavioural_interviewer|technical_interviewer|summariser/);
  assert.match(workflow, /\.WithHandoff\(triageAgent, receptionistAgent\)/);
  assert.match(workflow, /\.WithHandoff\(receptionistAgent, triageAgent\)/);
  assert.match(workflow, /Interview specialists are not connected yet/);
  assert.match(get(stage, paths.factory), /workflow.AsAIAgent\(name: key\)/);
  assert.equal(JSON.parse(get(stage, paths.settings[0])).AgentMode, 'HandOff');
});

test('the first handoff replaces both existing stubs and shows meaningful insertion context', () => {
  const steps = contract.transitions.find(item => item.to === '07-first-handoff').steps;
  for (const [id, signature] of [
    ['handoff-hosting-adapter', anchors.adapter],
    ['handoff-workflow-tools', anchors.workflow],
  ]) {
    const step = steps.find(step => step.id === id);
    assert.equal(step.operation, 'replace');
    assert.match(step.title, /^Replace the existing /);
    assert.ok(step.before.startsWith(signature), id);
    assert.match(step.before, /=> throw new NotSupportedException/);
    assert.ok(step.after.startsWith(signature), id);
  }
  for (const [id, landmark] of [
    ['handoff-triage-agent', 'var interviewDataTools ='],
    ['handoff-receptionist-agent', 'var triageAgent ='],
    ['handoff-two-agent-graph', 'var receptionistAgent ='],
  ]) {
    const step = steps.find(step => step.id === id);
    assert.ok(step.before.includes(landmark), id);
    assert.ok(step.after.includes(landmark), id);
    assert.ok(step.before.trimEnd().endsWith(');'), id);
    assert.doesNotMatch(step.before, /^\s*}\s*$/m, id);
    assert.doesNotMatch(step.after, /^\s*}\s*$/m, id);
    assert.deepEqual(step.location, { kind: 'function', name: 'CreateHandOffWorkflow' });
  }
  const before = makeStage(reference, '06-documents');
  const provider = sourceSlice(get(before, paths.factory), anchors.provider, '    // ===');
  let current = before;
  for (const step of steps) {
    current = replayTransition(current, { steps: [step] });
    assert.equal(sourceSlice(get(current, paths.factory), anchors.provider, '    // ==='), provider, step.id);
  }
  const after = replayTransition(before, { steps });
  const factory = get(after, paths.factory);
  assert.equal(factory.split(anchors.adapter).length - 1, 1);
  assert.equal(factory.split(anchors.workflow).length - 1, 1);
  assert.equal(sourceSlice(factory, anchors.single, anchors.handoff),
    sourceSlice(get(before, paths.factory), anchors.single, anchors.handoff));
  assertSameFiles(after, makeStage(reference, '07-first-handoff'), 'Chapter 10 instructional edits');
});

test('adding handoff agents and the graph leaves surrounding closing braces untouched', () => {
  const steps = contract.transitions.find(item => item.to === '07-first-handoff').steps;
  const opening = replayTransition(makeStage(reference, '06-documents'), { steps: steps.slice(0, 2) });
  const standardEnding = '    }\n\n}\n';
  const reformattedEnding = '    }\n}\n';
  opening.set(paths.factory, Buffer.from(replaceOnce(get(opening, paths.factory), standardEnding, reformattedEnding)));
  const result = replayTransition(opening, { steps: steps.slice(2) });
  assert.ok(get(result, paths.factory).endsWith(reformattedEnding));
  const expected = makeStage(reference, '07-first-handoff');
  expected.set(paths.factory, Buffer.from(replaceOnce(get(expected, paths.factory), standardEnding, reformattedEnding)));
  assertSameFiles(result, expected, 'Chapter 10 preserves the learner closing braces');
});

test('the four-agent checkpoint only routes to its available specialists', () => {
  const stage = makeStage(reference, '07-interviewers');
  const workflow = get(stage, paths.factory).slice(get(stage, paths.factory).indexOf(anchors.workflow));
  for (const name of ['triage', 'receptionist', 'behavioural_interviewer', 'technical_interviewer']) {
    assert.match(workflow, new RegExp(`name: "${name}"`));
  }
  assert.doesNotMatch(workflow, /summariser|summariserAgent/);
  assert.match(workflow, /\.WithHandoff\(technicalAgent, triageAgent\)/);
  assert.match(workflow, /end this turn without a handoff/);
  assert.match(workflow, /Do not ask another question or hand off/);
});

test('the final checkpoint retains the complete Chapter 12 application without source edits', () => {
  const handoffs = makeStage(reference, '07-handoffs');
  const complete = makeStage(reference, '08-complete');
  assertSameFiles(complete, handoffs, 'final checkpoint continuity');
  assert.deepEqual(contract.transitions.at(-1), {
    from: '07-handoffs', to: '08-complete', steps: [], changedFiles: [],
  });
  const factory = get(complete, paths.factory);
  assert.equal(factory.slice(0, factory.indexOf(anchors.handoff)),
    get(reference, paths.factory).slice(0, get(reference, paths.factory).indexOf(anchors.handoff)));
  assert.equal(factory.slice(factory.indexOf(anchors.workflow)),
    get(reference, paths.factory).slice(get(reference, paths.factory).indexOf(anchors.workflow)));
  const layoutChanges = new Set([paths.factory, paths.program, ...deploymentPaths]);
  for (const [path, content] of reference) {
    if (!layoutChanges.has(path)) assert.ok(complete.get(path)?.equals(content), path);
  }
  assert.deepEqual([...complete.keys()].filter(path => !reference.has(path)).sort(), [paths.bootstrap, paths.probe].sort());
  const referenceProgram = get(reference, paths.program);
  const bootstrap = get(complete, paths.bootstrap);
  for (const block of [
    sourceSlice(referenceProgram, anchors.model, anchors.agent),
    sourceSlice(referenceProgram, 'builder.Services.AddOpenAIResponses();', 'builder.Services.AddAGUIServer();'),
    'app.MapOpenAIResponses();\napp.MapOpenAIConversations();',
    'app.MapDevUI();',
  ]) {
    const indented = block.trimEnd().split('\n').map(line => line ? `        ${line}` : '').join('\n');
    assert.ok(bootstrap.includes(indented), 'The retained helper must contain the reference model and DevUI setup.');
  }
  const program = get(complete, paths.program);
  assert.match(program, /builder\.AddWorkshopHosting\(\)/);
  assert.match(program, /app\.MapWorkshopDevUI\(\)/);
  assert.match(program, /app\.MapAGUIServer\(agentBuilder, "ag-ui"\)/);
  assert.match(get(complete, paths.probe), /await client\.ListToolsAsync\(\)/);
});

test('optional deployment changes only its AppHost and settings while retaining the workshop application', () => {
  const complete = makeStage(reference, '08-complete');
  const deployment = makeDeploymentProject(reference);
  assert.deepEqual([...deployment.keys()], [...complete.keys()]);
  const changed = [...complete.keys()].filter(path => !complete.get(path).equals(deployment.get(path))).sort();
  assert.deepEqual(changed, [...deploymentPaths].sort());
  for (const path of deploymentPaths) assert.ok(deployment.get(path).equals(reference.get(path)), path);
  for (const path of paths.settings) {
    const settings = JSON.parse(get(deployment, path));
    assert.equal(settings.AgentMode, 'HandOff', path);
    assert.equal(settings.MicrosoftFoundry.UseExisting, true, path);
    assert.equal(settings.Azure.AllowResourceGroupCreation, false, path);
  }
  assertSameFiles(complete, makeStage(reference, '08-complete'), 'Deployment must not mutate the core checkpoint.');
});

test('handoff prompts preserve document context and distinguish recovery from phase completion', () => {
  for (const id of ['07-first-handoff', '07-interviewers', '07-handoffs', '08-complete']) {
    const factory = get(makeStage(reference, id), paths.factory);
    const workflow = factory.slice(factory.indexOf(anchors.workflow));
    const storageRules = workflow.match(/Before each update, call get_interview_session and preserve all six resume\/job fields/g) ?? [];
    assert.equal(storageRules.length, id === '07-first-handoff' ? 1 : 3, id);
    assert.match(workflow, /A failed fetch does not complete intake/, id);
    assert.match(workflow, /verify the returned document fields before handoff/, id);
    if (id === '07-handoffs' || id === '08-complete') {
      assert.match(workflow, /new or replacement resume or job description/, id);
      assert.match(workflow, /a return does not always mean a phase is complete/, id);
      assert.doesNotMatch(workflow, /they have COMPLETED their phase/, id);
    }
  }
});

test('every explicit transition replays exactly from one continuously edited starter', () => {
  let actual = makeStage(reference, stageIds[0]);
  for (const item of contract.transitions) {
    actual = replayTransition(actual, item);
    assertSameFiles(actual, makeStage(reference, item.to), item.to);
  }
  assertSameFiles(actual, makeStage(reference, '08-complete'), 'learner final checkpoint');
});

test('the contract exposes stable globally unique focused steps and every changed file', () => {
  const ids = new Set();
  for (const item of contract.transitions) {
    const before = makeStage(reference, item.from);
    const after = makeStage(reference, item.to);
    const changed = [...new Set([...before.keys(), ...after.keys()])]
      .filter(file => !before.has(file) || !after.has(file) || !before.get(file).equals(after.get(file))).sort();
    assert.deepEqual(item.changedFiles, changed);
    for (const step of item.steps) {
      assert.ok(/^[a-z][a-z0-9-]+$/.test(step.id), step.id);
      assert.ok(!ids.has(step.id), step.id);
      ids.add(step.id);
      assert.ok(step.title);
      assert.ok(['learner', 'supplied'].includes(step.ownership));
      assert.ok(['replace', 'create', 'delete'].includes(step.operation));
      assert.notEqual(step.before, step.after, step.id);
      assert.ok(step.after.split('\n').length <= 60, `${step.id} must remain a focused edit`);
      if ([paths.factory, paths.program, paths.chat].includes(step.file)) {
        assert.notEqual(step.after, get(after, step.file), `${step.id} must not replace a finished application file`);
      }
    }
  }
  assert.equal(contract.transitions.at(-1).steps.length, 0);
  assert.equal(contract.sourceRevision, manifest.sourceRevision);
});

test('omitting any required step fails replay or exact target comparison', () => {
  for (const item of contract.transitions) {
    for (let omitted = 0; omitted < item.steps.length; omitted++) {
      const incomplete = { ...item, steps: item.steps.filter((_, i) => i !== omitted) };
      assert.throws(() => assertSameFiles(
        replayTransition(makeStage(reference, item.from), incomplete),
        makeStage(reference, item.to), `Omitted ${item.steps[omitted].id}`));
    }
  }
});

test('every displayed after-line comes from the actual starting or target source, not a second code copy', () => {
  for (const item of contract.transitions) {
    const before = makeStage(reference, item.from);
    const after = makeStage(reference, item.to);
    for (const step of item.steps) {
      const sourceLines = new Set([
        ...(before.get(step.file)?.toString('utf8').split('\n') ?? []),
        ...(after.get(step.file)?.toString('utf8').split('\n') ?? []),
      ]);
      const fragmentLines = step.after.split('\n');
      for (const [index, line] of fragmentLines.entries()) {
        if (!line.trim()) continue;
        const boundary = index === 0 || index === fragmentLines.length - 1;
        assert.ok(sourceLines.has(line) || (boundary && [...sourceLines].some(source => source.includes(line))),
          `${step.id} has a line that is not source-backed: ${line}`);
      }
    }
  }
});

test('replay rejects edited anchors, duplicate IDs, invalid operations and unsafe paths', () => {
  const step = contract.transitions[0].steps[0];
  const starter = makeStage(reference, '02-starter');
  const replay = steps => replayTransition(starter, { steps });
  assert.throws(() => replay([{ ...step, before: 'not in the source' }]), /source anchor/);
  assert.throws(() => replay([step, step]), /Duplicate edit ID/);
  assert.throws(() => replay([{ ...step, operation: 'patch' }]), /Unknown edit operation/);
  assert.throws(() => replay([{ ...step, file: '../outside.cs' }]), /Invalid edit path/);
});

test('file creation is exact and refuses to overwrite an existing learner file', () => {
  const step = { id: 'create-scaffold', file: 'src/Scaffold.cs', operation: 'create', before: '', after: 'scaffold\n' };
  const created = replayTransition(new Map(), { steps: [step] });
  assert.equal(created.get(step.file).toString('utf8'), step.after);
  assert.throws(() => replayTransition(created, { steps: [step] }), /Cannot create/);
  assert.throws(() => replayTransition(new Map(), { steps: [{ ...step, before: 'unexpected' }] }), /Cannot create/);
});

test('scaffold deletion refuses modified learner content and equality detects extra files', () => {
  const item = contract.transitions.find(item => item.to === '03-streaming');
  const modified = makeStage(reference, item.from);
  modified.set(paths.home, Buffer.from('local edits'));
  assert.throws(() => replayTransition(modified, item), /Cannot delete modified scaffold/);
  const final = makeStage(reference, '08-complete');
  final.set('unexpected.cs', Buffer.from('extra'));
  assert.throws(() => assertSameFiles(final, makeStage(reference, '08-complete'), 'extra file'), /unexpected.cs/);
});
