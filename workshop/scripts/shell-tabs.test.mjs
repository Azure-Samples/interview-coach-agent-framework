import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { validateRenderedShellTabs } from './shell-tabs.mjs';

const content = new URL('../src/content/docs/', import.meta.url);
const shellFence = /^[ \t]*```(?:sh|bash|shell|powershell|ps1|console|zsh)\b/gm;
const pages = ['workshop', 'resources'].flatMap(directory =>
  readdirSync(new URL(`${directory}/`, content))
    .filter(name => name.endsWith('.mdx'))
    .map(name => new URL(`${directory}/${name}`, content)));
const bashProbe = spawnSync('bash', ['--version'], { encoding: 'utf8' });
const bashOptions = {
  skip: bashProbe.error?.code === 'ENOENT' ? 'Bash is not installed on this authoring machine.' : false
};

for (const path of pages) {
  const source = readFileSync(path, 'utf8');
  if (!shellFence.test(source)) continue;
  shellFence.lastIndex = 0;

  test(`${path.pathname.split('/').slice(-2).join('/')}: every shell example has both tabs`, () => {
    const groups = [...source.matchAll(/<Tabs\b([^>]*)>([\s\S]*?)<\/Tabs>/g)]
      .filter(([, , body]) => {
        shellFence.lastIndex = 0;
        return shellFence.test(body);
      });
    assert.ok(groups.length > 0, 'Shell examples must use Tabs.');
    for (const [, attributes, body] of groups) {
      assert.match(attributes, /\bsyncKey="shell"/);
      const items = [...body.matchAll(/<TabItem\s+label="([^"]+)">([\s\S]*?)<\/TabItem>/g)];
      assert.deepEqual(items.map(([, label]) => label), ['Bash', 'PowerShell']);
      for (const [index, [, , code]] of items.entries()) {
        const language = index === 0 ? 'bash' : 'powershell';
        const fences = [...code.matchAll(/^[ \t]*```(\w+)\s*\n([\s\S]*?)^[ \t]*```/gm)];
        assert.equal(fences.length, 1, 'Each shell tab must contain one command block.');
        assert.equal(fences[0][1], language);
        assert.ok(fences[0][2].trim(), 'A shell tab must not be empty.');
      }
    }
    const outsideTabs = source.replace(/<Tabs\b[^>]*>[\s\S]*?<\/Tabs>/g, '');
    shellFence.lastIndex = 0;
    assert.doesNotMatch(outsideTabs, shellFence, 'A shell example is missing its tabs.');
  });
}

test('Bash examples parse without executing their commands', bashOptions, () => {
  assert.equal(bashProbe.status, 0, bashProbe.error?.message ?? bashProbe.stderr);
  for (const path of pages) {
    const source = readFileSync(path, 'utf8');
    for (const [, code] of source.matchAll(/^[ \t]*```bash\n([\s\S]*?)^[ \t]*```/gm)) {
      const result = spawnSync('bash', ['-n'], { input: code, encoding: 'utf8' });
      assert.equal(result.status, 0, `${path.pathname}: ${result.stderr}`);
    }
  }
});

test('Chapter 0 reads the selected subscription into a shell-specific variable', () => {
  const source = readFileSync(new URL('workshop/00-orientation.mdx', content), 'utf8');
  assert.match(source, /^subscriptionId=\$\(az account show --query id --output tsv\)$/m);
  assert.match(source, /^\$subscriptionId = az account show --query id --output tsv$/m);
  const verify = 'az account show --subscription "$subscriptionId" --query';
  assert.equal(source.split(verify).length - 1, 2);
});

test('Chapter 0 stores the complete Aspire Azure context outside the repository', () => {
  const source = readFileSync(new URL('workshop/00-orientation.mdx', content), 'utf8');
  for (const key of [
    'Azure:SubscriptionId',
    'Azure:TenantId',
    'Azure:Location',
    'Azure:ResourceGroup',
    'Azure:CredentialSource'
  ]) {
    assert.equal(source.split(`aspire secret set "${key}"`).length - 1, 2);
  }
  assert.equal([...source.matchAll(/^\s*aspire secret set .+ --apphost \.\/apphost\.cs$/gm)].length, 10);
  assert.match(source, /stored in the example's local AppHost user secrets, outside the repository/);
  assert.doesNotMatch(source, /carry into the learner AppHost/);
  assert.doesNotMatch(source, /"Azure":\s*\{\s*"SubscriptionId"/);
});

test('Chapter 0 explicitly enables resource-group creation before starting the example', () => {
  const source = readFileSync(new URL('workshop/00-orientation.mdx', content), 'utf8');
  const settingsBlocks = [...source.matchAll(/```json\n([\s\S]*?)```/g)];
  const example = settingsBlocks.find(([, code]) => JSON.parse(code).MicrosoftFoundry);
  assert.ok(example, 'The example must show its AppHost settings.');
  const settings = JSON.parse(example[1]);
  assert.equal(settings.Azure.AllowResourceGroupCreation, true);
  assert.equal(settings.AgentMode, 'HandOff');
  assert.equal(settings.LlmProvider, 'MicrosoftFoundry');
  assert.ok(example.index < source.indexOf('aspire start --apphost ./apphost.cs'));
  assert.match(source, /example's root `apphost\.settings\.json`, add the `Azure` section/);
  assert.match(source, /interview-coach-lab` starter deliberately keeps this setting `false`/);
});

