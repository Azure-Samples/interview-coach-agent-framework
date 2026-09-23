import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';
import { markdownToMdast, mdxToMdast, mdxToJs } from 'satteri';
import { transformReferenceShellTabs } from './reference-shell-tabs.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const docs = resolve(root, 'docs');
const imports = "import { Tabs, TabItem } from '@astrojs/starlight/components';\n\n";
const shellLanguages = new Set([
  'bash', 'powershell', 'sh', 'shell', 'ps1', 'pwsh', 'console', 'zsh', 'ksh',
  'fish', 'bat', 'batch', 'cmd', 'dos', 'shell-session', 'terminal'
]);
const fence = (language, code = 'tool --version', marker = '```') => `${marker}${language}\n${code}\n${marker}\n`;
const pair = (bash = 'tool --version', powershell = bash) => `${fence('bash', bash)}\n${fence('powershell', powershell)}`;
const walk = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry =>
  entry.isDirectory() ? walk(resolve(directory, entry.name)) : [resolve(directory, entry.name)]);
const nodes = tree => [tree, ...(tree.children ?? []).flatMap(nodes)];
const markdownTree = source => markdownToMdast(source);
const mdxTree = source => mdxToMdast(source);
const shellNodes = source => nodes(markdownTree(source))
  .filter(node => node.type === 'code' && shellLanguages.has(node.lang?.toLowerCase()));
const canonicals = walk(docs).filter(path => path.endsWith('.md')).map(path => ({
  path, source: readFileSync(path, 'utf8')
}));

test('an explicit pair becomes native synchronized tabs without deduplicating identical commands', () => {
  const result = transformReferenceShellTabs(`Before.\n\n${pair()}After.\n`);
  assert.deepEqual(result, {
    extension: '.mdx',
    content: `Before.\n
<Tabs syncKey="shell">
<TabItem label="Bash">

\`\`\`bash
tool --version
\`\`\`

</TabItem>
<TabItem label="PowerShell">

\`\`\`powershell
tool --version
\`\`\`

</TabItem>
</Tabs>
After.
`
  });
});

test('shell-specific environment, continuation, and redirection syntax is preserved, not inferred', () => {
  const bash = 'export EXAMPLE="value"\ntool \\\n  --input "$EXAMPLE" > output.txt';
  const powershell = '$env:EXAMPLE = "value"\ntool `\n  --input "$env:EXAMPLE" > output.txt';
  const { content } = transformReferenceShellTabs(pair(bash, powershell));
  assert.ok(content.includes(fence('bash', bash)));
  assert.ok(content.includes(fence('powershell', powershell)));
});

test('multiple examples keep surrounding prose, links, inline code, and other code intact', () => {
  const prose = '## Settings\n\nUse `GET /{id}` and `List<T>`; [details](PLAIN.md#details).\n\n';
  const json = fence('json', '{"literal": "{value}", "element": "<item>"}');
  const source = `${prose}${pair('tool first')}\n${json}\n${prose}${pair('tool second')}`;
  const { content } = transformReferenceShellTabs(source);
  assert.equal(content.split('<Tabs syncKey="shell">').length - 1, 2);
  assert.equal(content.split(prose).length - 1, 2);
  assert.ok(content.includes(json));
});

test('references without shell examples remain unchanged Markdown, including raw HTML and braces', () => {
  for (const source of ['', '# Plain\n\n<div>Literal {value}</div>\n', fence('json', '{"shell": "bash"}')]) {
    assert.deepEqual(transformReferenceShellTabs(source), { content: source, extension: '.md' });
  }
});

test('fence-like text inside another code block is not interpreted as shell examples', () => {
  const source = fence('text', `${pair()}\n~~~sh\nnot a command\n~~~`, '````');
  assert.deepEqual(transformReferenceShellTabs(source), { content: source, extension: '.md' });
});

test('fence metadata, longer markers, and tilde fences survive conversion', () => {
  const bash = fence('bash title="Example"', 'tool --version', '````').replace(/````\n$/, '`````\n');
  const powershell = fence('powershell title="Example"', 'tool --version', '~~~');
  const { content, extension } = transformReferenceShellTabs(`${bash}\n${powershell}`);
  assert.equal(extension, '.mdx');
  assert.ok(content.includes(bash));
  assert.ok(content.includes(powershell));
});

