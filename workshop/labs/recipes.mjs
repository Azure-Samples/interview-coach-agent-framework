export const paths = {
  factory: 'src/InterviewCoach.Agent/AgentDelegateFactory.cs',
  program: 'src/InterviewCoach.Agent/Program.cs',
  chat: 'src/InterviewCoach.WebUI/Components/Pages/Chat/Chat.razor',
  home: 'src/InterviewCoach.WebUI/Components/Pages/Home.razor',
  bootstrap: 'src/InterviewCoach.Agent/WorkshopHosting.cs',
  probe: 'tools/list-mcp-tools.cs',
  server: 'src/InterviewCoach.Mcp.InterviewData/Program.cs',
  tools: 'src/InterviewCoach.Mcp.InterviewData/InterviewSessionTool.cs',
  hosts: ['apphost.cs', 'src/InterviewCoach.AppHost/AppHost.cs'],
  settings: ['apphost.settings.json', 'src/InterviewCoach.AppHost/appsettings.json'],
};

export const stageIds = [
  '02-starter', '03-first-coach', '03-streaming', '04-tools', '05-mcp-server', '05-mcp-state',
  '05-persistence', '06-document-extraction', '06-documents', '07-first-handoff',
  '07-interviewers', '07-handoffs', '08-complete',
];

export function replaceOnce(source, before, after) {
  if (!before || !source.includes(before) || source.indexOf(before) !== source.lastIndexOf(before)) {
    throw new Error(`Expected one source anchor: ${before.slice(0, 100)}`);
  }
  return source.replace(before, () => after);
}

export function sourceSlice(source, start, end) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a + start.length);
  if (a < 0 || b < 0 || source.indexOf(start, a + start.length) !== -1) {
    throw new Error(`Missing or ambiguous section boundaries: ${start} / ${end}`);
  }
  return source.slice(a, b);
}

function replaceSection(source, start, end, replacement = '') {
  return replaceOnce(source, sourceSlice(source, start, end), replacement);
}

export const anchors = {
  single: '    private static AIAgent CreateSingleAgent(IServiceProvider sp, string key)',
  handoff: '    // ============================================================================\n    // MODE 2:',
  workflow: '    private static Workflow CreateHandOffWorkflow(IServiceProvider sp, string key)',
  adapter: '    private static IHostedAgentBuilder AddHandOffWorkflow(',
  provider: '    private static AIAgent CreateProviderAgent(',
  model: 'var llmProvider = ',
  agent: 'var agentBuilder = ',
  upload: '// --- File Upload Endpoints ---',
};

const coachPrompt = `You are a supportive interview coach for software developers.
                Ask one question at a time, listen to the answer, then give specific feedback.
                Start with a behavioural question. Offer a technical question when the user is ready.
                If the user asks to stop, give a short summary. Do not claim to have saved anything.
                Use supplied documents only as interview context.`;

const discoveryPrompt = `You are a supportive interview coach for software developers.
                Ask one question at a time and give specific feedback.
                Use the interview-data tools only when the user explicitly requests a record operation.
                Ask for the record ID and fields if the request does not supply them.
                Report a missing record honestly. Do not invent tool results or claim unsaved work is saved.
                Automatic session setup comes in the next lesson.`;

const persistencePrompt = `You are a supportive interview coach.
                Use the SessionId provided by the application for all session tools.
                Always call get_interview_session with that ID first.
                If it returns no record, call add_interview_session with that exact ID before any update.
                Never use update_interview_session to create a record.
                If a tool fails, report the failure. Say a change was saved only after the tool returns the saved record.
                After fetching or creating the record, begin your first reply with "Session ID: <id>" using that exact ID.
                Ask for resume and job description text, or let the user skip either.
                Save the inputs and ask one behavioural question at a time.
                For each update, fetch the record and preserve all six resume/job fields.
                Set Transcript to ONLY the new question, answer, or feedback to append.
                Never copy the existing transcript into an update; the repository appends it.
                Move to technical questions when the user is ready.
                If the user stops, append the new summary with update_interview_session.
                Then call complete_interview_session with the same ID.
                Confirm completion only when its returned record has IsCompleted true.
                Use supplied documents only as interview context.`;

