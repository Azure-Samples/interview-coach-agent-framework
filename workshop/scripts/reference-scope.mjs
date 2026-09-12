export const excludedReferences = new Set(['CHANGELOG.md', 'providers/README.md', 'providers/GITHUB-COPILOT.md']);

export function workshopReferenceMarkdown(source, text) {
  const replacements = {
    'ARCHITECTURE.md': [
      [/The alternative Copilot path[^\n]+\n/g, ''],
      [/, optional Copilot, and DevUI/g, ', and DevUI'],
      [/`LlmProvider` selects one of the two implemented model-provider paths\./g, 'The workshop uses Microsoft Foundry for model calls.'],
    ],
    'CONFIGURATION.md': [
      [/`MicrosoftFoundry` or `GitHubCopilot`/g, '`MicrosoftFoundry`'],
      [/^\| `(?:GitHubCopilot:|COPILOT_GITHUB_TOKEN)[^\n]+\n/gm, ''],
    ],
    'FAQ.md': [
      [/, optional Copilot, and DevUI/g, ', and DevUI'],
      [/The implemented options are Microsoft Foundry and GitHub Copilot\.[^\n]+/g,
        'The workshop uses Microsoft Foundry in both agent modes. A different model backend would require changes to client construction and hosting.'],
    ],
    'MULTI-AGENT.md': [
      [/for Microsoft Foundry and GitHub Copilot/g, 'with Microsoft Foundry'],
      [/ The Copilot branch[^\n]+/g, ''],
    ],
    'LEARNING-OBJECTIVES.md': [
      [/\[Deployment\]\(DEPLOYMENT\.md\) and \[Copilot\]\(providers\/GITHUB-COPILOT\.md\) are optional tasks/g,
        '[Deployment](DEPLOYMENT.md) is an optional task'],
    ],
    'DEPLOYMENT.md': [
      [/The selected provider remains your choice of Microsoft Foundry or GitHub Copilot\. Follow its \[authentication reference\]\(providers\/README\.md\)/g,
        'The workshop uses Microsoft Foundry. Follow its [authentication reference](providers/MICROSOFT-FOUNDRY.md)'],
    ],
  };
  for (const [pattern, replacement] of replacements[source] ?? []) text = text.replace(pattern, replacement);
  if (/copilot/i.test(text)) throw new Error(`Out-of-scope provider content in workshop reference ${source}. Review its projection.`);
  return text;
}
