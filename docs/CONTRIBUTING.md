# Contributing

Keep guided lessons in `workshop/src/content/docs/workshop/` and application reference in `docs/`. The site imports the reference; do not edit generated copies. [Workshop authoring](../workshop/README.md) describes the checkpoint and source-backed edit contracts.

## Choose an issue form

Open the [issue form chooser](https://github.com/Azure-Samples/interview-coach-agent-framework/issues/new/choose) and select **Bug report**, **Feature request**, **Documentation issue or request**, **Regression**, or **General request**. Use **Regression** when behavior worked in an earlier version, and include the last known working and first known failing versions. Use **General request** for questions or requests that do not fit the other categories.

## <a name="issue"></a> Report a bug

<a id="submit-issue"></a>

Search the [issues](https://github.com/Azure-Samples/interview-coach-agent-framework/issues) before opening one. Include the affected checkpoint or revision, operating system, command, input, expected result, and actual result. For model behavior, include the provider, model, tool call, and relevant stored state rather than only a screenshot of the reply.

Use fictional documents and redact credentials, account details, and transcript contents from logs. Do not post real interview records.

## <a name="feature"></a> Propose a feature

Describe the user task and the contract that would change. For an agent or tool addition, explain its allowed operations, failure behavior, and how you would observe success. Discuss substantial changes in an issue before implementing them so the sample and workshop remain consistent.

## <a name="submit"></a> Submit a change

<a id="submit-pr"></a>

Make the change in a fork and open a pull request with the relevant issue, implementation notes, and checks performed. Use a descriptive commit message. Avoid unrelated formatting or dependency upgrades.

For workshop changes, run the existing content tests and build from `workshop/`. If dependencies are not installed, run `npm ci` first. If executable steps, recipes, or application sources change, also run the checkpoint validation described in the authoring guide. Preserve sample URLs, reference parity checks, and private local settings.

A lesson must let readers make the required edits in their own project. Show focused code with its filename and insertion point, explain the important calls, and give a concrete run check. Do not replace the lesson with a finished-file download or require repeated what/why/how headings.

## Contributor agreement

Most contributions require a [Contributor License Agreement](https://cla.opensource.microsoft.com) declaring that you have the right to grant the project permission to use your contribution. The CLA bot checks pull requests and provides any required steps. You generally complete this once for repositories using the agreement.

## <a name="coc"></a> Code of conduct

This project follows the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). Read the [FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with questions or concerns.
