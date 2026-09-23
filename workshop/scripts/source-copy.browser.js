async (page) => {
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.reload();
  await page.locator('#sample workshop-source-code').waitFor();
  const readClipboard = () => page.evaluate(() => navigator.clipboard.readText());
  const sample = page.locator('#sample workshop-source-code');
  const expected = await sample.evaluate(block => JSON.parse(block.dataset.copySource));
  const button = sample.getByRole('button', { name: 'Copy to clipboard' });
  await button.focus();
  await page.keyboard.press('Enter');
  check(await readClipboard() === expected, 'Enter must copy exact sample bytes');
  check(await sample.getByRole('status').textContent() === 'Copied!', 'Copy must announce success');
  check(await button.evaluate(node => node === document.activeElement), 'Success must preserve button focus');
  await page.keyboard.press('Space');
  check(await readClipboard() === expected, 'Space must activate the native button');

  await page.locator('[data-code-step="replace"] summary').click();
  const before = page.locator('[data-code-step="replace"] details workshop-source-code');
  await before.getByRole('button', { name: 'Copy to clipboard' }).click();
  check(await readClipboard() === await before.evaluate(block => JSON.parse(block.dataset.copySource)), 'Current code must copy its own exact source');
  for (const id of ['replace', 'create', 'delete', 'remove', 'top-level', 'imports', 'multi-function']) {
    const result = page.locator(`[data-code-step="${id}"] [data-step-result] workshop-source-code`);
    await result.getByRole('button', { name: 'Copy to clipboard' }).click();
    check(await readClipboard() === await result.evaluate(block => JSON.parse(block.dataset.copySource)), `Incorrect result bytes: ${id}`);
  }
  for (const shell of ['Bash', 'PowerShell']) {
    await page.getByRole('tab', { name: shell, exact: true }).click();
    const panel = page.getByRole('tabpanel', { name: shell, exact: true });
    await panel.getByRole('button', { name: 'Copy to clipboard' }).click();
    check(await readClipboard() === '# Keep this comment\nprintf "hello\\n"\n', `${shell} copy must keep comments and trailing newline`);
  }
  await page.evaluate(() => {
    const source = document.querySelector('#sample workshop-source-code');
    source.remove();
    document.querySelector('#sample').append(source);
    document.dispatchEvent(new Event('astro:page-load'));
    window.copyWrites = [];
    window.originalClipboardWrite = navigator.clipboard.writeText.bind(navigator.clipboard);
    navigator.clipboard.writeText = async text => { window.copyWrites.push(text); };
  });
  await button.click();
  check(await page.evaluate(() => window.copyWrites.length) === 1, 'Reconnection must not copy twice');

  await page.evaluate(() => {
    navigator.clipboard.writeText = async () => { throw new DOMException('Denied', 'NotAllowedError'); };
  });
  await button.focus();
  await page.keyboard.press('Enter');
  const fallback = sample.getByRole('textbox', { name: 'Code to copy' });
  check(await fallback.isVisible(), 'Denied clipboard must reveal a manual fallback');
  check(await fallback.evaluate(node => document.activeElement === node && node.selectionStart === 0 && node.selectionEnd === node.value.length),
    'Fallback must receive focus with the complete source selected');
  check((await sample.getByRole('status').textContent()).includes('Ctrl+C or Command+C'), 'Fallback must explain keyboard copying');
  await page.keyboard.press('ControlOrMeta+C');
  check(await readClipboard() === expected, 'Manual full-selection copy must preserve original CRLF');
  await page.evaluate(() => { navigator.clipboard.writeText = window.originalClipboardWrite; });
  await button.click();
  await fallback.waitFor({ state: 'hidden' });

  const styles = await page.locator('#ordinary .copy button, #sample .copy button').evaluateAll(buttons =>
    buttons.map(node => {
      const style = getComputedStyle(node);
      return [style.width, style.height, style.padding, style.borderRadius, style.backgroundColor];
    }));
  check(JSON.stringify(styles[0]) === JSON.stringify(styles[1]), 'Custom samples must retain native copy control styling');
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `Page overflows at ${width}px`);
  }
  return 'Passed: native controls, Enter/Space, exact bytes, current/create/delete/remove code, both shells, fallback/manual copy, reconnect, native styles and responsive widths.';
}
