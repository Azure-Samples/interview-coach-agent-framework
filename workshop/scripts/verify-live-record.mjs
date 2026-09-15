import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const endpoint = new URL(process.argv[2] ?? 'http://localhost:5141/mcp');
if (!['http:', 'https:'].includes(endpoint.protocol)) throw new Error('Supply the InterviewData HTTP /mcp endpoint.');
const readId = process.argv[3];
if (readId !== undefined && !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(readId)) {
  throw new Error('The optional second argument must be a session GUID to read without writing.');
}
let requestId = 0;
async function rpc(method, params) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2025-06-18' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++requestId, method, params }),
    signal: AbortSignal.timeout(60000),
  });
  assert.equal(response.ok, true, `${method}: HTTP ${response.status}`);
  const body = await response.text();
  const messages = response.headers.get('content-type')?.includes('text/event-stream')
    ? body.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => JSON.parse(line.slice(5)))
    : [JSON.parse(body)];
  const message = messages.find(item => item.id === requestId);
  assert.ok(message, `No result for ${method}`);
  assert.equal(message.error, undefined, JSON.stringify(message.error));
  return message.result;
}
const text = result => (result.content ?? []).filter(item => item.type === 'text').map(item => item.text).join('\n');
async function call(name, args) {
  return rpc('tools/call', { name, arguments: args });
}
async function record(name, args) {
  const result = await call(name, args);
  assert.notEqual(result.isError, true, `${name}: ${text(result)}`);
  const value = result.structuredContent ?? JSON.parse(text(result));
  assert.ok(value && typeof value === 'object', `${name}: No interview record was returned.`);
  return Object.fromEntries(Object.entries(value).map(([key, value]) => [key.toLowerCase(), value]));
}

await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'workshop-record-check', version: '1.0' } });
const initialized = await fetch(endpoint, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2025-06-18' },
  body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
  signal: AbortSignal.timeout(60000),
});
assert.equal(initialized.ok, true, `notifications/initialized: HTTP ${initialized.status}`);
const listed = await rpc('tools/list', {});
assert.equal(listed.tools.length, 5);
if (readId) {
  const saved = await record('get_interview_session', { id: readId });
  assert.equal(saved.id.toLowerCase(), readId.toLowerCase());
  console.log(JSON.stringify(saved, null, 2));
} else {
  const id = randomUUID();
  const first = {
    Id: id, ResumeText: 'Fictional workshop validation: C# web APIs',
    JobDescriptionText: 'Synthetic backend developer role', Transcript: 'First synthetic answer',
    ProceedWithoutResume: false, ProceedWithoutJobDescription: false,
  };
  const missing = await call('update_interview_session', { record: first });
  assert.equal(missing.isError, true, 'Updating a missing record must be a tool error.');
  assert.match(text(missing), /add_interview_session/, 'The model must receive actionable recovery instructions.');
  assert.equal((await record('add_interview_session', { record: first })).id, id);
  const second = { ...first, Transcript: 'Second synthetic answer', IsCompleted: true };
  await record('update_interview_session', { record: second });
  const saved = await record('get_interview_session', { id });
  assert.equal(saved.id, id);
  assert.equal(saved.resumetext, first.ResumeText);
  assert.equal(saved.jobdescriptiontext, first.JobDescriptionText);
  assert.equal(saved.iscompleted, false, 'Only the completion tool can complete an existing record.');
  assert.equal(saved.transcript.split(first.Transcript).length - 1, 1);
  assert.equal(saved.transcript.split(second.Transcript).length - 1, 1);
  await record('complete_interview_session', { id });
  assert.equal((await record('get_interview_session', { id })).iscompleted, true);
  console.log(`Verified real MCP create/update/read-back/completion for synthetic record ${id}.`);
}
