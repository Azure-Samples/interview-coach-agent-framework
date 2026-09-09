import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

const repository = process.env.GITHUB_REPOSITORY ?? 'codemillmatt/interview-coach-agent-framework';
const [owner, name] = repository.split('/');

export default defineConfig({
  site: process.env.SITE_URL ?? `https://${owner}.github.io`,
  base: process.env.BASE_PATH ?? `/${name}`,
  trailingSlash: 'always',
  integrations: [
    starlight({
      title: 'Build an interview coach',
      description: 'A hands-on Microsoft Agent Framework and Foundry workshop for .NET developers.',
      social: [{ icon: 'github', label: 'Source on GitHub', href: `https://github.com/${repository}` }],
      customCss: ['./src/styles/workshop.css'],
      components: { Head: './src/components/Head.astro' },
      sidebar: [
        { label: 'The workshop', items: [
          { label: 'Your learning path', slug: 'workshop' },
          { label: '00 · Agents, models, and the goal', slug: 'workshop/00-orientation' },
          { label: '01 · Get ready', slug: 'workshop/01-readiness' },
          { label: '02 · Meet the starter', slug: 'workshop/02-starter' },
          { label: '03 · Build your first coach', slug: 'workshop/03-first-coach' },
          { label: '04 · Give it a tool', slug: 'workshop/04-tools' },
          { label: '05 · Tools that remember', slug: 'workshop/05-mcp-state' },
          { label: '06 · Read real documents', slug: 'workshop/06-documents' },
          { label: '07 · Hand off to specialists', slug: 'workshop/07-handoffs' },
          { label: '08 · Complete the interview', slug: 'workshop/08-capstone' }
        ] },
        { label: 'Go further', items: [
          { label: 'Samples and checkpoints', slug: 'resources' },
          { label: 'Deploy the application', slug: 'resources/deployment' },
          { label: 'Hosting, providers, and extensions', slug: 'resources/extensions' },
          { label: 'Glossary and troubleshooting', slug: 'resources/glossary' }
        ] },
        { label: 'Reference', collapsed: true, items: [{ autogenerate: { directory: 'reference' } }] }
      ]
    })
  ]
});