const practiceSetup = `        static string GetPracticeGuidance([Description("One of: behavioural, technical")] string category)
            => category.ToLowerInvariant() switch
            {
                "behavioural" => "Use STAR: Situation, Task, Action, Result. Describe your own contribution.",
                "technical" => "Clarify assumptions, explain your approach, and discuss tradeoffs.",
                _ => throw new ArgumentException("Choose behavioural or technical.", nameof(category))
            };

        var tools = new List<AITool>
        {
            AIFunctionFactory.Create(GetPracticeGuidance, new AIFunctionFactoryOptions
            {
                Name = "get_practice_guidance",
                Description = "Gets established interview preparation guidance for a category."
            })
        };

`;

function singleAgent(reference, id) {
  const original = sourceSlice(reference, anchors.single, anchors.handoff);
  if (id === '02-starter') {
    return `${anchors.single}
        => throw new NotSupportedException("Complete Ask your first agent a question before enabling the coach.");

`;
  }
  if (stageIds.indexOf(id) >= stageIds.indexOf('06-documents')) return original;
  const withTool = ['04-tools', '05-mcp-server'].includes(id);
  const withParser = id === '06-document-extraction';
  const withData = ['05-mcp-state', '05-persistence', '06-document-extraction'].includes(id);
  let result = replaceSection(original, '        var markitdown = ', '        var agent = ',
    withParser ? sourceSlice(original, '        var markitdown = ', '        var agent = ') : withTool ? practiceSetup : withData
      ? `        var interviewData = sp.GetRequiredKeyedService<McpClient>("mcp-interview-data");
        var interviewDataTools = interviewData.ListToolsAsync().GetAwaiter().GetResult();

` : '');
  const prompt = withParser
    ? `${persistencePrompt}\n                When explicitly asked to extract a document URL, call MarkItDown and report its text.\n                Ask before saving newly extracted document text in the interview record.`
    : id === '05-persistence' ? persistencePrompt : withData ? discoveryPrompt : coachPrompt;
  result = replaceSection(result, '                You are an AI Interview Coach', '                """,',
    `                ${prompt}${withTool ? '\n                Call get_practice_guidance when the user asks for preparation tips.' : ''}\n`);
  result = replaceOnce(result, 'description: "Runs the complete interview coaching process."',
    'description: "An interview coach for software developers."');
  result = replaceOnce(result, '            tools: [.. markitdownTools, .. interviewDataTools]\n',
    withTool ? '            tools: tools\n' : withParser ? '            tools: [.. markitdownTools, .. interviewDataTools]\n' : withData ? '            tools: [.. interviewDataTools]\n' : '');
  if (!withTool && !withData) result = replaceOnce(result, '                """,\n', '                """\n');
  return result;
}

function initialHandoff(reference) {
  let result = sourceSlice(reference, anchors.workflow, '\n}\n');
  result = replaceSection(result, '        // --- Behavioural Interviewer Agent ---',
    '        // Build the handoff workflow');
  result = replaceSection(result, '                You are the Triage agent', '                """);',
    `                You are the Triage agent for an interview intake workflow.
                The only available specialist is "receptionist".
                Hand off session setup and document intake to the receptionist.
                If intake is already complete, explain that the interview specialists are not connected yet.
                Do not restart completed intake or route to unavailable specialists.
`);
  result = replaceOnce(result,
    `                5. Once document intake is complete, let the user know and hand off directly to "behavioural_interviewer"
                   to begin the interview. Only hand off to "triage" if the user wants to do something unexpected.`,
    `                5. Once document intake is complete, let the user know. Interview specialists are not connected yet.
                   Only hand off to "triage" if the user wants to do something unexpected.`);
  result = replaceSection(result, '        // --- Triage Agent ---', '        var triageAgent = ',
    '        // --- Triage Agent ---\n');
  result = replaceSection(result, '        // --- Receptionist Agent ---', '        var receptionistAgent = ',
    '        // --- Receptionist Agent ---\n');
  result = replaceSection(result, '        // Build the handoff workflow', '#pragma warning disable MAAIW001',
    '        // Connect only the two agents that exist at this checkpoint.\n');
  result = replaceSection(result, '                       .WithHandoffs(triageAgent,',
    '                       .Build();',
    `                       .WithHandoff(triageAgent, receptionistAgent)
                       .WithHandoff(receptionistAgent, triageAgent)
`);
  return result;
}

