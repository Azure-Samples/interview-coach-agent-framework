export const curriculumVersion = '1';
export const lessons = [
  ['00-orientation', 'Agents, models, and the goal', 'Understand what the model does and what your code controls.'],
  ['01-readiness', 'Get ready', 'Check your tools, model access, and resource ownership.'],
  ['02-starter', 'Meet the starter', 'Start with a working UI and an intentionally disconnected coach.'],
  ['03-first-coach', 'Build your first coach', 'Connect a Foundry model and stream a real conversation.'],
  ['04-tools', 'Give it a tool', 'Watch an agent ask your application to execute a function.'],
  ['05-mcp-state', 'Tools that remember', 'Connect an MCP server and persist interview records.'],
  ['06-documents', 'Read real documents', 'Turn a resume and job description into coaching context.'],
  ['07-handoffs', 'Hand off to specialists', 'Give each interview phase its own instructions and tools.'],
  ['08-capstone', 'Complete the interview', 'Follow the evidence from first question to stored summary.']
] as const;

export function siteLink(path: string) {
  return `${import.meta.env.BASE_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}
