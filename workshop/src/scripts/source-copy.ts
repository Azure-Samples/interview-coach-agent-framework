const connected = new WeakSet<HTMLElement>();

export function connectSourceCopy(root: HTMLElement) {
  if (connected.has(root)) return;
  const button = root.querySelector<HTMLButtonElement>('.expressive-code .copy button[data-code]');
  const status = root.querySelector<HTMLElement>('[data-copy-status]');
  const fallback = root.querySelector<HTMLTextAreaElement>('[data-copy-fallback]');
  const encoded = root.dataset.copySource;
  if (!button || !status || !fallback || encoded === undefined) {
    throw new Error('The source code block is missing its copy control or exact source.');
  }
  const source: unknown = JSON.parse(encoded);
  if (typeof source !== 'string') throw new Error('The source code block has invalid copy text.');
  connected.add(root);
  button.type = 'button';
  fallback.addEventListener('copy', event => {
    if (event.clipboardData && fallback.selectionStart === 0 && fallback.selectionEnd === fallback.value.length) {
      // Textarea values normalize CRLF; use the original for a full manual copy.
      event.clipboardData.setData('text/plain', source);
      event.preventDefault();
      status.textContent = button.dataset.copied ?? 'Copied!';
    }
  });

  // Keep EC's native control, but do not copy its whitespace-normalized data-code.
  // Capture only clicks on this wrapper's button, before EC's bubbling listener.
  button.addEventListener('click', async event => {
    event.stopImmediatePropagation();
    status.textContent = '';
    try {
      await navigator.clipboard.writeText(source);
      fallback.hidden = true;
      status.textContent = button.dataset.copied ?? 'Copied!';
    } catch {
      fallback.value = source;
      fallback.rows = Math.min(18, source.split('\n').length + 1);
      fallback.hidden = false;
      fallback.focus();
      fallback.select();
      status.textContent = 'The code is selected below. Press Ctrl+C or Command+C to copy it.';
    }
  }, { capture: true });
}
