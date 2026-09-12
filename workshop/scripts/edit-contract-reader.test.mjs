import test from 'node:test';
import assert from 'node:assert/strict';
import { validateEditContract, flattenEdits } from '../src/data/edit-contract.mjs';

const contract = () => ({
  version: 1,
  sourceRevision: 'test-reference',
  transitions: [{
    from: 'starter',
    to: 'first-agent',
    changedFiles: ['src/Agent.cs'],
    steps: [{
      id: 'create-agent',
      title: 'Create the agent',
      file: 'src/Agent.cs',
      operation: 'replace',
      ownership: 'learner',
      location: { kind: 'function', name: 'CreateAgent' },
      before: 'throw new NotSupportedException();',
      after: 'return agent;'
    }]
  }]
});

test('edit metadata is read with its transition and source file', () => {
  const value = contract();
  validateEditContract(value);
  assert.deepEqual(flattenEdits(value).map(({ id, from, to, path }) => ({ id, from, to, path })),
    [{ id: 'create-agent', from: 'starter', to: 'first-agent', path: 'src/Agent.cs' }]);
});

test('invalid metadata and duplicate step IDs fail instead of hiding code', () => {
  assert.throws(() => validateEditContract({}), /Invalid workshop edit contract/);
  const value = contract();
  value.transitions[0].steps.push({ ...value.transitions[0].steps[0] });
  assert.throws(() => validateEditContract(value), /duplicate edit-step ID/);
});

test('edit file paths cannot escape the source tree', () => {
  for (const file of ['/tmp/file.cs', '../file.cs', 'src/../../file.cs', 'src\\file.cs']) {
    const value = contract();
    value.transitions[0].steps[0].file = file;
    assert.throws(() => validateEditContract(value), /invalid file path/);
  }
});

test('create, replace and delete operations have explicit code invariants', () => {
  let value = contract();
  value.transitions[0].steps[0].operation = 'create';
  value.transitions[0].steps[0].before = '';
  value.transitions[0].steps[0].after = '';
  assert.throws(() => validateEditContract(value), /no resulting code/);
  value = contract();
  value.transitions[0].steps[0].operation = 'create';
  assert.throws(() => validateEditContract(value), /previous code/);
  value = contract();
  value.transitions[0].steps[0].operation = 'delete';
  assert.throws(() => validateEditContract(value), /must not have resulting code/);
});

test('replacing a nonempty block with empty text removes only that block', () => {
  const value = contract();
  value.transitions[0].steps[0].after = '';
  assert.doesNotThrow(() => validateEditContract(value));
  assert.equal(flattenEdits(value)[0].operation, 'replace');
  value.transitions[0].steps[0].after = value.transitions[0].steps[0].before;
  assert.throws(() => validateEditContract(value), /does not change/);
});

test('locations survive the reader without inventing a function for file-level edits', () => {
  for (const location of [
    { kind: 'function', name: 'CreateSingleAgent' }, { kind: 'type', name: 'AgentDelegateFactory' },
    { kind: 'file' }, { kind: 'imports' }, { kind: 'top-level' }
  ]) {
    const value = contract();
    value.transitions[0].steps[0].location = location;
    validateEditContract(value);
    assert.deepEqual(flattenEdits(value)[0].location, location);
  }
});

test('missing, guessed, and malformed source locations fail explicitly', () => {
  for (const location of [
    undefined, null, {}, 'CreateAgent', { kind: 'unknown' }, { kind: 'function' },
    { kind: 'function', name: '' }, { kind: 'type', name: 'Agent.cs' },
    { kind: 'file', name: 'Program' }, { kind: 'function', name: 'CreateAgent()' }
  ]) {
    const value = contract();
    value.transitions[0].steps[0].location = location;
    assert.throws(() => validateEditContract(value), /invalid source location/);
  }
});

test('file creation and deletion cannot claim an enclosing function', () => {
  for (const operation of ['create', 'delete']) {
    const value = contract();
    const step = value.transitions[0].steps[0];
    step.operation = operation;
    if (operation === 'create') step.before = '';
    else step.after = '';
    assert.throws(() => validateEditContract(value), /must have a file location/);
    step.location = { kind: 'file' };
    assert.doesNotThrow(() => validateEditContract(value));
  }
});