test('Chapter 0 collects location and resource group once before the copyable commands in both shells', () => {
  const source = readFileSync(new URL('workshop/00-orientation.mdx', content), 'utf8');
  for (const language of ['bash', 'powershell']) {
    const blocks = [...source.matchAll(new RegExp('```' + language + '\\n([\\s\\S]*?)```', 'g'))].map(([, code]) => code);
    const setups = blocks.filter(code => code.includes('YOUR_APPROVED_AZURE_REGION'));
    assert.equal(setups.length, 1, language);
    const setup = setups[0];
    assert.equal(setup.trim().split('\n').length, 2, 'Keep manual inputs in their own block.');
    assert.match(setup, /resourceGroup\s*=\s*"rg-interview-coach-YOUR_NAME"/);
    const context = blocks.find(code => code.includes('aspire secret set "Azure:Location"'));
    assert.ok(context, language);
    assert.ok(blocks.indexOf(setup) < blocks.indexOf(context), language);
    const prefix = language === 'bash' ? '$' : '$env:';
    assert.doesNotMatch(context, /YOUR_|^\s*(?:export |\$env:)?(?:location|resourceGroup)\s*=/m);
    assert.ok(context.includes(`aspire secret set "Azure:Location" "${prefix}location"`), language);
    assert.ok(context.includes(`aspire secret set "Azure:ResourceGroup" "${prefix}resourceGroup"`), language);
    for (const name of ['location', 'resourceGroup']) {
      assert.ok(setup.includes(language === 'bash' ? `export ${name}=` : `$env:${name} =`), language);
    }
    const accounts = blocks.find(code => code.includes('az cognitiveservices account list'));
    assert.ok(accounts?.includes(`--resource-group "${prefix}resourceGroup"`), language);
    assert.ok(accounts.includes(`location=='${prefix}location'`), language);
    const deployment = blocks.find(code => code.includes(language === 'bash' ? 'export deploymentName=' : '$env:deploymentName ='));
    assert.equal(deployment?.trim(), language === 'bash' ? 'export deploymentName="chat"' : '$env:deploymentName = "chat"');
  }
  assert.doesNotMatch(source, /YOUR_RESOURCE_GROUP|YOUR_ACCOUNT_NAME/);
});