test('CRLF and missing final newlines do not change shell bodies or drop trailing text', () => {
  const source = pair().replaceAll('\n', '\r\n').trimEnd();
  const { content } = transformReferenceShellTabs(source);
  assert.ok(content.includes('```bash\r\ntool --version\r\n```'));
  assert.ok(content.includes('```powershell\r\ntool --version\r\n```'));
  assert.doesNotMatch(content, /(?<!\r)\n/);
  assert.ok(content.endsWith('</Tabs>'));
});

const invalid = [
  ['lone Bash', fence('bash')],
  ['lone PowerShell', fence('powershell')],
  ['reversed shells', fence('powershell') + fence('bash')],
  ['duplicate Bash', fence('bash') + fence('bash') + fence('powershell')],
  ['duplicate PowerShell', pair() + fence('powershell')],
  ['a later lone fence', pair() + fence('bash')],
  ['intervening prose', fence('bash') + '\nExplanation.\n\n' + fence('powershell')],
  ['intervening label', fence('bash') + '\n**PowerShell**\n\n' + fence('powershell')],
  ['intervening comment', fence('bash') + '\n<!-- separate -->\n\n' + fence('powershell')],
  ['intervening code', fence('bash') + fence('json', '{}') + fence('powershell')],
  ['unclosed Bash', '```bash\ntool --version\n'],
  ['unclosed PowerShell', fence('bash') + '```powershell\ntool --version\n'],
  ['a shorter closing marker', '````bash\ntool --version\n```\n'],
  ['empty Bash', pair('')],
  ['empty PowerShell', pair('tool --version', ' \t')],
  ['quoted shell fences', pair().replace(/^/gm, '> ')],
  ['list shell fences', '- ' + pair()],
  ['indented shell fences', pair().replace(/^/gm, '  ')],
  ...[...shellLanguages].filter(language => !['bash', 'powershell'].includes(language))
    .map(language => [`the ${language} alias`, fence(language)]),
  ['uppercase shell names', fence('BASH')]
];
for (const [name, source] of invalid) {
  test(`rejects ${name} with the source path and an actionable pairing error`, () => {
    assert.throws(() => transformReferenceShellTabs(source, 'docs/EXAMPLE.md'), error => {
      assert.match(error.message, /^docs\/EXAMPLE\.md:\d+: /);
      assert.match(error.message, /adjacent bash then powershell fences; author both shells explicitly/);
      return true;
    });
  });
}

test('errors identify the original source line after prose and unrelated fences', () => {
  assert.throws(
    () => transformReferenceShellTabs(`# Title\n\n${fence('json', '{}')}\n${fence('bash')}`, 'docs/EXAMPLE.md'),
    /docs\/EXAMPLE\.md:7:/
  );
});

