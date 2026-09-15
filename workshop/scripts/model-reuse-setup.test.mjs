import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const variableNames = ['location', 'resourceGroup', 'foundryName', 'deploymentName'];
const values = ['eastus2', 'rg-workshop-example', 'foundry-example', 'chat'];
const environment = { ...process.env };
for (const name of variableNames) delete environment[name];

function setupBlocks(language) {
  const readBlocks = page => {
    const source = readFileSync(new URL(`../src/content/docs/workshop/${page}.mdx`, import.meta.url), 'utf8');
    return [...source.matchAll(new RegExp('```' + language + '\\n([\\s\\S]*?)```', 'g'))].map(([, code]) => code);
  };
  const orientation = readBlocks('00-orientation');
  const find = (blocks, text) => {
    const matches = blocks.filter(code => code.includes(text));
    assert.equal(matches.length, 1, text);
    return matches[0];
  };
  return {
    variables: find(orientation, 'YOUR_APPROVED_AZURE_REGION')
      .replace('YOUR_APPROVED_AZURE_REGION', values[0])
      .replace('rg-interview-coach-YOUR_NAME', values[1]),
    accounts: find(orientation, 'az cognitiveservices account list'),
    deployments: find(orientation, language === 'bash' ? 'export deploymentName=' : '$env:deploymentName ='),
    learner: find(readBlocks('02-first-coach'), 'dotnet user-secrets set'),
  };
}

const subscription = '11111111-2222-3333-4444-555555555555';
const tenant = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const accountArgs = `cognitiveservices account list --subscription ${subscription} --resource-group ${values[1]} --query [?kind=='AIServices' && location=='${values[0]}'].name --output tsv`;

const bashProbe = spawnSync('bash', ['--version']);
const powershellProbe = spawnSync('pwsh', ['-NoProfile', '-NonInteractive', '-Command', '$PSVersionTable.PSVersion.ToString()']);
const options = probe => ({
  skip: probe.error?.code === 'ENOENT' ? 'The shell is not installed on this authoring machine.' : false,
});
const bashMock = `
az() {
  case "$*" in
    "account show --query id --output tsv") printf '%s\\n' '${subscription}' ;;
    "account show --query tenantId --output tsv") printf '%s\\n' '${tenant}' ;;
    "${accountArgs}") printf '%s\\n' '${values[2]}' ;;
    *) printf 'Unexpected az arguments: %s\\n' "$*" >&2; return 1 ;;
  esac
}
dotnet() { printf '%s\\n' "$*"; }
`;

function assertLearnerSettings(output) {
  const expected = {
    'Azure:SubscriptionId': subscription,
    'Azure:TenantId': tenant,
    'Azure:ResourceGroup': values[1],
    'Azure:Location': values[0],
    'Azure:CredentialSource': 'AzureCli',
    'MicrosoftFoundry:Existing:Name': values[2],
    'MicrosoftFoundry:Existing:ResourceGroup': values[1],
    'MicrosoftFoundry:Existing:SubscriptionId': subscription,
    'MicrosoftFoundry:Existing:DeploymentName': values[3],
  };
  const writes = output.split(/\r?\n/).filter(line => line.startsWith('user-secrets set '));
  assert.deepEqual(writes, Object.entries(expected).map(([key, value]) => `user-secrets set ${key} ${value} --file ./apphost.cs`));
}

