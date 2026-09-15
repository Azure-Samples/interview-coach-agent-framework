import { anchors, makeStage, paths, replaceOnce, sourceSlice, stageIds, workshopModelCall } from './recipes.mjs';
import { deriveEditLocation } from './edit-location.mjs';

const text = (files, file) => {
  const value = files.get(file);
  if (!value) throw new Error(`Missing edit-contract file: ${file}`);
  return value.toString('utf8');
};
const between = (start, end) => source => sourceSlice(source, start, end);
const prefix = end => source => {
  const index = source.indexOf(end);
  if (index === -1 || source.indexOf(end, index + end.length) !== -1) {
    throw new Error(`Missing or ambiguous import boundary: ${end}`);
  }
  return source.slice(0, index);
};
const inSingle = select => source => select(sourceSlice(source, anchors.single, anchors.handoff));
const prompt = inSingle(between('            instructions: """', '        );\n'));
const setup = inSingle(between(anchors.single, '        var agent = '));
const agentResource = between('var agent = ', 'var webUI = ');
const endOfWorkflow = '    }\n\n}\n';

export function assertSameFiles(actual, expected, label) {
  const files = new Set([...actual.keys(), ...expected.keys()]);
  for (const file of files) {
    if (!actual.has(file) || !expected.has(file) || !actual.get(file).equals(expected.get(file))) {
      throw new Error(`${label}: unaccounted or incorrect edit in ${file}`);
    }
  }
}

export function replayTransition(previous, transition) {
  const result = new Map(previous);
  const ids = new Set();
  for (const step of transition.steps) {
    if (ids.has(step.id)) throw new Error(`Duplicate edit ID: ${step.id}`);
    ids.add(step.id);
    if (!step.file || step.file.startsWith('/') || step.file.split('/').includes('..')) {
      throw new Error(`Invalid edit path: ${step.file}`);
    }
    if (step.operation === 'create') {
      if (result.has(step.file) || step.before !== '') throw new Error(`Cannot create ${step.file}`);
      result.set(step.file, Buffer.from(step.after));
    } else if (step.operation === 'delete') {
      if (text(result, step.file) !== step.before || step.after !== '') {
        throw new Error(`Cannot delete modified scaffold: ${step.file}`);
      }
      result.delete(step.file);
    } else if (step.operation === 'replace') {
      result.set(step.file, Buffer.from(replaceOnce(text(result, step.file), step.before, step.after)));
    } else {
      throw new Error(`Unknown edit operation: ${step.operation}`);
    }
  }
  return result;
}

