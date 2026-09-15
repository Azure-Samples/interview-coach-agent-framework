import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { anchors, paths, replaceOnce, sessionIdDisplay, sourceSlice } from './recipes.mjs';

export const referenceProfile = 'foundry-workshop-v2';
const included = path => /^(src\/|tests\/|samples\/)/.test(path) ||
  /^(Directory\.Build\.(props|targets)|Directory\.Packages\.props|InterviewCoach\.slnx|LICENSE\.md|global\.json|apphost\.cs|apphost\.settings\.json|aspire\.config\.json|azure\.yaml)$/.test(path);

export function readReference(root, manifest, { verifyWorktree = true } = {}) {
  const git = (...args) => execFileSync('git', args, { cwd: root, maxBuffer: 32 * 1024 * 1024 });
  if (!/^[a-f0-9]{40}$/.test(manifest.sourceRevision)) throw new Error('The reference revision must be an exact commit SHA.');
  if (typeof manifest.sourceTag !== 'string' || !/^workshop-[a-z0-9.-]+$/.test(manifest.sourceTag)) {
    throw new Error('The reference must name an immutable workshop source tag.');
  }
  const taggedRevision = git('rev-parse', '--verify', `refs/tags/${manifest.sourceTag}^{commit}`).toString().trim();
  if (taggedRevision !== manifest.sourceRevision) throw new Error('The source tag and exact reference revision disagree.');
  const names = git('ls-tree', '-r', '--name-only', manifest.sourceRevision).toString().trim().split('\n').filter(included);
  if (!names.length) throw new Error('Reference tree is empty.');
  if (manifest.sourceOverrides !== undefined) throw new Error('Source overrides are not release inputs. Commit fixes and advance the reference revision.');
  if (verifyWorktree) {
    const localNames = git('ls-files', '--cached', '--others', '--exclude-standard').toString().trim().split('\n').filter(included);
    const additions = localNames.filter(path => !names.includes(path));
    if (additions.length) throw new Error(`Unpinned reference files: ${additions.join(', ')}. Commit them and advance the reference.`);
  }
  const reference = new Map();
  for (const path of names) {
    const local = resolve(root, path);
    const contents = git('show', `${manifest.sourceRevision}:${path}`);
    if (verifyWorktree && (!existsSync(local) || !readFileSync(local).equals(contents))) {
      throw new Error(`Reference drift in ${path}. Commit the source fix and advance labs/manifest.json explicitly.`);
    }
    reference.set(path, contents);
  }
  return reference;
}

