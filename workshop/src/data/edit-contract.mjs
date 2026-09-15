import { readFileSync } from 'node:fs';

/**
 * @typedef {{id:string,title:string,file:string,operation:'replace'|'create'|'delete',
 * ownership:'learner'|'supplied',before:string,after:string,location:import('../../labs/edit-location.mjs').EditLocation,
 * beforeStartLine?:number|null,afterStartLine?:number|null}} EditStep
 * @typedef {{from:string,to:string,steps:EditStep[],changedFiles:string[]}} Transition
 * @typedef {{version:1,sourceRevision:string,transitions:Transition[]}} EditContract
 */

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function record(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** @param {unknown} value @returns {asserts value is EditContract} */
export function validateEditContract(value) {
  if (!record(value) || value.version !== 1 || typeof value.sourceRevision !== 'string' || !Array.isArray(value.transitions)) {
    throw new Error('Invalid workshop edit contract. Regenerate it with npm run prepare:content.');
  }
  const ids = new Set();
  for (const transition of value.transitions) {
    if (!record(transition) || typeof transition.from !== 'string' || typeof transition.to !== 'string' ||
        !Array.isArray(transition.steps) || !Array.isArray(transition.changedFiles) ||
        !transition.changedFiles.every(file => typeof file === 'string')) {
      throw new Error('Invalid transition in the workshop edit contract.');
    }
    for (const step of transition.steps) {
      if (!record(step) || !['id', 'title', 'file', 'before', 'after'].every(key => typeof step[key] === 'string') ||
          typeof step.operation !== 'string' || !['replace', 'create', 'delete'].includes(step.operation) ||
          typeof step.ownership !== 'string' || !['learner', 'supplied'].includes(step.ownership)) {
        throw new Error(`Invalid edit step in transition ${transition.from} -> ${transition.to}.`);
      }
      const id = String(step.id);
      const file = String(step.file);
      if (!/^[a-z0-9][a-z0-9-]*$/.test(id) || ids.has(id)) throw new Error(`Invalid or duplicate edit-step ID: ${id}`);
      ids.add(id);
      if (!file || file.startsWith('/') || file.includes('\\') || file.split('/').includes('..')) {
        throw new Error(`Edit step ${id} has an invalid file path.`);
      }
      if (step.operation !== 'create' && !step.before) throw new Error(`Edit step ${id} has no source to locate.`);
      if (step.operation === 'create' && !step.after) throw new Error(`Edit step ${id} has no resulting code.`);
      if (step.operation === 'replace' && step.before === step.after) throw new Error(`Edit step ${id} does not change its source.`);
      if (step.operation === 'delete' && step.after !== '') throw new Error(`Deleted file ${file} must not have resulting code.`);
      if (step.operation === 'create' && step.before !== '') throw new Error(`New file ${file} must not have previous code.`);
      if (!record(step.location) || !['function', 'type', 'file', 'imports', 'top-level'].includes(String(step.location.kind)) ||
          (['function', 'type'].includes(String(step.location.kind))
            ? typeof step.location.name !== 'string' || !/^[A-Za-z_]\w*$/.test(step.location.name)
            : step.location.name !== undefined)) {
        throw new Error(`Edit step ${id} has an invalid source location. Regenerate it with npm run prepare:content.`);
      }
      if ((step.operation === 'create' || step.operation === 'delete') && step.location.kind !== 'file') {
        throw new Error(`Whole-file edit ${id} must have a file location.`);
      }
    }
  }
}

/** @returns {EditContract} */
export function readEditContract() {
  /** @type {unknown} */
  const contract = JSON.parse(readFileSync(new URL('../../.generated/edit-contract.json', import.meta.url), 'utf8'));
  validateEditContract(contract);
  return contract;
}

/** @param {EditContract} contract */
export function flattenEdits(contract) {
  return contract.transitions.flatMap(({ from, to, steps }) => steps.map(step => ({ ...step, from, to, path: step.file })));
}