function transition(previous, target, from, to) {
  let current = new Map(previous);
  const steps = [];
  function change(id, title, file, before, after, ownership = 'learner', operation = 'replace') {
    if (before === after) throw new Error(`Edit ${id} does not change anything.`);
    const oldText = current.has(file) ? text(current, file) : '';
    const newText = target.has(file) ? text(target, file) : '';
    const line = (source, snippet) => {
      const index = snippet ? source.indexOf(snippet) : -1;
      return index === -1 ? null : source.slice(0, index).split('\n').length;
    };
    // Line numbers describe the live edit and final target respectively. A composite
    // intermediate fragment (such as an empty workflow body) has no final line number.
    const step = {
      id, title, file, operation, ownership, before, after,
      location: deriveEditLocation({ file, operation, before, after, beforeSource: oldText, afterSource: newText }),
      beforeStartLine: line(oldText, before),
      afterStartLine: line(newText, after),
    };
    current = replayTransition(current, { steps: [step] });
    steps.push(step);
  }
  function section(id, title, file, select, ownership) {
    change(id, title, file, select(text(current, file)), select(text(target, file)), ownership);
  }
  function insert(id, title, file, anchor, select, ownership) {
    if (!anchor.includes('\n')) {
      const source = text(current, file);
      const start = source.indexOf(anchor);
      if (start === -1) throw new Error(`Missing insertion anchor for ${id}`);
      const end = source.indexOf('\n', start);
      anchor = source.slice(start, end === -1 ? source.length : end);
    }
    change(id, title, file, anchor, select(text(target, file)) + anchor, ownership);
  }
  function literal(id, title, file, before, after, ownership) {
    if (!text(target, file).includes(after)) throw new Error(`Missing target for ${id}`);
    change(id, title, file, before, after, ownership);
  }
  function imports(id, file, end = 'var builder = ') {
    section(id, 'Update the required imports', file, prefix(end));
  }
  function hosts(id, title, select = agentResource) {
    section(`${id}-file-apphost`, title, paths.hosts[0], select);
  }
  function settings(id) {
    literal(`${id}-file-settings`, 'Select the handoff workflow', paths.settings[0],
      '"AgentMode": "Single"', '"AgentMode": "HandOff"');
  }

  if (to === '03-first-coach') {
    section('coach-foundry-agent', 'Create the Foundry ChatClientAgent', paths.factory,
      between(anchors.provider, '    // ============================================================================\n    // MODE 1:'));
    section('coach-single-agent', 'Create the single coach and its instructions', paths.factory,
      between(anchors.single, anchors.handoff));
    insert('coach-enable-hosting', 'Connect the supplied hosting and register your coach', paths.program, 'var app = builder.Build();',
      between(workshopModelCall, 'var app = builder.Build();'));
    insert('coach-enable-devui', 'Open the coach in DevUI', paths.program, 'if (builder.Environment.IsDevelopment() == false)',
      between('app.MapWorkshopDevUI();', 'if (builder.Environment.IsDevelopment() == false)'));
    hosts('coach-model-reference', 'Connect the agent resource to the configured model');
  } else if (to === '03-streaming') {
    imports('streaming-program-imports', paths.program);
    insert('streaming-server-services', 'Register the AG-UI transport', paths.program, 'var app = builder.Build();',
      between('builder.Services.AddAGUIServer();', 'var app = builder.Build();'));
    insert('streaming-agent-endpoint', 'Expose the coach on the AG-UI endpoint', paths.program, 'if (builder.Environment.IsDevelopment() == false)',
      between('app.MapAGUIServer(', 'if (builder.Environment.IsDevelopment() == false)'));
    change('streaming-remove-home', 'Remove the not-connected home page', paths.home, text(current, paths.home), '', 'learner', 'delete');
    literal('streaming-chat-route', 'Make the supplied chat the home page', paths.chat, '@page "/chat"', '@page "/"');
  } else if (to === '04-tools') {
    insert('tools-practice-function', 'Implement the practice-guidance function', paths.factory, '        var agent = CreateProviderAgent(',
      inSingle(between('        static string GetPracticeGuidance(', '        var tools = ')));
    insert('tools-function-registration', 'Describe the function and create an AI tool', paths.factory, '        var agent = CreateProviderAgent(',
      inSingle(between('        var tools = ', '        var agent = ')));
    section('tools-agent-instructions', 'Give the coach its tool and a reason to call it', paths.factory, prompt);
  } else if (to === '05-mcp-server') {
    imports('mcp-tool-imports', paths.tools, 'namespace InterviewCoach.Mcp.InterviewData;');
    const declaration = 'public class InterviewSessionTool(IInterviewSessionRepository repository, ILogger<InterviewSessionTool> logger) : IInterviewSessionTool';
    literal('mcp-tool-class', 'Mark the repository tool class for discovery', paths.tools, declaration, `[McpServerToolType]\n${declaration}`);
    for (const name of ['add_interview_session', 'get_interview_sessions', 'get_interview_session', 'update_interview_session', 'complete_interview_session']) {
      const source = text(target, paths.tools);
      const attribute = source.split('\n').find(line => line.includes(`[McpServerTool(Name = "${name}"`));
      if (!attribute) throw new Error(`Missing MCP tool attribute: ${name}`);
      const offset = source.indexOf(attribute) + attribute.length + 1;
      const description = source.slice(offset, source.indexOf('\n', offset));
      literal(`mcp-expose-${name.replaceAll('_', '-')}`, `Expose ${name}`, paths.tools, description, `${attribute}\n${description}`);
    }
    imports('mcp-server-imports', paths.server);
    insert('mcp-server-registration', 'Register the stateless HTTP MCP server and discover tools', paths.server, 'var app = builder.Build();',
      between('builder.Services.AddMcpServer()', 'var app = builder.Build();'));
    insert('mcp-server-route', 'Expose the repository server at /mcp', paths.server, 'await app.RunAsync();',
      between('app.MapMcp("/mcp");', 'await app.RunAsync();'));
    insert('mcp-resources-file-apphost', 'Start the supplied repository service and emulator', paths.hosts[0], 'var agent = ',
      between('// Azure Cosmos DB', 'var agent = '), 'supplied');
  } else if (to === '05-mcp-state') {
    hosts('mcp-service-reference', 'Connect and wait for InterviewData');
    imports('mcp-client-imports', paths.program);
    insert('mcp-http-client', 'Configure service discovery for InterviewData', paths.program, workshopModelCall,
      between('builder.Services.AddHttpClient("mcp-interview-data"', 'builder.Services.AddKeyedSingleton<McpClient>("mcp-interview-data"'));
    insert('mcp-keyed-client', 'Create the keyed MCP client and HTTP transport', paths.program, workshopModelCall,
      between('builder.Services.AddKeyedSingleton<McpClient>("mcp-interview-data"', workshopModelCall));
    change('mcp-remove-practice-function', 'Remove the temporary practice-guidance function', paths.factory,
      inSingle(between('        static string GetPracticeGuidance(', '        var tools = '))(text(current, paths.factory)), '');
    section('mcp-discover-tools', 'Replace the local function registration with MCP discovery', paths.factory, setup);
    section('mcp-agent-tools', 'Give the agent repository tools for explicit record requests', paths.factory, prompt);
  } else if (to === '05-persistence') {
    section('persistence-session-lifecycle', 'Implement fetch-or-create, update, transcript and completion rules', paths.factory, prompt);
  } else if (to === '06-document-extraction') {
    insert('documents-container-file-apphost', 'Add the MarkItDown HTTP container', paths.hosts[0], '// Azure Cosmos DB',
      between('var mcpMarkItDown = ', '// Azure Cosmos DB'));
    hosts('documents-service-reference', 'Connect and wait for MarkItDown');
    insert('documents-http-client', 'Configure the document conversion HTTP client', paths.program, 'builder.Services.AddHttpClient("mcp-interview-data"',
      between('builder.Services.AddHttpClient("mcp-markitdown"', 'builder.Services.AddKeyedSingleton<McpClient>("mcp-markitdown"'));
    insert('documents-keyed-client', 'Create the keyed document MCP client', paths.program, 'builder.Services.AddHttpClient("mcp-interview-data"',
      between('builder.Services.AddKeyedSingleton<McpClient>("mcp-markitdown"', 'builder.Services.AddHttpClient("mcp-interview-data"'));
    section('documents-discover-tools', 'Discover both sets of MCP tools', paths.factory, setup);
    section('extraction-agent-instructions', 'Let the coach extract a URL on request', paths.factory, prompt);
  } else if (to === '06-documents') {
    literal('documents-agent-description', 'Describe the complete single-agent responsibility', paths.factory,
      'description: "An interview coach for software developers."', 'description: "Runs the complete interview coaching process."');
    section('documents-interview-instructions', 'Add document intake to the complete interview instructions', paths.factory, prompt);
  } else if (to === '07-first-handoff') {
    section('handoff-hosting-adapter', 'Replace the existing AddHandOffWorkflow stub', paths.factory,
      between(anchors.adapter, anchors.provider), 'supplied');
    const targetFactory = text(target, paths.factory);
    const opening = sourceSlice(targetFactory, anchors.workflow, '        // --- Triage Agent ---');
    const stub = sourceSlice(text(current, paths.factory), anchors.workflow, '\n}\n');
    change('handoff-workflow-tools', 'Replace the existing CreateHandOffWorkflow stub', paths.factory, stub,
      opening + endOfWorkflow.slice(0, -3));
    function appendWorkflow(id, title, start, select) {
      const workflow = sourceSlice(text(current, paths.factory), anchors.workflow, '\n}\n') + '\n}\n';
      const context = sourceSlice(workflow, start, endOfWorkflow);
      change(id, title, paths.factory, context, context + select(targetFactory));
    }
    appendWorkflow('handoff-triage-agent', 'Add triage after the tool discovery', anchors.workflow,
      between('        // --- Triage Agent ---', '        // --- Receptionist Agent ---'));
    appendWorkflow('handoff-receptionist-agent', 'Add the receptionist after triage', '        // --- Triage Agent ---',
      between('        // --- Receptionist Agent ---', '        // Connect only the two agents'));
    appendWorkflow('handoff-two-agent-graph', 'Add the graph after the receptionist', '        // --- Receptionist Agent ---',
      between('        // Connect only the two agents', '    }\n\n}\n'));
    settings('handoff-mode');
  } else if (to === '07-interviewers') {
    section('specialists-triage-agent', 'Let triage route to the interviewers', paths.factory,
      between('        // --- Triage Agent ---', '        // --- Receptionist Agent ---'));
    change('specialists-receptionist-agent', 'Route completed intake directly to the behavioural interviewer', paths.factory,
      sourceSlice(text(current, paths.factory), '        // --- Receptionist Agent ---', '        // Connect only the two agents'),
      sourceSlice(text(target, paths.factory), '        // --- Receptionist Agent ---', '        // --- Behavioural Interviewer Agent ---'));
    insert('specialists-behavioural-agent', 'Define the behavioural interviewer and its next phase', paths.factory, '        // Connect only the two agents',
      between('        // --- Behavioural Interviewer Agent ---', '        // --- Technical Interviewer Agent ---'));
    insert('specialists-technical-agent', 'Define the technical interviewer and its next phase', paths.factory, '        // Connect only the two agents',
      between('        // --- Technical Interviewer Agent ---', '        // Connect the four available agents.'));
    change('specialists-interviewer-graph', 'Connect behavioural and technical practice', paths.factory,
      sourceSlice(text(current, paths.factory), '        // Connect only the two agents', endOfWorkflow),
      sourceSlice(text(target, paths.factory), '        // Connect the four available agents.', endOfWorkflow));
    section('interviewers-session-id', 'Show the session ID above the conversation', paths.chat,
      between('<ChatHeader ', '<ChatMessageList '));
  } else if (to === '07-handoffs') {
    section('summary-triage-agent', 'Let triage route to the summary', paths.factory,
      between('        // --- Triage Agent ---', '        // --- Receptionist Agent ---'));
    change('summary-technical-agent', 'Finish technical practice with a summary', paths.factory,
      sourceSlice(text(current, paths.factory), '        // --- Technical Interviewer Agent ---', '        // Connect the four available agents.'),
      sourceSlice(text(target, paths.factory), '        // --- Technical Interviewer Agent ---', '        // --- Summariser Agent ---'));
    insert('specialists-summariser-agent', 'Define summary generation and record completion', paths.factory, '        // Connect the four available agents.',
      between('        // --- Summariser Agent ---', '        // Build the handoff workflow'));
    change('specialists-handoff-graph', 'Connect the completed workflow', paths.factory,
      sourceSlice(text(current, paths.factory), '        // Connect the four available agents.', endOfWorkflow),
      sourceSlice(text(target, paths.factory), '        // Build the handoff workflow', endOfWorkflow));
  } else if (to !== '08-complete') {
    throw new Error(`No edit contract for ${to}`);
  }

  assertSameFiles(current, target, `${from} -> ${to}`);
  const changedFiles = [...new Set(steps.map(step => step.file))].sort();
  const expectedChanges = [...new Set([...previous.keys(), ...target.keys()])]
    .filter(file => !previous.has(file) || !target.has(file) || !previous.get(file).equals(target.get(file))).sort();
  if (JSON.stringify(changedFiles) !== JSON.stringify(expectedChanges)) {
    throw new Error(`Transition ${to} does not account for every changed file.`);
  }
  return { from, to, steps, changedFiles };
}

export function buildEditContract(reference, sourceRevision) {
  const stages = stageIds.map(id => makeStage(reference, id));
  const transitions = stageIds.slice(1).map((id, i) => transition(stages[i], stages[i + 1], stageIds[i], id));
  const ids = transitions.flatMap(item => item.steps.map(step => step.id));
  if (new Set(ids).size !== ids.length) throw new Error('Edit IDs must be globally unique.');
  return { version: 1, sourceRevision, transitions };
}
