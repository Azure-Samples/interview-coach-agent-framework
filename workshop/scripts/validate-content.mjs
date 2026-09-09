import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { resolve, relative } from 'node:path';

const root = resolve(process.env.OUT_DIR ?? 'dist');
const repo = process.env.GITHUB_REPOSITORY ?? 'codemillmatt/interview-coach-agent-framework';
const base = (process.env.BASE_PATH ?? `/${repo.split('/')[1]}`).replace(/\/$/, '');
const origin = new URL(process.env.SITE_URL ?? `https://${repo.split('/')[0]}.github.io`).origin;
const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(resolve(dir, entry.name)) : [resolve(dir, entry.name)]);
const errors = [];
const lessons = walk(resolve('src/content/docs/workshop')).filter(path => /\/\d\d-[^/]+\.mdx$/.test(path));
const sections = ['What we are doing', 'Why', 'How and where', 'See it work', 'Make it yours', 'If you get stuck', 'Carry forward'];
if (lessons.length !== 9) errors.push(`Expected 9 core lessons; found ${lessons.length}.`);
for (const path of lessons) {
  const text = readFileSync(path, 'utf8');
  for (const section of sections) if (!text.includes(`## ${section}`)) errors.push(`${path}: missing "${section}" section.`);
  if (!text.includes('<LessonProgress lessonId=')) errors.push(`${path}: missing progress control.`);
}
const htmlFiles = walk(root).filter(path => path.endsWith('.html'));
const decode = value => value.replaceAll('&amp;', '&').replaceAll('&#39;', "'").replaceAll('&quot;', '"');
for (const path of htmlFiles) {
  const html = readFileSync(path, 'utf8');
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
if (errors.length) throw new Error(`Content validation failed:\n${[...new Set(errors)].join('\n')}`);
console.log(`Validated ${lessons.length} lessons, ${htmlFiles.length} HTML pages, internal links, anchors, and legacy sample URLs.`);
