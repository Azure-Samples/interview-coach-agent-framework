async (page) => {
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const base = await page.evaluate(() => new URL('../../', window.location.href).href);
  const errors = [];
  const onError = error => errors.push(error.message);
  page.on('pageerror', onError);
  const pages = [
    '', 'workshop/02-first-coach/', 'workshop/07-persistence/',
    'workshop/10-first-handoff/', 'workshop/11-interviewers/',
    'workshop/12-handoffs/', 'workshop/13-debugging/', 'resources/your-own-agent/',
  ];
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of pages) {
      const response = await page.goto(`${base}${path}`);
      check(response?.ok(), `Page failed: ${path}`);
      check(await page.locator('main h1').count() === 1, `Missing page heading: ${path}`);
      check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        `Page overflows at ${width}px: ${path}`);
    }
  }
  for (const chapter of ['02-first-coach', '04-tools', '06-mcp-state', '07-persistence', '10-first-handoff', '12-handoffs']) {
    await page.goto(`${base}workshop/${chapter}/`);
    const form = page.locator('.knowledge-check');
    await form.locator('input[data-correct="false"]').first().check();
    await form.getByRole('button', { name: 'Check answer', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.check-feedback')?.textContent.startsWith('Incorrect.'));
    await form.getByRole('button', { name: 'Clear answer', exact: true }).click();
    check(await form.locator('input:checked').count() === 0, `Reset left an answer selected: ${chapter}`);
    check(await form.locator('.check-feedback').textContent() === '', `Reset left feedback: ${chapter}`);
    await form.locator('input[data-correct="true"]').focus();
    await page.keyboard.press('Space');
    await form.getByRole('button', { name: 'Check answer', exact: true }).focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('.check-feedback')?.textContent.startsWith('Correct.'));
  }

  await page.goto(`${base}resources/your-own-agent/`);
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  const source = page.locator('#independent-agent-source workshop-source-code');
  const expected = await source.evaluate(element => JSON.parse(element.dataset.copySource));
  check(expected.includes('AgentSession session = await agent.CreateSessionAsync();'), 'The session example is missing.');
  await source.getByRole('button', { name: 'Copy to clipboard' }).focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() =>
    document.querySelector('#independent-agent-source [data-copy-status]')?.textContent === 'Copied!');
  check(await page.evaluate(() => navigator.clipboard.readText()) === expected, 'The independent example copied different source.');

  const browser = page.context().browser();
  check(browser, 'A browser is required for the no-JavaScript check.');
  const noJs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 900 } });
  try {
    const fallback = await noJs.newPage();
    await fallback.goto(`${base}workshop/07-persistence/`);
    check(await fallback.locator('.knowledge-check noscript p').isVisible(), 'No-JavaScript answers are hidden.');
    check(await fallback.locator('.knowledge-check noscript li').count() === 3, 'No-JavaScript explanations are incomplete.');
    check(await fallback.locator('[data-code-step="persistence-session-lifecycle"] pre').count() > 0,
      'Source code must remain readable without JavaScript.');
  } finally {
    await noJs.close();
  }
  page.off('pageerror', onError);
  check(errors.length === 0, `Browser errors: ${errors.join('; ')}`);
  return 'Passed: eight pages at desktop/mobile widths, all six knowledge checks, keyboard/reset feedback, exact example copying, and no-JavaScript answers.';
}
