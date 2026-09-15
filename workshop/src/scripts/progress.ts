import { chapters, legacyChapterIds, previousCurriculumVersions } from '../data/course';
import {
  continueLink, createProgressStore, nextChapterLink, progressKey, progressSummary
} from './progress-state.mjs';

type ProgressStore = ReturnType<typeof createProgressStore>;
type ProgressState = ReturnType<ProgressStore['read']>;

const stores = new Map<string, ProgressStore>();
const connectedControls = new WeakSet<Element>();
let listening = false;

function context(root: HTMLElement) {
  const { base, version } = root.dataset;
  if (base === undefined || !version) throw new Error('Progress needs a base path and curriculum version.');
  const key = progressKey(base, version);
  let store = stores.get(key);
  if (!store) {
    store = createProgressStore({ base, version, previousVersions: previousCurriculumVersions, chapters, legacyChapterIds }, () => window.localStorage);
    stores.set(key, store);
  }
  return { base, store };
}

function setLink(link: HTMLAnchorElement, value: { href: string; label: string }) {
  link.href = value.href;
  link.textContent = value.label;
}

function renderProgress(key: string, state: ProgressState) {
  document.querySelectorAll<HTMLElement>('[data-progress-root]').forEach(root => {
    const { base, store } = context(root);
    if (store.key !== key) return;
    root.querySelectorAll<HTMLElement>('[data-progress-summary]').forEach(summary => {
      summary.textContent = progressSummary(state, chapters);
    });
    root.querySelectorAll<HTMLElement>('[data-progress-id]').forEach(item => {
      const completed = state.ids.includes(item.dataset.progressId ?? '');
      item.dataset.completed = String(completed);
      if (item.dataset.progressLabel) {
        item.setAttribute('aria-label', `${item.dataset.progressLabel}, ${completed ? 'completed' : 'not completed'}`);
      }
    });
    root.querySelectorAll<HTMLInputElement>('[data-progress-toggle]').forEach(checkbox => {
      checkbox.checked = state.ids.includes(checkbox.dataset.progressToggle ?? '');
    });
    root.querySelectorAll<HTMLAnchorElement>('[data-continue]').forEach(link => {
      setLink(link, continueLink(state.ids, chapters, base, link.dataset.startAt === 'chapter' ? 'chapter' : 'overview'));
    });
    root.querySelectorAll<HTMLAnchorElement>('[data-progress-next]').forEach(link => {
      setLink(link, nextChapterLink(state.ids, chapters, base, link.dataset.progressNext ?? ''));
    });
  });
}

export function connectProgress() {
  if (typeof document === 'undefined') return;
  const active = new Set<ProgressStore>();
  document.querySelectorAll<HTMLElement>('[data-progress-root]').forEach(root => {
    const { store } = context(root);
    active.add(store);
    root.querySelectorAll<HTMLInputElement>('[data-progress-toggle]').forEach(checkbox => {
      if (connectedControls.has(checkbox)) return;
      connectedControls.add(checkbox);
      checkbox.addEventListener('change', () => {
        renderProgress(store.key, store.toggle(checkbox.dataset.progressToggle ?? '', checkbox.checked));
      });
    });
    root.querySelectorAll<HTMLButtonElement>('[data-progress-reset]').forEach(button => {
      if (connectedControls.has(button)) return;
      connectedControls.add(button);
      button.addEventListener('click', () => {
        if (!window.confirm('Clear the completion marks for this version of the workshop? Your project files and earlier workshop records will stay unchanged.')) return;
        renderProgress(store.key, store.reset());
      });
    });
  });
  active.forEach(store => renderProgress(store.key, store.read()));
  if (listening) return;
  listening = true;
  document.addEventListener('astro:page-load', connectProgress);
  window.addEventListener('pageshow', connectProgress);
  window.addEventListener('storage', event => {
    if (event.storageArea) {
      try {
        if (event.storageArea !== window.localStorage) return;
      } catch {
        stores.forEach(store => renderProgress(store.key, store.read()));
        return;
      }
    }
    stores.forEach(store => {
      if (store.accepts(event.key)) renderProgress(store.key, store.sync(event.key));
    });
  });
}
