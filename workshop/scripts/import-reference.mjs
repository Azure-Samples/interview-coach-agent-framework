import { readdirSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, rmSync } from 'node:fs';
import { resolve, relative, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transformReferenceShellTabs } from './reference-shell-tabs.mjs';
import { excludedReferences, workshopReferenceMarkdown } from './reference-scope.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const docs = resolve(root, 'docs');
const workshop = resolve(root, 'workshop');
const output = resolve(workshop, 'src/content/docs/reference');
const repo = process.env.GITHUB_REPOSITORY ?? 'codemillmatt/interview-coach-agent-framework';
const base = (process.env.BASE_PATH ?? `/${repo.split('/')[1]}`).replace(/\/$/, '');
const revision = JSON.parse(readFileSync(resolve(workshop, 'labs/manifest.json'), 'utf8')).sourceRevision;
const site = path => `${base}/${path}`;
const slug = path => relative(docs, path).replaceAll('\\', '/').replace(/\.md$/i, '').toLowerCase().replace(/(^|\/)readme$/, '$1index');
const route = path => `reference/${slug(path).replace(/(^|\/)index$/, '$1').replace(/\/$/, '')}/`.replace('//', '/');
const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(resolve(dir, entry.name)) : [resolve(dir, entry.name)]);

// Generated references have a single source of truth: the Markdown in docs/.
// Validate every shell pair before clearing previously generated references.
const references = walk(docs).filter(path => path.endsWith('.md') && !excludedReferences.has(relative(docs, path).replaceAll('\\', '/'))).map(source => ({
  source,
  ...transformReferenceShellTabs(workshopReferenceMarkdown(relative(docs, source).replaceAll('\\', '/'), readFileSync(source, 'utf8')), relative(root, source))
}));
if (existsSync(output)) rmSync(output, { recursive: true });
mkdirSync(output, { recursive: true });
for (const { source, content, extension } of references) {
  let text = content;
  const heading = text.match(/^# (.+)$/m);
  const title = heading?.[1] ?? slug(source);
  text = text.replace(/^# .+\r?\n/, '');
  text = text.replace(/(!?\[[^\]\n]*\])\(([^)\n]+)\)/g, (match, label, target) => {
    const published = 'https://codemillmatt.github.io/interview-coach-agent-framework/';
    if (target.startsWith(published)) return `${label}(${site(target.slice(published.length))})`;
    if (/^(https?:|mailto:|#)/.test(target)) return match;
    const [rawPath, anchor = ''] = target.split('#');
    const path = resolve(dirname(source), rawPath);
    const repoPath = relative(root, path).replaceAll('\\', '/');
    if (repoPath.startsWith('..')) throw new Error(`Reference link escapes repository: ${source}: ${target}`);
    if (!existsSync(path)) throw new Error(`Broken reference link in ${source}: ${target}`);
    if (path.startsWith(`${docs}/`) && extname(path) === '.md') {
      if (excludedReferences.has(relative(docs, path).replaceAll('\\', '/'))) {
        throw new Error(`Workshop reference links to an excluded page: ${source}: ${target}`);
      }
      return `${label}(${site(route(path))}${anchor ? `#${anchor}` : ''})`;
    }
    if (label.startsWith('!') && /\.(png|jpg|jpeg|svg|webp|gif)$/i.test(path)) {
      const destination = resolve(workshop, 'public/reference-assets', repoPath);
      mkdirSync(dirname(destination), { recursive: true });
      copyFileSync(path, destination);
      return `${label}(${site(`reference-assets/${repoPath}`)})`;
    }
    const sourceRef = repoPath.startsWith('src/') || repoPath === 'apphost.cs' ? revision : 'main';
    return `${label}(https://github.com/${repo}/blob/${sourceRef}/${repoPath}${anchor ? `#${anchor}` : ''})`;
  });
  const destination = resolve(output, `${slug(source)}${extension}`);
  mkdirSync(dirname(destination), { recursive: true });
  const imports = extension === '.mdx' ? "\nimport { Tabs, TabItem } from '@astrojs/starlight/components';\n\n" : '';
  writeFileSync(destination, `---\ntitle: ${JSON.stringify(title)}\ndescription: ${JSON.stringify(`${title} for the completed Interview Coach application.`)}\n---\n${imports}${text}`);
}
writeFileSync(resolve(output, 'index.md'), `---\ntitle: Application reference\n---\n\nLook up the completed application's settings, request paths, and tool contracts here. To build it yourself, use the [workshop](${site('workshop/')}), which begins with a run of the finished example.\n\n- [Architecture](${site('reference/architecture/')})\n- [Configuration](${site('reference/configuration/')})\n- [Agent modes and handoff edges](${site('reference/multi-agent/')})\n- [Session and data contracts](${site('reference/session-data/')})\n- [Application inputs and outputs](${site('reference/user-manual/')})\n- [Troubleshooting](${site('reference/troubleshooting/')})\n`);
console.log('Imported canonical reference Markdown from docs/.');
