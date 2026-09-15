export function normalizeCheckpointPatch(patch, previous, next) {
  for (const folder of [previous, next]) {
    for (const side of ['a', 'b']) {
      patch = patch.replaceAll(`${side}${folder}/`, `${side}/`)
        .replaceAll(`${side}/${folder}/`, `${side}/`);
    }
  }
  return patch;
}

export function sourceOnlyPatch(patch, changedFiles) {
  const expected = new Set(changedFiles);
  const seen = new Set();
  const sections = patch.split(/(?=^diff --git )/m).filter(section => section.trim());
  const source = [];
  for (const section of sections) {
    const header = section.match(/^diff --git a\/([^\n]+) b\/([^\n]+)\n/);
    if (!header || header[1] !== header[2]) throw new Error('Unexpected checkpoint patch header.');
    const file = header[1];
    if (file === 'WORKSHOP.txt') continue;
    if (!expected.has(file) || seen.has(file)) throw new Error(`Unexpected support patch file: ${file}`);
    seen.add(file);
    source.push(section);
  }
  if (seen.size !== expected.size) throw new Error('The support patch does not cover every declared source change.');
  return source.join('');
}
