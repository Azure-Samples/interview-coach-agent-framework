import { readdirSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, rmSync } from 'node:fs';
import { resolve, relative, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

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
if (existsSync(output)) rmSync(output, { recursive: true });
mkdirSync(output, { recursive: true });
for (const source of walk(docs).filter(path => path.endsWith('.md'))) {
  let text = readFileSync(source, 'utf8');
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
    if (path.startsWith(`${docs}/`) && extname(path) === '.md') return `${label}(${site(route(path))}${anchor ? `#${anchor}` : ''})`;
    if (label.startsWith('!') && /\.(png|jpg|jpeg|svg|webp|gif)$/i.test(path)) {
      const destination = resolve(workshop, 'public/reference-assets', repoPath);
      mkdirSync(dirname(destination), { recursive: true });
      copyFileSync(path, destination);
      return `${label}(${site(`reference-assets/${repoPath}`)})`;
    }
    const sourceRef = repoPath.startsWith('src/') || repoPath === 'apphost.cs' ? revision : 'main';
    return `${label}(https://github.com/${repo}/blob/${sourceRef}/${repoPath}${anchor ? `#${anchor}` : ''})`;
  });
  const destination = resolve(output, `${slug(source)}.md`);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, `---\ntitle: ${JSON.stringify(title)}\ndescription: ${JSON.stringify(`Reference documentation: ${title}`)}\n---\n${text}`);
}
writeFileSync(resolve(output, 'index.md'), `---\ntitle: Reference documentation\n---\n\nUse these pages to look up the finished application. For the guided build, start with the [workshop](${site('workshop/')}).\n\n- [Architecture](${site('reference/architecture/')})\n- [Configuration](${site('reference/configuration/')})\n- [Agent modes](${site('reference/multi-agent/')})\n- [Session and data contracts](${site('reference/session-data/')})\n- [Application usage](${site('reference/user-manual/')})\n- [Troubleshooting](${site('reference/troubleshooting/')})\n`);
console.log('Imported canonical reference Markdown from docs/.');