test('all canonical shell examples are paired, labeled for GitHub, and retain identical command arguments', () => {
  const inventory = {};
  for (const { path, source } of canonicals) {
    const shells = shellNodes(source);
    const result = transformReferenceShellTabs(source, relative(root, path));
    assert.equal(result.extension, shells.length ? '.mdx' : '.md', path);
    if (!shells.length) continue;
    inventory[relative(docs, path).replaceAll('\\', '/')] = shells.length / 2;
    assert.equal(shells.length % 2, 0, path);
    for (let index = 0; index < shells.length; index += 2) {
      const bash = shells[index];
      const powershell = shells[index + 1];
      assert.equal(bash.lang, 'bash', path);
      assert.equal(powershell.lang, 'powershell', path);
      assert.match(bash.value, /^# Bash\n/);
      assert.match(powershell.value, /^# PowerShell\n/);
      assert.equal(bash.value.replace(/^# Bash\n/, ''), powershell.value.replace(/^# PowerShell\n/, ''), path);
    }
  }
  assert.deepEqual(inventory, {
    'CONFIGURATION.md': 1,
    'DEPLOYMENT.md': 6,
    'MULTI-AGENT.md': 1,
    'providers/GITHUB-COPILOT.md': 5,
    'providers/MICROSOFT-FOUNDRY.md': 2,
    'providers/README.md': 1
  });
});

test('every transformed canonical compiles as MDX with unchanged code, headings, and ordinary prose', () => {
  for (const { path, source } of canonicals) {
    const result = transformReferenceShellTabs(source, relative(root, path));
    if (result.extension === '.md') continue;
    const generated = imports + result.content;
    mdxToJs(generated, { fileURL: pathToFileURL(`${path}x`) });
    const before = nodes(markdownTree(source));
    const after = nodes(mdxTree(generated));
    assert.deepEqual(after.filter(node => /Expression$/.test(node.type)), [], `${path}: prose must not become JavaScript`);
    assert.deepEqual(
      after.filter(node => node.type === 'code').map(({ lang, meta, value }) => ({ lang, meta, value })),
      before.filter(node => node.type === 'code').map(({ lang, meta, value }) => ({ lang, meta, value })),
      path
    );
    for (const type of ['text', 'inlineCode', 'heading']) {
      const contents = tree => tree.filter(node => node.type === type)
        .map(node => node.value ?? nodes(node).filter(child => child.type === 'text').map(child => child.value).join(''));
      assert.deepEqual(contents(after), contents(before), `${path}: ${type}`);
    }
    const elements = after.filter(node => node.type === 'mdxJsxFlowElement');
    assert.ok(elements.every(node => ['Tabs', 'TabItem'].includes(node.name)), path);
    for (const tabs of elements.filter(node => node.name === 'Tabs')) {
      assert.deepEqual(tabs.attributes.map(({ name, value }) => ({ name, value })), [{ name: 'syncKey', value: 'shell' }]);
      assert.deepEqual(
        tabs.children.filter(node => node.type === 'mdxJsxFlowElement').map(node => node.attributes[0].value),
        ['Bash', 'PowerShell']
      );
    }
  }
});

test('Bash examples parse without executing CLI commands', () => {
  for (const { path, source } of canonicals) {
    for (const node of shellNodes(source).filter(node => node.lang === 'bash')) {
      const result = spawnSync('bash', ['-n'], { input: node.value, encoding: 'utf8' });
      assert.equal(result.status, 0, `${path}: ${result.error?.message ?? result.stderr}`);
    }
  }
});

const powershellProbe = spawnSync('pwsh', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', '$PSVersionTable.PSVersion.ToString()'], { encoding: 'utf8' });
test('PowerShell examples parse without executing CLI commands', {
  skip: powershellProbe.error?.code === 'ENOENT' ? 'PowerShell is not installed on this authoring machine.' : false
}, () => {
  assert.equal(powershellProbe.status, 0, powershellProbe.error?.message ?? powershellProbe.stderr);
  const parse = '$tokens = $null; $errors = $null; [void][System.Management.Automation.Language.Parser]::ParseInput([Console]::In.ReadToEnd(), [ref]$tokens, [ref]$errors); if ($errors.Count) { $errors | Out-String | Write-Error; exit 1 }';
  for (const { path, source } of canonicals) {
    for (const node of shellNodes(source).filter(node => node.lang === 'powershell')) {
      const result = spawnSync('pwsh', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', parse], { input: node.value, encoding: 'utf8' });
      assert.equal(result.status, 0, `${path}: ${result.error?.message ?? result.stderr}`);
    }
  }
});

function importerFixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'reference-shell-tabs-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const put = (path, content) => {
    const destination = resolve(directory, path);
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, content);
  };
  put('workshop/labs/manifest.json', JSON.stringify({ sourceRevision: 'fixture-revision' }));
  mkdirSync(resolve(directory, 'workshop/scripts'), { recursive: true });
  for (const name of ['import-reference.mjs', 'reference-shell-tabs.mjs', 'reference-scope.mjs']) {
    copyFileSync(new URL(name, import.meta.url), resolve(directory, 'workshop/scripts', name));
  }
  const run = () => spawnSync(process.execPath, [resolve(directory, 'workshop/scripts/import-reference.mjs')], {
    encoding: 'utf8',
    env: { ...process.env, GITHUB_REPOSITORY: 'example/workshop', BASE_PATH: '/custom-base/' }
  });
  const output = resolve(directory, 'workshop/src/content/docs/reference');
  return { directory, output, put, run };
}

test('importer writes MDX only for transformed references and preserves routes, link rewriting, and frontmatter', t => {
  const { directory, output, put, run } = importerFixture(t);
  put('README.md', '# Repository\n\n## Run the repository\n');
  put('apphost.cs', '// Fixture source\n');
  put('src/Agent.cs', '// Fixture source\n');
  put('docs/CONFIGURATION.md', `# Configuration reference\nOrdinary prose without a blank line after its heading.\n\n${pair()}\n[Providers](providers/MICROSOFT-FOUNDRY.md#choose)\n`);
  put('docs/providers/MICROSOFT-FOUNDRY.md', `# Model providers\n\n${pair()}\n[Configuration](../CONFIGURATION.md#settings)\n[Root](../../README.md#run-the-repository)\n[AppHost](../../apphost.cs)\n[Agent](../../src/Agent.cs)\n[Workshop](https://codemillmatt.github.io/interview-coach-agent-framework/workshop/)\n`);
  put('docs/PLAIN.md', '# Plain\n\n<div>Literal {markdown}</div>\n');
  put('workshop/src/content/docs/reference/configuration.md', 'stale Markdown');
  put('workshop/src/content/docs/reference/plain.mdx', 'stale MDX');
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(walk(output).map(path => relative(output, path).replaceAll('\\', '/')).sort(), [
    'configuration.mdx', 'index.md', 'plain.md', 'providers/microsoft-foundry.mdx'
  ]);
  const configuration = readFileSync(resolve(output, 'configuration.mdx'), 'utf8');
  const providers = readFileSync(resolve(output, 'providers/microsoft-foundry.mdx'), 'utf8');
  const plain = readFileSync(resolve(output, 'plain.md'), 'utf8');
  assert.match(configuration, /^---\ntitle: "Configuration reference"\ndescription: "Configuration reference for the completed Interview Coach application\."\n---\n/);
  assert.equal(configuration.split(imports.trim()).length - 1, 1);
  assert.match(configuration, /\[Providers\]\(\/custom-base\/reference\/providers\/microsoft-foundry\/#choose\)/);
  assert.match(providers, /\[Configuration\]\(\/custom-base\/reference\/configuration\/#settings\)/);
  assert.match(providers, /\[Root\]\(https:\/\/github\.com\/example\/workshop\/blob\/main\/README\.md#run-the-repository\)/);
  assert.match(providers, /\[AppHost\]\(https:\/\/github\.com\/example\/workshop\/blob\/fixture-revision\/apphost\.cs\)/);
  assert.match(providers, /\[Agent\]\(https:\/\/github\.com\/example\/workshop\/blob\/fixture-revision\/src\/Agent\.cs\)/);
  assert.match(providers, /\[Workshop\]\(\/custom-base\/workshop\/\)/);
  assert.doesNotMatch(plain, /import \{|<Tabs/);
  assert.ok(plain.includes('<div>Literal {markdown}</div>'));
  for (const content of [configuration, providers]) {
    mdxToJs(content);
  }
  put('docs/CONFIGURATION.md', '# Configuration reference\n\nNo shell examples now.\n');
  const secondRun = run();
  assert.equal(secondRun.status, 0, secondRun.stderr);
  assert.ok(existsSync(resolve(output, 'configuration.md')));
  assert.ok(!existsSync(resolve(output, 'configuration.mdx')));
  assert.equal(readFileSync(resolve(directory, 'docs/providers/MICROSOFT-FOUNDRY.md'), 'utf8').includes('<Tabs'), false);
});

test('importer rejects invalid pairs before clearing previous generated references', t => {
  const { output, put, run } = importerFixture(t);
  put('docs/BROKEN.md', `# Broken\n\n${fence('bash')}`);
  put('workshop/src/content/docs/reference/previous.md', 'Keep previous content.');
  const result = run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /docs\/BROKEN\.md:3:.*immediately followed by one PowerShell fence/);
  assert.equal(readFileSync(resolve(output, 'previous.md'), 'utf8'), 'Keep previous content.');
});

test('the application usage reference resolves its repository README link within the repository', () => {
  const path = resolve(docs, 'USER-MANUAL.md');
  const source = readFileSync(path, 'utf8');
  const link = nodes(markdownTree(source)).find(node => node.type === 'link' && node.url.endsWith('README.md#run-the-repository'));
  assert.ok(link);
  assert.equal(link.url, '../README.md#run-the-repository');
  assert.equal(resolve(dirname(path), link.url.split('#')[0]), resolve(root, 'README.md'));
});
