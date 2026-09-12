/**
 * @typedef {{kind:'function'|'type',name:string}|{kind:'file'|'imports'|'top-level'}} EditLocation
 */

// Preserve offsets while ignoring braces and declarations inside comments and C# strings.
function maskNonCode(source) {
  const masked = source.split('');
  const hide = (start, end) => {
    for (let i = start; i < end; i++) if (!/[\r\n]/.test(source[i])) masked[i] = ' ';
  };
  for (let i = 0; i < source.length;) {
    const start = i;
    if (source.startsWith('//', i)) {
      i = source.indexOf('\n', i);
      if (i < 0) i = source.length;
    } else if (source.startsWith('/*', i)) {
      const end = source.indexOf('*/', i + 2);
      if (end < 0) throw new Error('Unclosed C# comment in edit-location source.');
      i = end + 2;
    } else if (source[i] === '"' || source[i] === "'") {
      const quote = source[i];
      const raw = quote === '"' ? source.slice(i).match(/^"{3,}/)?.[0] : undefined;
      if (raw) {
        const end = source.indexOf(raw, i + raw.length);
        if (end < 0) throw new Error('Unclosed raw string in edit-location source.');
        i = end + raw.length;
      } else {
        const verbatim = quote === '"' && (source[i - 1] === '@' || source.slice(i - 2, i) === '@$');
        i++;
        let closed = false;
        while (i < source.length) {
          if (source[i] === quote) {
            if (verbatim && source[i + 1] === quote) { i += 2; continue; }
            i++;
            closed = true;
            break;
          }
          i += !verbatim && source[i] === '\\' ? 2 : 1;
        }
        if (!closed) throw new Error('Unclosed C# string in edit-location source.');
      }
    } else { i++; continue; }
    hide(start, i);
  }
  return masked.join('');
}

function declarations(source) {
  const masked = maskNonCode(source);
  const pairs = new Map();
  const stack = [];
  for (let i = 0; i < masked.length; i++) {
    if ('({['.includes(masked[i])) stack.push(i);
    else if (')}]'.includes(masked[i])) {
      const opening = stack.pop();
      if (opening === undefined || '({['.indexOf(masked[opening]) !== ')}]'.indexOf(masked[i])) {
        throw new Error('Unbalanced C# delimiters in edit-location source.');
      }
      pairs.set(opening, i);
      pairs.set(i, opening);
    }
  }
  if (stack.length) throw new Error('Unbalanced C# delimiters in edit-location source.');
  const skipSpace = start => {
    while (/\s/.test(masked[start] ?? '') && start < masked.length) start++;
    return start;
  };
  const withAttributes = start => {
    let previous = start - 1;
    while (previous >= 0 && /\s/.test(masked[previous])) previous--;
    while (masked[previous] === ']' && pairs.has(previous)) {
      start = pairs.get(previous);
      previous = start - 1;
      while (previous >= 0 && /\s/.test(masked[previous])) previous--;
    }
    return start;
  };
  const scopes = [];
  for (const match of masked.matchAll(/\b(?:class|struct|interface|enum|record(?:\s+(?:class|struct))?)\s+([A-Za-z_]\w*)/g)) {
    let body = match.index + match[0].length;
    while (body < masked.length && !'{;'.includes(masked[body])) {
      body = masked[body] === '(' ? pairs.get(body) + 1 : body + 1;
    }
    if (masked[body] === '{' && pairs.has(body)) {
      const lineStart = masked.lastIndexOf('\n', match.index) + 1;
      scopes.push({ kind: 'type', name: match[1], start: withAttributes(lineStart), end: pairs.get(body) + 1 });
    }
  }
  // This intentionally recognizes declarations, not calls, and falls back to a
  // containing type/file for syntax outside the workshop's method signatures.
  const method = /^[ \t]*[A-Za-z_][\w@.<>,?[\] \t]*[ \t]+([A-Za-z_]\w*)(?:<[^()\n]+>)?[ \t]*\(/gm;
  for (const match of masked.matchAll(method)) {
    const header = match[0].trim();
    if (/\b(?:return|throw|new|await|using|class|struct|record|interface|delegate)\b/.test(header)) continue;
    const opening = match.index + match[0].lastIndexOf('(');
    if (!pairs.has(opening)) continue;
    let body = skipSpace(pairs.get(opening) + 1);
    if (masked.startsWith('where ', body)) {
      while (body < masked.length && !'{;='.includes(masked[body])) body++;
    }
    let end;
    if (masked[body] === '{') end = pairs.get(body) + 1;
    else if (masked.startsWith('=>', body)) {
      body += 2;
      while (body < masked.length && masked[body] !== ';') {
        body = '({['.includes(masked[body]) ? pairs.get(body) + 1 : body + 1;
      }
      if (masked[body] === ';') end = body + 1;
    } else if (masked[body] === ';') end = body + 1;
    if (end !== undefined) {
      scopes.push({ kind: 'function', name: match[1], start: withAttributes(match.index), end });
    }
  }
  return { masked, scopes };
}

function uniqueIndex(source, snippet, label) {
  const index = source.indexOf(snippet);
  if (!snippet || index < 0 || source.indexOf(snippet, index + 1) !== -1) {
    throw new Error(`Missing or ambiguous ${label} anchor for edit location.`);
  }
  return index;
}

function changedRanges(before, after) {
  let prefix = 0;
  while (prefix < Math.min(before.length, after.length) && before[prefix] === after[prefix]) prefix++;
  let suffix = 0;
  while (suffix < Math.min(before.length, after.length) - prefix &&
         before[before.length - suffix - 1] === after[after.length - suffix - 1]) suffix++;
  return [[prefix, before.length - suffix], [prefix, after.length - suffix]];
}

function enclosingScopes(source, offset, range) {
  const { masked, scopes } = declarations(source);
  let start = offset + range[0];
  let end = offset + range[1];
  // Ignore anchors and trailing comments outside the changed declaration.
  const code = masked.slice(start, end);
  if (code.trim()) {
    start += code.search(/\S/);
    end = offset + range[0] + code.trimEnd().length;
  } else {
    while (start < end && /\s/.test(source[start])) start++;
    while (end > start && /\s/.test(source[end - 1])) end--;
  }
  const inside = scopes.filter(scope => scope.start <= start && scope.end >= end)
    .sort((a, b) => a.kind !== b.kind ? (a.kind === 'function' ? -1 : 1)
      : a.kind === 'function' ? (b.end - b.start) - (a.end - a.start)
      : (a.end - a.start) - (b.end - b.start));
  const imports = [...masked.matchAll(/^[ \t]*(?:global\s+)?using[ \t]+(?:static[ \t]+)?[\w.:]+(?:[ \t]*=[^;\n]+)?[ \t]*;/gm)];
  const importStart = imports[0]?.index;
  const importEnd = imports.at(-1)?.index + (imports.at(-1)?.[0].length ?? 0);
  if (importStart !== undefined && start >= importStart && end <= importEnd &&
      !masked.slice(importStart, importEnd).replace(/^[ \t]*(?:global\s+)?using[^\n;]*;/gm, '').trim()) {
    return [{ kind: 'imports' }];
  }
  if (!inside.length) {
    const touchesType = scopes.some(scope => scope.kind === 'type' && scope.start < end && scope.end > start);
    const outsideTypes = masked.split('');
    for (const scope of scopes.filter(scope => scope.kind === 'type')) {
      outsideTypes.fill(' ', scope.start, scope.end);
    }
    const hasTopLevelStatements = /^[ \t]*(?:var[ \t]+\w+[ \t]*=|await[ \t]+|[A-Za-z_][\w.]*[ \t]*\()/m.test(outsideTypes.join(''));
    return [{ kind: !touchesType && hasTopLevelStatements ? 'top-level' : 'file' }];
  }
  return inside.map(({ kind, name }) => ({ kind, name }));
}

/**
 * Locate the changed text in full, replayable source, never by guessing from an
 * excerpt's first method or by maintaining hand-written generated metadata.
 * @param {{file:string,operation:string,before:string,after:string,beforeSource:string,afterSource:string}} edit
 * @returns {EditLocation}
 */
export function deriveEditLocation({ file, operation, before, after, beforeSource, afterSource }) {
  if (operation === 'create') {
    if (beforeSource !== '' || before !== '' || !after || after !== afterSource) {
      throw new Error(`Invalid create source for edit location: ${file}`);
    }
    return { kind: 'file' };
  }
  const offset = uniqueIndex(beforeSource, before, 'before');
  if (operation === 'delete') {
    if (before !== beforeSource || after !== '' || afterSource !== '') {
      throw new Error(`Invalid delete source for edit location: ${file}`);
    }
    return { kind: 'file' };
  }
  if (operation !== 'replace' || before === after) throw new Error(`Invalid location edit: ${file}`);
  if (!file.endsWith('.cs')) return { kind: 'file' };
  const [beforeRange, afterRange] = changedRanges(before, after);
  // Some steps build an intermediate method body not yet present in the final
  // checkpoint. Replay that step to obtain its real after-source in those cases.
  const targetIndex = after ? afterSource.indexOf(after) : -1;
  const inTarget = targetIndex >= 0 && afterSource.indexOf(after, targetIndex + 1) === -1;
  const liveAfter = inTarget ? afterSource : beforeSource.slice(0, offset) + after + beforeSource.slice(offset + before.length);
  const candidates = [];
  if (beforeRange[0] !== beforeRange[1]) candidates.push(enclosingScopes(beforeSource, offset, beforeRange));
  if (afterRange[0] !== afterRange[1]) candidates.push(enclosingScopes(liveAfter, inTarget ? targetIndex : offset, afterRange));
  const common = candidates[0].find(scope =>
    candidates.every(items => items.some(item => item.kind === scope.kind && item.name === scope.name)));
  return common ?? { kind: 'file' };
}
