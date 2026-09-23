import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const workshop = fileURLToPath(new URL('../', import.meta.url));
export const sample = '\n\tvar text = "<sample> & \\"quoted\\"";  \r\n\r\n';
export const shell = '# Keep this comment\nprintf "hello\\n"\n';
export const steps = [
  { id: 'replace', operation: 'replace', file: 'Factory.cs', before: '\treturn oldAgent;  \n', after: '\treturn agent;  \n', location: { kind: 'function', name: 'CreateAgent' } },
  { id: 'create', operation: 'create', file: 'New.cs', before: '', after: 'class New {}\n', location: { kind: 'file' } },
  { id: 'delete', operation: 'delete', file: 'Old.cs', before: 'class Old {}\n', after: '', location: { kind: 'file' } },
  { id: 'remove', operation: 'replace', file: 'Factory.cs', before: '    static string Temporary() => "practice";\n', after: '', location: { kind: 'function', name: 'CreateAgent' } },
  { id: 'top-level', operation: 'replace', file: 'Program.cs', before: 'builder.Build();\n', after: 'builder.Build().Run();\n', location: { kind: 'top-level' } },
  { id: 'imports', operation: 'replace', file: 'Program.cs', before: 'using Old;\n', after: 'using New;\n', location: { kind: 'imports' } },
  { id: 'multi-function', operation: 'replace', file: 'Factory.cs', before: 'class Factory { void First() {} void Second() {} }\n', after: 'class Factory { void First() { Run(); } void Second() { Run(); } }\n', location: { kind: 'type', name: 'Factory' } }
].map(step => ({ ...step, title: `${step.id} fixture`, ownership: 'learner' }));

// Build only a disposable component fixture. Never invoke the workshop generator.
export function buildCopyFixture() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'workshop-code-copy-')));
  const write = (path, text) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  try {
    symlinkSync(join(workshop, 'node_modules'), join(root, 'node_modules'), 'dir');
    write('package.json', '{"type":"module"}');
    write('astro.config.mjs', `import expressiveCode from 'astro-expressive-code';\nexport default { integrations: [expressiveCode()], vite: { resolve: { preserveSymlinks: true } } };\n`);
    for (const file of [
      ...['CodeStep', 'CodeSample', 'SourceCode', 'ShellCommands'].map(name => `src/components/${name}.astro`),
      'src/scripts/source-copy.ts', 'src/data/edit-contract.mjs', 'src/styles/workshop.css'
    ]) {
      mkdirSync(dirname(join(root, file)), { recursive: true });
      copyFileSync(join(workshop, file), join(root, file));
    }
    write('labs/manifest.json', JSON.stringify({ stages: [{ id: 'fixture' }] }));
    write('.generated/edit-contract.json', JSON.stringify({
      version: 1, sourceRevision: 'isolated-fixture',
      transitions: [{ from: 'before', to: 'after', steps, changedFiles: [...new Set(steps.map(step => step.file))] }]
    }));
    write('.generated/checkpoints/fixture/Sample.cs', sample);
    write('src/pages/index.astro', `---
import { Code } from '@astrojs/starlight/components';
import CodeStep from '../components/CodeStep.astro';
import CodeSample from '../components/CodeSample.astro';
import ShellCommands from '../components/ShellCommands.astro';
import '../styles/workshop.css';
const ids = ${JSON.stringify(steps.map(step => step.id))};
---
<html lang="en"><head><title>Isolated source copy fixture</title></head><body>
<main class="sl-markdown-content">
<h1>Isolated source copy fixture</h1>
<section id="ordinary"><h2>Native control</h2><Code code="const ordinary = true;" lang="javascript" /></section>
<section id="sample"><h2>Source sample</h2><CodeSample stage="fixture" path="Sample.cs" /></section>
<section id="commands"><h2>Shell commands</h2><ShellCommands command={${JSON.stringify(shell)}} /></section>
{ids.map(id => <CodeStep id={id} />)}
</main>
</body></html>
<style is:global>
:root { --sl-color-white: #fff; --sl-color-bg: #17181c; --sl-color-accent-high: #b7d4ff; --sl-color-accent-low: #142237; --workshop-border: #535661; }
body { background: var(--sl-color-bg); color: var(--sl-color-white); margin: 0; font-family: system-ui, sans-serif; }
main { max-width: 55rem; margin: auto; padding: 1rem; }
</style>
`);
    const astroPackage = JSON.parse(readFileSync(join(workshop, 'node_modules/astro/package.json'), 'utf8'));
    execFileSync(process.execPath, [join(workshop, 'node_modules/astro', astroPackage.bin.astro), 'build', '--root', root], {
      cwd: root, stdio: 'pipe', timeout: 120_000, env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' }
    });
    return { root, html: readFileSync(join(root, 'dist/index.html'), 'utf8'), dispose: () => rmSync(root, { recursive: true, force: true }) };
  } catch (error) {
    rmSync(root, { recursive: true, force: true });
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const fixture = buildCopyFixture();
  const dist = join(fixture.root, 'dist');
  const server = createServer((request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const file = resolve(dist, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
    if (!file.startsWith(dist + sep)) { response.writeHead(403).end(); return; }
    try {
      const body = readFileSync(file);
      const type = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' }[extname(file)] ?? 'application/octet-stream';
      response.writeHead(200, { 'Content-Type': type }).end(body);
    } catch (error) {
      if (error.code === 'ENOENT') response.writeHead(404).end();
      else { console.error(error); response.writeHead(500).end(); }
    }
  });
  server.listen(0, '127.0.0.1', () => console.log(`COPY_FIXTURE_URL=http://127.0.0.1:${server.address().port}/`));
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => server.close(() => { fixture.dispose(); process.exit(0); }));
  }
}
