import { lessons } from '../data/course';

const memory = new Map<string, string[]>();
const knownIds = new Set<string>(lessons.map(lesson => lesson[0]));

function readProgress(key: string): { ids: string[]; warning: string } {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { ids: memory.get(key) ?? [], warning: '' };
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value) || !value.every(id => typeof id === 'string' && knownIds.has(id))) {
      return { ids: memory.get(key) ?? [], warning: 'Saved progress could not be read. Mark completed lessons again, or reset it.' };
    }
    return { ids: value, warning: '' };
  } catch (error) {
    if (error instanceof SyntaxError) return { ids: memory.get(key) ?? [], warning: 'Saved progress is damaged. Your lessons are still available; reset progress to start fresh.' };
    return { ids: memory.get(key) ?? [], warning: 'Browser storage is unavailable. Progress lasts only while this page is open.' };
  }
}

export function connectProgress() {
  document.querySelectorAll<HTMLElement>('[data-lesson-progress]').forEach(panel => {
    if (panel.dataset.connected) return;
    panel.dataset.connected = 'true';
    const key = `interview-coach:${panel.dataset.base}:v${panel.dataset.version}`;
    const id = panel.dataset.id!;
    const checkbox = panel.querySelector<HTMLInputElement>('input')!;
    const status = panel.querySelector<HTMLElement>('.progress-status')!;
    const current = readProgress(key);
    checkbox.checked = current.ids.includes(id);
    status.textContent = current.warning || `${current.ids.length} of ${lessons.length} lessons completed on this browser.`;
    checkbox.addEventListener('change', () => {
      const existing = readProgress(key);
      const ids = new Set(existing.ids);
      checkbox.checked ? ids.add(id) : ids.delete(id);
      const value = [...ids];
      memory.set(key, value);
      try {
        localStorage.setItem(key, JSON.stringify(value));
        status.textContent = `${value.length} of ${lessons.length} lessons completed on this browser.`;
      } catch {
        status.textContent = 'Progress updated for this page only; browser storage is unavailable.';
      }
    });
    panel.querySelector('button')!.addEventListener('click', () => {
      if (!confirm('Reset completion for every lesson in this workshop version? This will not change your code.')) return;
      memory.set(key, []);
      checkbox.checked = false;
      try { localStorage.removeItem(key); status.textContent = 'Progress reset. Your project files are unchanged.'; }
      catch { status.textContent = 'Progress reset for this page; browser storage is unavailable.'; }
    });
  });
  document.querySelectorAll<HTMLAnchorElement>('[data-continue]').forEach(link => {
    const key = `interview-coach:${link.dataset.base}:v${link.dataset.version}`;
    const { ids, warning } = readProgress(key);
    const summary = link.parentElement?.querySelector('[data-course-progress]');
    if (summary && (ids.length || warning)) summary.textContent = warning || `${ids.length} of ${lessons.length} lessons completed on this browser.`;
    const next = lessons.find(lesson => !ids.includes(lesson[0]));
    if (ids.length && next) {
      link.href = `${link.dataset.base!.replace(/\/$/, '')}/workshop/${next[0]}/`;
      link.textContent = `Continue: ${next[1]}`;
    }
    if (!next) {
      link.href = `${link.dataset.base!.replace(/\/$/, '')}/workshop/08-capstone/`;
      link.textContent = 'Review your completed workshop';
    }
  });
}