function interviewerHandoff(reference) {
  let result = sourceSlice(reference, anchors.workflow, '\n}\n');
  result = replaceSection(result, '        // --- Summariser Agent ---', '        // Build the handoff workflow');
  result = replaceSection(result, '                You are the Triage agent', '                """);',
    `                You route an interview between receptionist, behavioural_interviewer, and technical_interviewer.
                Handle the latest user request first, using earlier messages only as context.
                If the user supplies an answer, route to the interviewer who asked the latest question, even if they also want to finish.
                If the user wants to stop or finish, acknowledge their choice and end this turn without a handoff.
                Summary generation comes in the next lesson. Do not restart intake or an earlier interview phase.
                Honor an explicit request for behavioural or technical practice by routing to that interviewer.
                Route to receptionist only while intake is incomplete.
                Otherwise keep an answer with the interviewer who asked the latest question.
                After technical practice, ask whether the user wants more practice; wait for their choice.
`);
  result = replaceOnce(result,
    `                6. When done, hand off directly to "summariser" to generate the interview summary.
                   Only hand off to "triage" if the user wants to do something unexpected.`,
    `                6. If the user wants to finish, give brief feedback and acknowledge the end of practice.
                   Do not ask another question or hand off. Only hand off to "triage" for an unexpected request.`);
  result = replaceSection(result, '        // --- Triage Agent ---', '        var triageAgent = ', '        // --- Triage Agent ---\n');
  result = replaceSection(result, '        // --- Technical Interviewer Agent ---', '        var technicalAgent = ', '        // --- Technical Interviewer Agent ---\n');
  result = replaceSection(result, '        // Build the handoff workflow', '#pragma warning disable MAAIW001',
    '        // Connect the four available agents.\n');
  result = replaceSection(result, '                       .WithHandoffs(triageAgent,', '                       .Build();',
    `                       .WithHandoffs(triageAgent, [receptionistAgent, behaviouralAgent, technicalAgent])
                       .WithHandoffs(receptionistAgent, [behaviouralAgent, triageAgent])
                       .WithHandoffs(behaviouralAgent, [technicalAgent, triageAgent])
                       .WithHandoff(technicalAgent, triageAgent)
`);
  return result;
}

export const workshopModelCall = 'builder.AddWorkshopHosting();';
const devServicesStart = 'builder.Services.AddOpenAIResponses();';
const devComment = '// DevUI is intentionally mapped';
const devEnvironment = 'if (builder.Environment.IsDevelopment() == false)';
const openAIEndpoints = 'app.MapOpenAIResponses();\napp.MapOpenAIConversations();\n\n';
const indent = source => source.trimEnd().split('\n').map(line => line ? `        ${line}` : '').join('\n');

function workshopBootstrap(reference) {
  const imports = reference.slice(0, reference.indexOf('var builder = '));
  const model = sourceSlice(reference, anchors.model, anchors.agent);
  const services = sourceSlice(reference, devServicesStart, 'builder.Services.AddAGUIServer();');
  const endpoints = openAIEndpoints + sourceSlice(reference, devComment, devEnvironment);
  return `${imports}namespace InterviewCoach.Agent;

internal static class WorkshopHosting
{
    public static void AddWorkshopHosting(this WebApplicationBuilder builder)
    {
        var config = builder.Configuration;
${indent(model + services)}
    }

    public static void MapWorkshopDevUI(this WebApplication app)
    {
${indent(endpoints)}
    }
}
`;
}

const probe = `#:project ../src/InterviewCoach.Agent/InterviewCoach.Agent.csproj

using ModelContextProtocol.Client;
using Microsoft.Extensions.Logging.Abstractions;

if (args.Length != 1 || !Uri.TryCreate(args[0], UriKind.Absolute, out var endpoint)
    || (endpoint.Scheme != "http" && endpoint.Scheme != "https"))
{
    throw new ArgumentException("Supply the MCP server's full HTTP endpoint, including /mcp.");
}

using var http = new HttpClient();
var transport = new HttpClientTransport(new() { Endpoint = endpoint }, http, NullLoggerFactory.Instance);
await using var client = await McpClient.CreateAsync(transport);
foreach (var tool in await client.ListToolsAsync())
{
    Console.WriteLine(tool.Name);
}
`;

