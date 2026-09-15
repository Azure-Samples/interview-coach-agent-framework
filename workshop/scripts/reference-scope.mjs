export const excludedReferences = new Set(['CHANGELOG.md', 'providers/README.md', 'providers/GITHUB-COPILOT.md']);

export function workshopReferenceMarkdown(source, text) {
  const replacements = {
    'ARCHITECTURE.md': [
      [/The alternative Copilot path[^\n]+\n/g, ''],
      [/, optional Copilot, and DevUI/g, ', and DevUI'],
      [/`LlmProvider` selects one of the two implemented model-provider paths\./g, 'The workshop uses Microsoft Foundry for model calls.'],
      [/The capstone uses that same application source\./g, 'The final lessons use that same application source.'],
    ],
    'CONFIGURATION.md': [
      [/`MicrosoftFoundry` or `GitHubCopilot`/g, '`MicrosoftFoundry`'],
      [/^\| `(?:GitHubCopilot:|COPILOT_GITHUB_TOKEN)[^\n]+\n/gm, ''],
      [/including the capstone/g, 'including the final lessons'],
    ],
    'FAQ.md': [
      [/, optional Copilot, and DevUI/g, ', and DevUI'],
      [/The implemented options are Microsoft Foundry and GitHub Copilot\.[^\n]+/g,
        'The workshop uses Microsoft Foundry in both agent modes. A different model backend would require changes to client construction and hosting.'],
      [/The capstone keeps the helper and checks the completed interview\./g,
        'The final lessons keep the helper and use the completed interview application.'],
    ],
    'MULTI-AGENT.md': [
      [/for Microsoft Foundry and GitHub Copilot/g, 'with Microsoft Foundry'],
      [/ The Copilot branch[^\n]+/g, ''],
    ],
    'LEARNING-OBJECTIVES.md': [
      [/\[Deployment\]\(DEPLOYMENT\.md\) and \[Copilot\]\(providers\/GITHUB-COPILOT\.md\) are optional tasks/g,
        '[Deployment](DEPLOYMENT.md) is an optional task'],
      [/^\| \[13\. Run your completed interview\][^\n]+$/gm,
        '| [13. Find and fix a failed step](https://codemillmatt.github.io/interview-coach-agent-framework/workshop/13-debugging/) | Trace a failed document request and examine an early-finish route |'],
      [/^\| \[14\. Find and fix a failed step\][^\n]+$/gm,
        '| [14. Review what you built](https://codemillmatt.github.io/interview-coach-agent-framework/workshop/14-summary/) | Review the concepts, their implementation, and the problems they solve |'],
      [/The opening example and final debugging lesson reuse/g, 'The opening example and final lessons reuse'],
    ],
    'DEPLOYMENT.md': [
      [/The selected provider remains your choice of Microsoft Foundry or GitHub Copilot\. Follow its \[authentication reference\]\(providers\/README\.md\)/g,
        'The workshop uses Microsoft Foundry. Follow its [authentication reference](providers/MICROSOFT-FOUNDRY.md)'],
      [/Run the capstone's short synthetic interview\./g,
        "Run the [summary-agent lesson's short interview](https://codemillmatt.github.io/interview-coach-agent-framework/workshop/12-handoffs/#save-the-final-feedback)."],
    ],
    'TUTORIALS.md': [
      [/^\[Run your completed interview and check the saved result\][^\n]+$/gm,
        '[Save the final interview feedback](https://codemillmatt.github.io/interview-coach-agent-framework/workshop/12-handoffs/#save-the-final-feedback), then [trace a failed step and an early finish](https://codemillmatt.github.io/interview-coach-agent-framework/workshop/13-debugging/). Check tool results, routing, and stored data alongside feedback quality. The [workshop summary](https://codemillmatt.github.io/interview-coach-agent-framework/workshop/14-summary/) connects these concepts to their implementation. After the workshop, use [optional extensions](https://codemillmatt.github.io/interview-coach-agent-framework/resources/extensions/) or the [deployment reference](DEPLOYMENT.md).'],
    ],
    'TROUBLESHOOTING.md': [
      [/final debugging lesson/g, 'debugging lesson'],
    ],
  };
  for (const [pattern, replacement] of replacements[source] ?? []) text = text.replace(pattern, replacement);
  text = text.replaceAll('workshop/14-debugging/', 'workshop/13-debugging/')
    .replaceAll('completed capstone', 'workshop')
    .replaceAll('by the capstone', 'by Chapter 12')
    .replaceAll('capstone checkpoint', 'completed checkpoint');
  if (/copilot/i.test(text)) throw new Error(`Out-of-scope provider content in workshop reference ${source}. Review its projection.`);
  return text;
}
