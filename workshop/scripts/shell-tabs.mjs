const shellLanguages = new Set(['sh', 'bash', 'shell', 'powershell', 'ps1', 'console', 'zsh']);
const languages = html => [...html.matchAll(/<pre\b[^>]*\bdata-language="([^"]+)"/g)]
  .map(([, language]) => language).filter(language => shellLanguages.has(language));

export function validateRenderedShellTabs(html) {
  const errors = [];
  const outsideTabs = html.replace(/<starlight-tabs\b([^>]*)>([\s\S]*?)<\/starlight-tabs>/g,
    (group, attributes, body) => {
      const shells = languages(body);
      if (!shells.length) return group;
      if (!/\bdata-sync-key="shell"/.test(attributes)) {
        errors.push('Shell tabs must use the shared "shell" sync key.');
      }
      const labels = [...body.matchAll(/<a\b[^>]*\brole="tab"[^>]*>([\s\S]*?)<\/a>/g)]
        .map(([, label]) => label.trim());
      if (labels.join(',') !== 'Bash,PowerShell' || shells.join(',') !== 'bash,powershell') {
        errors.push('Every shell example must have Bash and PowerShell tabs with matching code languages.');
      }
      return '';
    });
  if (languages(outsideTabs).length) errors.push('A rendered shell example is outside its Bash/PowerShell tabs.');
  return errors;
}