function cloudFreeHost(reference) {
  let host = replaceSection(reference, 'var mcpMarkItDown = ', 'var agent = ');
  for (const line of [
    '                   .WithLlmReference(config, args)\n',
    '                   .WithReference(mcpMarkItDown.GetEndpoint("http"))\n',
    '                   .WithReference(mcpInterviewData)\n',
    '                   .WaitFor(mcpMarkItDown)\n',
  ]) host = replaceOnce(host, line, '');
  return replaceOnce(host, '                   .WaitFor(mcpInterviewData);', ';');
}

const home = `@page "/"
<PageTitle>Interview Coach - workshop starter</PageTitle>
<section style="padding: 3rem; max-width: 48rem; margin: auto">
    <h1>Your application shell is running.</h1>
    <p>Coaching is not connected to this page yet.</p>
    <p>Next we'll create an agent and try a question in DevUI. Then we'll connect this chat page.</p>
    <p>This shell runs locally. The next lesson connects a model in Foundry.</p>
</section>
`;

export function makeStage(reference, id) {
  const index = stageIds.indexOf(id);
  if (index === -1) throw new Error(`Unknown checkpoint: ${id}`);
  const files = new Map(reference);
  const get = path => {
    if (!files.has(path)) throw new Error(`Missing reference file ${path}`);
    return files.get(path).toString('utf8');
  };
  const set = (path, value) => files.set(path, Buffer.from(value));
  const before = stage => index < stageIds.indexOf(stage);

  if (before('07-first-handoff')) {
    for (const path of paths.settings) {
      set(path, replaceOnce(get(path), '"AgentMode": "HandOff"', '"AgentMode": "Single"'));
    }
  }
  if (before('07-handoffs')) {
    const source = get(paths.factory);
    let factory = replaceSection(source, anchors.single, anchors.handoff, singleAgent(source, id));
    factory = replaceOnce(factory, source.slice(source.indexOf(anchors.handoff)),
      `    // ============================================================================
    // MODE 2: Handoff workflow.
${id === '07-first-handoff' ? initialHandoff(source) : id === '07-interviewers' ? interviewerHandoff(source) : `${anchors.workflow}
        => throw new NotSupportedException("Complete Make your first handoff before enabling the workflow.");
`}
}
`);
    if (before('07-first-handoff')) {
      factory = replaceSection(factory, anchors.adapter, anchors.provider,
        `${anchors.adapter}this IHostApplicationBuilder builder, string key, Func<IServiceProvider, string, Workflow> createWorkflowDelegate)
        => throw new NotSupportedException("Complete Make your first handoff before enabling the workflow.");

`);
    }
    if (id === '02-starter') {
      factory = replaceSection(factory, '        return new ChatClientAgent(', '    }\n\n    // ============================================================================\n    // MODE 1:',
        '        throw new NotSupportedException("Create the Foundry ChatClientAgent in the first-agent lesson.");\n');
    }
    set(paths.factory, factory);
  }

  if (before('06-document-extraction')) {
    set(paths.program, replaceSection(get(paths.program),
      'builder.Services.AddHttpClient("mcp-markitdown"', before('05-mcp-state')
        ? anchors.model : 'builder.Services.AddHttpClient("mcp-interview-data"'));
    for (const host of paths.hosts) {
      let source = replaceSection(get(host), 'var mcpMarkItDown = ', before('05-mcp-server') ? 'var agent = ' : '// Azure Cosmos DB');
      source = replaceOnce(source, '                   .WithReference(mcpMarkItDown.GetEndpoint("http"))\n', '');
      source = replaceOnce(source, '                   .WaitFor(mcpMarkItDown)\n', '');
      if (before('05-mcp-state')) {
        source = replaceOnce(source, '                   .WithReference(mcpInterviewData)\n', '');
        source = replaceOnce(source, '                   .WaitFor(mcpInterviewData);', ';');
      }
      set(host, source);
    }
  }
  if (before('05-mcp-server')) {
    let tools = replaceOnce(get(paths.tools), 'using ModelContextProtocol.Server;\n\n', '');
    tools = replaceOnce(tools, '[McpServerToolType]\n', '');
    for (const attribute of tools.match(/^    \[McpServerTool\([^\n]+\)\]\n/gm) ?? []) {
      tools = replaceOnce(tools, attribute, '');
    }
    set(paths.tools, tools);
    let server = replaceOnce(get(paths.server), 'using System.Reflection;\n\n', '');
    server = replaceSection(server, 'builder.Services.AddMcpServer()', 'var app = builder.Build();');
    server = replaceOnce(server, 'app.MapMcp("/mcp");\n\n', '');
    set(paths.server, server);
  }
  if (before('05-mcp-state')) set(paths.program, replaceOnce(replaceOnce(get(paths.program),
    'using ModelContextProtocol.Client;\n', ''), 'using ModelContextProtocol.Protocol;\n', ''));
  if (before('03-streaming')) {
    let program = replaceOnce(get(paths.program), 'using Microsoft.Agents.AI.Hosting.AGUI.AspNetCore;\n', '');
    program = replaceOnce(program, 'builder.Services.AddAGUIServer();\n\n', '');
    program = replaceOnce(program, 'app.MapAGUIServer(agentBuilder, "ag-ui");\n\n', '');
    set(paths.program, program);
    set(paths.home, home);
    set(paths.chat, replaceOnce(get(paths.chat), '@page "/"', '@page "/chat"'));
  }
  if (id === '02-starter') {
    let program = replaceSection(get(paths.program), anchors.model, 'var app = builder.Build();');
    program = replaceSection(program, 'app.MapOpenAIResponses();', 'if (builder.Environment.IsDevelopment()');
    for (const line of [
      'using System.ClientModel.Primitives;\n', 'using System.Data.Common;\n', 'using Azure.Identity;\n',
      'using InterviewCoach.Agent;\n', 'using Microsoft.Agents.AI;\n',
      'using Microsoft.Agents.AI.DevUI;\n', 'using Microsoft.Extensions.AI;\n',
      'using OpenAI;\n', 'using OpenAI.Chat;\n',
    ]) program = replaceOnce(program, line, '');
    program = 'using System.Collections.Concurrent;\n\n' + program.slice(program.indexOf('var builder = '));
    set(paths.program, program);
    for (const host of paths.hosts) {
      set(host, replaceOnce(get(host), '                   .WithLlmReference(config, args)\n', ''));
    }
  }
  if (before('08-complete')) {
    if (id === '07-handoffs') {
      set(paths.factory, replaceSection(get(paths.factory), anchors.handoff, anchors.workflow,
        '    // ============================================================================\n    // MODE 2: Handoff workflow.\n'));
    }
    const referenceProgram = reference.get(paths.program).toString('utf8');
    let program = get(paths.program);
    if (id !== '02-starter') {
      program = replaceSection(program, anchors.model, anchors.agent, `${workshopModelCall}\n\n`);
      program = replaceOnce(program, sourceSlice(referenceProgram, devServicesStart, 'builder.Services.AddAGUIServer();'), '');
      program = replaceOnce(program, openAIEndpoints, 'app.MapWorkshopDevUI();\n\n');
      program = replaceOnce(program, sourceSlice(referenceProgram, devComment, devEnvironment), '');
    }
    const imports = [
      'using System.Collections.Concurrent;',
      'using InterviewCoach.Agent;',
      ...(before('03-streaming') ? [] : ['using Microsoft.Agents.AI.Hosting.AGUI.AspNetCore;']),
      ...(before('05-mcp-state') ? [] : ['using ModelContextProtocol.Client;', 'using ModelContextProtocol.Protocol;']),
    ];
    program = imports.join('\n') + '\n\n' + program.slice(program.indexOf('var builder = '));
    set(paths.program, program);
    set(paths.bootstrap, workshopBootstrap(referenceProgram));
    set(paths.probe, probe);
    set(paths.hosts[1], cloudFreeHost(reference.get(paths.hosts[1]).toString('utf8')));
    set(paths.settings[1], replaceOnce(reference.get(paths.settings[1]).toString('utf8'), '"AgentMode": "HandOff"', '"AgentMode": "Single"'));
  }
  return files;
}
