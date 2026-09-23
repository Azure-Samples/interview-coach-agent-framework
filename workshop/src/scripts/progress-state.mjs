// @ts-check

/** @typedef {{ id: string, number: number, title: string }} Chapter */
/** @typedef {{ ids: string[], warning: string, saved: boolean }} ProgressState */
/** @typedef {{ ids: string[] | null, warning: string, migrated: boolean }} ParsedProgress */
/** @typedef {Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>} ProgressStorage */

/** @param {string} base @param {string} version */
export function progressKey(base, version) {
  return `interview-coach:${base}:v${version}`;
}

/** @param {string} base @param {string} path */
function linkTo(base, path) {
  return `${base.replace(/\/$/, '')}/${path}`;
}

/**
 * @param {string | null} raw
 * @param {readonly Chapter[]} chapters
 * @param {Readonly<Record<string, string>>} [legacyChapterIds]
 * @returns {ParsedProgress}
 */
export function parseProgress(raw, chapters, legacyChapterIds = {}) {
  if (raw === null) return { ids: [], warning: '', migrated: false };
  /** @type {unknown} */
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    return { ids: null, warning: 'The saved completion record could not be read. You can mark chapters again or clear this version\'s progress.', migrated: false };
  }
  const knownIds = new Set(chapters.map(chapter => chapter.id));
  if (!Array.isArray(value) || !value.every(id => typeof id === 'string' &&
      (knownIds.has(id) || (Object.hasOwn(legacyChapterIds, id) && knownIds.has(legacyChapterIds[id]))))) {
    return { ids: null, warning: 'The saved completion record is not valid for these chapters. You can mark them again or clear this version\'s progress.', migrated: false };
  }
  const canonicalIds = value.map(id => Object.hasOwn(legacyChapterIds, id) ? legacyChapterIds[id] : id);
  return {
    ids: chapters.filter(chapter => canonicalIds.includes(chapter.id)).map(chapter => chapter.id),
    warning: '',
    migrated: canonicalIds.some((id, index) => id !== value[index])
  };
}

/** @param {readonly string[]} ids @param {readonly Chapter[]} chapters */
export function progressView(ids, chapters) {
  const completed = new Set(ids);
  const count = chapters.filter(chapter => completed.has(chapter.id)).length;
  return {
    count,
    total: chapters.length,
    complete: count === chapters.length,
    next: chapters.find(chapter => !completed.has(chapter.id))
  };
}

/**
 * @param {readonly string[]} ids
 * @param {readonly Chapter[]} chapters
 * @param {string} base
 * @param {'overview' | 'chapter'} [startAt]
 */
export function continueLink(ids, chapters, base, startAt = 'overview') {
  const { count, next } = progressView(ids, chapters);
  if (!count && startAt === 'overview') {
    return { href: linkTo(base, 'workshop/'), label: 'Start the workshop' };
  }
  if (next) {
    return {
      href: linkTo(base, `workshop/${next.id}/`),
      label: `${count ? 'Continue' : 'Start'}: ${next.number}. ${next.title}`
    };
  }
  const last = chapters[chapters.length - 1];
  return {
    href: linkTo(base, last ? `workshop/${last.id}/` : 'workshop/'),
    label: 'Review the completed workshop'
  };
}

/** @param {readonly string[]} ids @param {readonly Chapter[]} chapters @param {string} base @param {string} currentId */
export function nextChapterLink(ids, chapters, base, currentId) {
  const index = chapters.findIndex(chapter => chapter.id === currentId);
  if (index < 0) throw new Error(`Unknown chapter ${currentId}`);
  const candidates = [...chapters.slice(index + 1), ...chapters.slice(0, index)];
  const next = candidates.find(chapter => !ids.includes(chapter.id));
  return next
    ? { href: linkTo(base, `workshop/${next.id}/`), label: `Next: ${next.number}. ${next.title}` }
    : { href: linkTo(base, 'workshop/'), label: 'Return to your workshop path' };
}

/** @param {ProgressState} state @param {readonly Chapter[]} chapters */
export function progressSummary(state, chapters) {
  const { count, total } = progressView(state.ids, chapters);
  const summary = `${count} of ${total} chapters completed ${state.saved ? 'in this browser' : 'on this page'}.`;
  return state.warning ? `${summary} ${state.warning}` : summary;
}

/**
 * Storage is injected so importing this module never touches browser globals.
 * An unsaved edit remains authoritative until another tab changes the record.
 * @param {{ base: string, version: string, previousVersions: readonly string[], chapters: readonly Chapter[], legacyChapterIds?: Readonly<Record<string, string>> }} course
 * @param {() => ProgressStorage} getStorage
 */
export function createProgressStore(course, getStorage) {
  const key = progressKey(course.base, course.version);
  const previousKeys = course.previousVersions.map(version => progressKey(course.base, version));
  /** @type {string[]} */
  let memory = [];
  let unsaved = false;
  const unavailable = 'Browser storage is unavailable. Progress lasts only while this page is open.';

  /** @param {string} [warning] @param {boolean} [saved] @returns {ProgressState} */
  function snapshot(warning = '', saved = true) {
    return { ids: [...memory], warning, saved };
  }

  function read() {
    if (unsaved) return snapshot(unavailable, false);
    try {
      const storage = getStorage();
      const raw = storage.getItem(key);
      const parsed = parseProgress(raw, course.chapters, course.legacyChapterIds);
      if (parsed.ids === null) return snapshot(parsed.warning);
      memory = parsed.ids;
      if (parsed.migrated) {
        try {
          storage.setItem(key, JSON.stringify(memory));
        } catch {
          unsaved = true;
          return snapshot(unavailable, false);
        }
      }
      const earlier = !raw && previousKeys.some(previousKey => storage.getItem(previousKey) !== null);
      return snapshot(earlier
        ? 'We have revised the workshop. Your earlier progress is still saved; mark these chapters as you finish them.'
        : '');
    } catch {
      return snapshot(unavailable, false);
    }
  }

  /** @param {string} id @param {boolean} completed */
  function toggle(id, completed) {
    if (!course.chapters.some(chapter => chapter.id === id)) throw new Error(`Unknown chapter ${id}`);
    const ids = new Set(read().ids);
    completed ? ids.add(id) : ids.delete(id);
    memory = course.chapters.filter(chapter => ids.has(chapter.id)).map(chapter => chapter.id);
    try {
      getStorage().setItem(key, JSON.stringify(memory));
      unsaved = false;
      return snapshot();
    } catch {
      unsaved = true;
      return snapshot(unavailable, false);
    }
  }

  function reset() {
    memory = [];
    try {
      getStorage().removeItem(key);
      unsaved = false;
      return snapshot('Progress reset. Your project files are unchanged.');
    } catch {
      unsaved = true;
      return snapshot(`Progress reset on this page. ${unavailable}`, false);
    }
  }

  /** @param {string | null} changedKey */
  function sync(changedKey) {
    if (changedKey === null || changedKey === key) {
      unsaved = false;
      memory = [];
    }
    return read();
  }

  return {
    key,
    read,
    toggle,
    reset,
    sync,
    /** @param {string | null} changedKey */
    accepts: changedKey => changedKey === null || changedKey === key || previousKeys.includes(changedKey)
  };
}
