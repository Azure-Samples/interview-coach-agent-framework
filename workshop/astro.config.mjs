import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import { readFileSync } from 'node:fs';

const course = JSON.parse(readFileSync(new URL('./src/data/course.json', import.meta.url), 'utf8'));

const repository = process.env.GITHUB_REPOSITORY ?? 'codemillmatt/interview-coach-agent-framework';
const [owner, name] = repository.split('/');
const base = process.env.BASE_PATH ?? `/${name}`;

export default defineConfig({
  site: process.env.SITE_URL ?? `https://${owner}.github.io`,
  base,
  trailingSlash: 'always',
  redirects: {
    ...Object.fromEntries(Object.entries(course.legacyChapterIds).map(([previous, current]) => [
      `/workshop/${previous}/`, `${base.replace(/\/$/, '')}/workshop/${current}/`
    ])),
    '/workshop/01-readiness/': `${base.replace(/\/$/, '')}/workshop/00-orientation/#check-your-tools`
  },
  integrations: [
    starlight({
      title: course.title,
      description: course.description,
      social: [{ icon: 'github', label: 'Source on GitHub', href: `https://github.com/${repository}` }],
      customCss: ['./src/styles/workshop.css'],
      components: {
        Head: './src/components/Head.astro',
        Sidebar: './src/components/WorkshopSidebar.astro'
      },
      sidebar: [
        { label: 'Welcome', slug: '' },
        { label: 'Your workshop path', slug: 'workshop' },
        ...[...new Set(course.chapters.map(chapter => chapter.group))].map(group => ({
          label: group,
          items: course.chapters.filter(chapter => chapter.group === group).map(chapter => ({
            label: `${chapter.number}. ${chapter.title}`,
            slug: `workshop/${chapter.id}`,
            attrs: {
              'data-progress-id': chapter.id,
              'data-progress-label': `Chapter ${chapter.number}: ${chapter.title}`
            },
            badge: { text: 'Completed', class: 'workshop-completion', variant: 'success' }
          }))
        })),
        { label: 'Resources', items: [
          { label: 'Samples and checkpoints', slug: 'resources' },
          { label: 'Build your own agent', slug: 'resources/your-own-agent' },
          { label: 'Deploy the application', slug: 'resources/deployment' },
          { label: 'Hosting and extensions', slug: 'resources/extensions' },
          { label: 'Glossary and troubleshooting', slug: 'resources/glossary' }
        ] },
        { label: 'Reference', collapsed: true, items: [{ autogenerate: { directory: 'reference' } }] }
      ]
    })
  ]
});