export function createWorkshopReference(reference, packageVersions) {
  const files = new Map(reference);
  const get = path => {
    if (!files.has(path)) throw new Error(`Missing reference file: ${path}`);
    return files.get(path).toString('utf8');
  };
  const set = (path, text) => files.set(path, Buffer.from(text));
  const withoutLines = (text, pattern) => text.split('\n').filter(line => !pattern.test(line)).join('\n');
  const chatHeader = '<ChatHeader OnNewChat="@ResetConversationAsync" />';
  set(paths.chat, replaceOnce(get(paths.chat), chatHeader, `${chatHeader}\n${sessionIdDisplay}`));

  let factory = get(paths.factory);
  const providerStart = factory.indexOf(anchors.provider);
  const providerSignature = factory.slice(providerStart, factory.indexOf('    {\n', providerStart) + 6);
  const constructor = sourceSlice(factory, '            return new ChatClientAgent(', '        }\n\n        if (provider !=')
    .split('\n').map(line => line.startsWith('    ') ? line.slice(4) : line).join('\n');
  const singleHeader = '    // ============================================================================\n    // MODE 1:';
  factory = replaceOnce(factory, sourceSlice(factory, anchors.provider, singleHeader),
    `${providerSignature}${constructor}    }\n\n`);
  factory = withoutLines(factory, /using GitHub\.Copilot/);
  factory = replaceOnce(factory, '    MicrosoftFoundry,\n    GitHubCopilot', '    MicrosoftFoundry');
  set(paths.factory, factory);

  let program = get(paths.program);
  program = replaceOnce(program, sourceSlice(program, 'else if (llmProvider == LlmProvider.GitHubCopilot)', 'else\n{'), '');
  set(paths.program, withoutLines(program, /using GitHub\.Copilot/));
  set('src/InterviewCoach.Agent/Constants.cs', withoutLines(get('src/InterviewCoach.Agent/Constants.cs'), /GitHub/));
  set('src/InterviewCoach.Agent/InterviewCoach.Agent.csproj',
    withoutLines(get('src/InterviewCoach.Agent/InterviewCoach.Agent.csproj'), /Microsoft\.Agents\.AI\.GitHub\.Copilot/));
  set('src/InterviewCoach.AppHost.Core/LlmProvider.cs',
    replaceOnce(get('src/InterviewCoach.AppHost.Core/LlmProvider.cs'), '    MicrosoftFoundry,\n    GitHubCopilot', '    MicrosoftFoundry'));

  const helperPath = 'src/InterviewCoach.AppHost.Core/LlmResourceFactory.cs';
  let helper = get(helperPath);
  const alternative = '    private static IResourceBuilder<ProjectResource> AddGitHubCopilotResource(';
  if (!helper.includes(alternative)) throw new Error('Missing alternative provider boundary in LlmResourceFactory.');
  helper = helper.slice(0, helper.indexOf(alternative)) + '}\n';
  helper = withoutLines(helper, /COPILOT|SECTION_NAME_GITHUB|private const string (TOKEN_KEY|MODEL_KEY|TOKEN_RESOURCE_NAME)|LlmProvider\.GitHubCopilot/);
  set(helperPath, helper);
  for (const path of paths.settings) {
    const settings = JSON.parse(get(path));
    if (!Object.hasOwn(settings, 'GitHubCopilot')) throw new Error(`Missing alternative provider settings in ${path}`);
    delete settings.GitHubCopilot;
    settings.MicrosoftFoundry.UseExisting = true;
    settings.Azure = { ...settings.Azure, AllowResourceGroupCreation: false };
    set(path, `${JSON.stringify(settings, null, 2)}\n`);
  }
  const buildProps = get('Directory.Build.props');
  const secretIds = buildProps.match(/^ *<UserSecretsId>[^<]+<\/UserSecretsId>\r?\n/gm);
  if (secretIds?.length !== 1) throw new Error('Expected one inherited example UserSecretsId to remove from learner projects.');
  set('Directory.Build.props', replaceOnce(buildProps, secretIds[0], ''));
  const aspireConfig = JSON.parse(get('aspire.config.json'));
  aspireConfig.appHost = { ...aspireConfig.appHost, path: 'apphost.cs' };
  // Match the CLI's formatting so choosing the root AppHost leaves this file unchanged.
  set('aspire.config.json', JSON.stringify(aspireConfig, null, 2));
  for (const path of files.keys()) {
    if (path.startsWith('tests/')) files.delete(path);
  }
  const solution = get('InterviewCoach.slnx');
  set('InterviewCoach.slnx', replaceOnce(solution, sourceSlice(solution, '  <Folder Name="/tests/">', '</Solution>'), ''));
  let packages = withoutLines(get('Directory.Packages.props'), /Copilot|Microsoft\.NET\.Test\.Sdk|xunit/i);
  packages = packages.replace(/(<PackageVersion Include="([^"]+)" Version=")[^"]+(")/g, (_, prefix, name, suffix) => {
    const version = packageVersions[name];
    if (!version) throw new Error(`Missing package version pin: ${name}`);
    return `${prefix}${version}${suffix}`;
  });
  set('Directory.Packages.props', packages);
  for (const [path, content] of files) {
    if (/\.(cs|csproj|props|targets|slnx|json)$/.test(path) && /copilot/i.test(content.toString('utf8'))) {
      throw new Error(`The workshop reference still includes an out-of-scope provider in ${path}`);
    }
  }
  return files;
}