test('Chapter 2 consumes Chapter 0 environment variables without placeholder replacements', () => {
  for (const language of ['bash', 'powershell']) {
    const blocks = setupBlocks(language);
    assert.doesNotMatch(blocks.learner, /YOUR_|az cognitiveservices account show/);
    assert.ok(blocks.accounts.includes(language === 'bash' ? 'export foundryName' : '$env:foundryName = az cognitiveservices account list'));
    assert.equal(blocks.deployments.trim(), language === 'bash' ? 'export deploymentName="chat"' : '$env:deploymentName = "chat"');
    assert.match(blocks.accounts, /\.name" --output tsv/);
    assert.doesNotMatch(blocks.accounts, /--output table|read -r|Read-Host|unset|\$null|\bif\b/);
    assert.equal(blocks.accounts.trim().split('\n').length, language === 'bash' ? 2 : 1);
    for (const name of variableNames) {
      assert.ok(blocks.learner.includes(language === 'bash' ? `"${'$'}{${name}:?` : `$env:${name}`), name);
    }
  }
});

test('Bash setup exports the account and known deployment for Chapter 2 without prompts', options(bashProbe), () => {
  assert.equal(bashProbe.status, 0);
  const blocks = setupBlocks('bash');
  const script = bashMock + `subscriptionId="${subscription}"\n` +
    blocks.variables + blocks.accounts + blocks.deployments +
    `bash -c 'printf "inherited: %s|%s|%s|%s\\n" "$location" "$resourceGroup" "$foundryName" "$deploymentName"'\n` +
    blocks.learner;
  const result = spawnSync('bash', ['-eu', '-c', script], {
    encoding: 'utf8', env: environment,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.includes(`inherited: ${values.join('|')}`));
  assertLearnerSettings(result.stdout);
});

test('Bash account lookup failures remain visible', options(bashProbe), () => {
  const { accounts } = setupBlocks('bash');
  const script = `az() { echo "Lookup failed" >&2; return 1; }\n` + accounts;
  const result = spawnSync('bash', ['-c', script], { encoding: 'utf8', env: environment });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Lookup failed/);
});

test('Bash learner setup stops before writing if any environment variable is missing', options(bashProbe), () => {
  const { learner } = setupBlocks('bash');
  for (const missing of variableNames) {
    const env = { ...environment, ...Object.fromEntries(variableNames.map((name, i) => [name, values[i]])) };
    delete env[missing];
    const result = spawnSync('bash', ['-c', bashMock + learner], { encoding: 'utf8', env });
    assert.notEqual(result.status, 0, missing);
    assert.match(result.stderr, /Run the Chapter 0/);
    assert.doesNotMatch(result.stdout, /user-secrets set/);
  }
});

test('PowerShell setup retains environment variables for Chapter 2 without prompts', options(powershellProbe), () => {
  assert.equal(powershellProbe.status, 0);
  const blocks = setupBlocks('powershell');
  const mock = `
$ErrorActionPreference = 'Stop'
$subscriptionId = '${subscription}'
function az {
  $global:LASTEXITCODE = 0
  switch -Exact ($args -join ' ') {
    'account show --query id --output tsv' { '${subscription}' }
    'account show --query tenantId --output tsv' { '${tenant}' }
    '${accountArgs.replaceAll("'", "''")}' { '${values[2]}' }
    default { throw "Unexpected az arguments: $args" }
  }
}
function dotnet { $args -join ' ' }
`;
  const result = spawnSync('pwsh', ['-NoProfile', '-NonInteractive', '-Command',
    mock + blocks.variables + blocks.accounts + blocks.deployments +
    `pwsh -NoProfile -NonInteractive -Command 'Write-Output "inherited: $env:location|$env:resourceGroup|$env:foundryName|$env:deploymentName"'\n` +
    blocks.learner], { encoding: 'utf8', env: environment });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.includes(`inherited: ${values.join('|')}`));
  assertLearnerSettings(result.stdout);

  for (const missing of variableNames) {
    const env = { ...environment, ...Object.fromEntries(variableNames.map((name, i) => [name, values[i]])) };
    delete env[missing];
    const absent = spawnSync('pwsh', ['-NoProfile', '-NonInteractive', '-Command', mock + blocks.learner],
      { encoding: 'utf8', env });
    assert.notEqual(absent.status, 0, missing);
    assert.match(absent.stderr, /Run the Chapter 0/);
    assert.doesNotMatch(absent.stdout, /user-secrets set/);
  }
});