test('Chapter 0 Bash commands reuse the chosen location and resource group without cloud access', bashOptions, () => {
  const source = readFileSync(new URL('workshop/00-orientation.mdx', content), 'utf8');
  const blocks = [...source.matchAll(/```bash\n([\s\S]*?)```/g)].map(([, code]) => code);
  const setup = blocks.find(code => code.includes('YOUR_APPROVED_AZURE_REGION'));
  const context = blocks.find(code => code.includes('aspire secret set "Azure:Location"'));
  assert.ok(setup && context);
  const mock = `
az() {
  case "$*" in
    "account show --query id --output tsv") printf '%s\\n' '11111111-2222-3333-4444-555555555555' ;;
    "account show --query tenantId --output tsv") printf '%s\\n' 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' ;;
    *) printf 'Unexpected az arguments: %s\\n' "$*" >&2; return 1 ;;
  esac
}
aspire() { printf '%s\\n' "$*"; }
`;
  const inputs = setup.replace('YOUR_APPROVED_AZURE_REGION', 'eastus2').replace('rg-interview-coach-YOUR_NAME', 'rg-workshop-example');
  const result = spawnSync('bash', ['-eu'], { input: mock + inputs + context, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^secret set Azure:Location eastus2 --apphost \.\/apphost\.cs$/m);
  assert.match(result.stdout, /^secret set Azure:ResourceGroup rg-workshop-example --apphost \.\/apphost\.cs$/m);
});

test('Chapter 0 Bash commands reuse the ID returned by az account show without cloud access', bashOptions, () => {
  const source = readFileSync(new URL('workshop/00-orientation.mdx', content), 'utf8');
  const blocks = [...source.matchAll(/```bash\n([\s\S]*?)```/g)].map(([, code]) => code);
  const code = blocks.find(code => code.includes('subscriptionId='));
  assert.ok(code);
  const mock = `
az() {
  case "$*" in
    login) return 0 ;;
    "account show --query id --output tsv") printf '%s\\n' '11111111-2222-3333-4444-555555555555' ;;
    'account show --subscription 11111111-2222-3333-4444-555555555555 --query {subscription:name, subscriptionId:id, tenant:tenantId} --output table')
      printf '%s\\n' 'approved subscription' ;;
    *) printf 'Unexpected az arguments: %s\\n' "$*" >&2; return 1 ;;
  esac
}
`;
  const result = spawnSync('bash', ['-e'], { input: mock + code, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), 'approved subscription');
});

test('source-driven commands use the same shell tab component', () => {
  const component = readFileSync(new URL('../src/components/ShellCommands.astro', import.meta.url), 'utf8');
  assert.match(component, /<Tabs syncKey="shell">/);
  assert.match(component, /<TabItem label="Bash">/);
  assert.match(component, /<TabItem label="PowerShell">/);
  const orientation = readFileSync(new URL('workshop/00-orientation.mdx', content), 'utf8');
  assert.match(orientation, /<ShellCommands command=\{`git checkout --detach \$\{labs.sourceTag\}`\}/);
});

const rendered = `<starlight-tabs data-sync-key="shell">
<a role="tab">Bash</a><a role="tab">PowerShell</a>
<section role="tabpanel"><pre data-language="bash"><code>dotnet build</code></pre></section>
<section role="tabpanel" hidden><pre data-language="powershell"><code>dotnet build</code></pre></section>
</starlight-tabs>`;

test('rendered shell validation accepts paired tabs and ignores ordinary code and prompts', () => {
  assert.deepEqual(validateRenderedShellTabs(rendered), []);
  assert.deepEqual(validateRenderedShellTabs('<pre data-language="csharp">var x = 1;</pre><pre data-language="text">Ask a question.</pre>'), []);
});

test('rendered shell validation rejects bare commands, incomplete tabs, and wrong languages', () => {
  assert.match(validateRenderedShellTabs('<pre data-language="sh">dotnet build</pre>').join(), /outside/);
  assert.match(validateRenderedShellTabs(rendered.replace('>PowerShell</a>', '>Windows</a>')).join(), /Bash and PowerShell/);
  assert.match(validateRenderedShellTabs(rendered.replace('data-language="powershell"', 'data-language="bash"')).join(), /matching code languages/);
  assert.match(validateRenderedShellTabs(rendered.replace('data-sync-key="shell"', 'data-sync-key="other"')).join(), /sync key/);
});
