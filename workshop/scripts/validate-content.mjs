import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { resolve, relative, basename } from 'node:path';
import { validateCourseContent, validateEditCoverage, validateLegacyRedirects } from './content-contract.mjs';
import { readEditContract, flattenEdits } from '../src/data/edit-contract.mjs';
import { validateRenderedShellTabs } from './shell-tabs.mjs';

const root = resolve(process.env.OUT_DIR ?? 'dist');
const repo = process.env.GITHUB_REPOSITORY ?? 'codemillmatt/interview-coach-agent-framework';
const base = (process.env.BASE_PATH ?? `/${repo.split('/')[1]}`).replace(/\/$/, '');
const origin = new URL(process.env.SITE_URL ?? `https://${repo.split('/')[0]}.github.io`).origin;
const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(resolve(dir, entry.name)) : [resolve(dir, entry.name)]);
const errors = [];
const course = JSON.parse(readFileSync('src/data/course.json', 'utf8'));
const manifest = JSON.parse(readFileSync('labs/manifest.json', 'utf8'));
const pages = new Map(walk(resolve('src/content/docs/workshop'))
  .filter(path => path.endsWith('.mdx'))
  .map(path => [basename(path, '.mdx'), readFileSync(path, 'utf8')]));
errors.push(...validateCourseContent(course, manifest, pages));
const editContract = readEditContract();
if (editContract.sourceRevision !== manifest.sourceRevision) errors.push('The edit contract is built from a different reference revision.');
errors.push(...validateEditCoverage(course, pages, flattenEdits(editContract)));
const htmlFiles = walk(root).filter(path => path.endsWith('.html'));
if (!/<a\b[^>]*\bdata-continue\b/.test(readFileSync(resolve(root, 'index.html'), 'utf8'))) {
  errors.push('The landing page must provide the workshop start/continue action.');
}
const decode = value => value.replaceAll('&amp;', '&').replaceAll('&#39;', "'").replaceAll('&quot;', '"');
for (const path of htmlFiles) {
  const html = readFileSync(path, 'utf8');
  errors.push(...validateRenderedShellTabs(html).map(error => `${relative(root, path)}: ${error}`));
  const documentUrl = new URL(`${base}/${relative(root, path).replaceAll('\\', '/').replace(/index\.html$/, '')}`, origin);
  for (const match of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
    const href = decode(match[1]);
    if (/^(data:|mailto:|tel:|javascript:)/.test(href)) continue;
    const url = new URL(href, documentUrl);
    if (url.origin !== origin) continue;
    if (base && url.pathname !== base && !url.pathname.startsWith(`${base}/`)) {
      errors.push(`${relative(root, path)}: link loses Pages base path: ${href}`);
      continue;
    }
    const localPath = decodeURIComponent(url.pathname.slice(base.length)).replace(/^\//, '');
    let target = resolve(root, localPath);
    if (relative(root, target).startsWith('..')) { errors.push(`Path escape: ${href}`); continue; }
    if (existsSync(target) && statSync(target).isDirectory()) target = resolve(target, 'index.html');
    if (!existsSync(target)) { errors.push(`${relative(root, path)}: missing link ${href}`); continue; }
    if (url.hash && target.endsWith('.html')) {
      const id = decodeURIComponent(url.hash.slice(1));
      const targetHtml = readFileSync(target, 'utf8');
      if (!targetHtml.includes(`id="${id}"`) && !targetHtml.includes(`name="${id}"`)) errors.push(`${relative(root, path)}: missing anchor ${href}`);
    }
  }
}
for (const name of ['resume-natasha-romanoff.pdf', 'resume-peter-parker.pdf', 'jd-cloud-solution-architect.pdf']) {
  if (!existsSync(resolve(root, name)) || !existsSync(resolve(root, 'samples', name))) errors.push(`Missing legacy/sample PDF: ${name}`);
}
const redirectPages = new Map();
for (const id of [...Object.keys(course.legacyChapterIds), '01-readiness']) {
  const path = resolve(root, `workshop/${id}/index.html`);
  if (existsSync(path)) redirectPages.set(id, decode(readFileSync(path, 'utf8')));
}
errors.push(...validateLegacyRedirects(course, base, redirectPages));
if (errors.length) throw new Error(`Content validation failed:\n${[...new Set(errors)].join('\n')}`);
console.log(`Validated ${course.chapters.length} chapters, ${htmlFiles.length} HTML pages, internal links, anchors, legacy chapter redirects, and sample URLs.`);
