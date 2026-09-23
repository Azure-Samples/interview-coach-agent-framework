const shellLanguages = new Set([
  'bash', 'powershell', 'sh', 'shell', 'ps1', 'pwsh', 'console', 'zsh', 'ksh',
  'fish', 'bat', 'batch', 'cmd', 'dos', 'shell-session', 'terminal'
]);
const openingFence = /^([ \t]*(?:>[ \t]*)*(?:(?:[-+*]|\d+[.)])[ \t]+)?)(`{3,}|~{3,})([^\r\n]*)\r?\n?$/;

// Canonicals use adjacent top-level bash/powershell fences, with only blank lines
// between them. Shell-name comments keep the pair labeled on GitHub as well.
export function transformReferenceShellTabs(markdown, source = '<reference>') {
  const lines = markdown.split(/(?<=\n)/);
  const fences = [];
  const fail = (line, message) => {
    throw new Error(`${source}:${line}: ${message} Use adjacent bash then powershell fences; author both shells explicitly.`);
  };
  let offset = 0;
  for (let index = 0; index < lines.length; index++) {
    const opening = lines[index].match(openingFence);
    if (!opening) {
      offset += lines[index].length;
      continue;
    }
    const [, prefix, marker, info] = opening;
    if (marker[0] === '`' && info.includes('`')) {
      offset += lines[index].length;
      continue;
    }
    const language = info.trim().split(/\s+/)[0];
    const shell = shellLanguages.has(language.toLowerCase());
    if (shell && prefix) fail(index + 1, 'Shell fences must be top-level (not indented, quoted, or in a list).');
    if (shell && language !== 'bash' && language !== 'powershell') {
      fail(index + 1, `Unsupported shell fence "${language}".`);
    }
    const closingPrefix = prefix.includes('>') ? '[ \\t]*(?:>[ \\t]*)*' : '[ \\t]*';
    const closingFence = new RegExp(`^${closingPrefix}${marker[0]}{${marker.length},}[ \\t]*\\r?\\n?$`);
    let end = index + 1;
    while (end < lines.length && !closingFence.test(lines[end])) end++;
    if (end === lines.length) {
      if (shell) fail(index + 1, `Unclosed ${language} fence.`);
      break;
    }
    const raw = lines.slice(index, end + 1).join('');
    const code = lines.slice(index + 1, end).join('');
    if (shell && !code.trim()) fail(index + 1, `Empty ${language} fence.`);
    fences.push({ language, shell, start: offset, end: offset + raw.length, line: index + 1, raw });
    offset += raw.length;
    index = end;
  }

  const newline = markdown.includes('\r\n') ? '\r\n' : '\n';
  const chunks = [];
  let cursor = 0;
  for (let index = 0; index < fences.length; index++) {
    const bash = fences[index];
    if (!bash.shell) continue;
    if (bash.language !== 'bash') fail(bash.line, 'A PowerShell fence must follow its Bash fence, not stand alone or come first.');
    const powershell = fences[index + 1];
    if (!powershell || powershell.language !== 'powershell'
      || !/^[ \t\r\n]*$/.test(markdown.slice(bash.end, powershell.start))) {
      fail(bash.line, 'A Bash fence must be immediately followed by one PowerShell fence (blank lines only).');
    }
    const tab = (label, fence) => [
      `<TabItem label="${label}">`, '', fence.raw.replace(/\r?\n$/, ''), '', '</TabItem>'
    ].join(newline);
    chunks.push(markdown.slice(cursor, bash.start), [
      '<Tabs syncKey="shell">', tab('Bash', bash), tab('PowerShell', powershell), '</Tabs>'
    ].join(newline), powershell.raw.endsWith('\n') ? newline : '');
    cursor = powershell.end;
    index++;
  }
  if (!chunks.length) return { content: markdown, extension: '.md' };
  chunks.push(markdown.slice(cursor));
  return { content: chunks.join(''), extension: '.mdx' };
}
