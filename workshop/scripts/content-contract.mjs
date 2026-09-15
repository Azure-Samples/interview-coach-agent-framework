const kinds = new Set(['tour', 'setup', 'build', 'verification']);
const rubricHeadings = /^(?:##) (?:What we are doing|Why|How and where|See it work|Make it yours|If you get stuck|Carry forward)\s*$/m;

export function stepReferences(source) {
  return [...source.matchAll(/<CodeStep\b[^>]*\bid=["']([^"']+)["']/g)].map(([, id]) => id);
}

export function validateCourseContent(course, manifest, pages) {
  const errors = [];
  const ids = new Set();
  const stages = new Set(manifest.stages.map(stage => stage.id));
  const numbered = course.chapters.some(chapter => chapter.number !== undefined);
  let previous;
  if (!course.chapters.length) errors.push('The curriculum has no chapters.');
  for (const chapter of course.chapters) {
    const prefix = `workshop/${chapter.id}`;
    if (ids.has(chapter.id)) errors.push(`${prefix}: duplicate curriculum ID.`);
    ids.add(chapter.id);
    if (numbered && chapter.number !== ids.size - 1) errors.push(`${prefix}: chapter numbers must start at zero and follow course order.`);
    if (numbered && (typeof chapter.group !== 'string' || !chapter.group.trim())) errors.push(`${prefix}: a numbered chapter needs a navigation group.`);
    if (!kinds.has(chapter.kind)) errors.push(`${prefix}: unknown chapter kind "${chapter.kind}".`);
    const source = pages.get(chapter.id);
    if (source === undefined) {
      errors.push(`${prefix}: chapter page is missing.`);
      continue;
    }
    const rawTitle = source.match(/^title:\s*(.+)$/m)?.[1].trim();
    const title = rawTitle?.replace(/^(['"])(.*)\1$/, '$2');
    if (title !== chapter.title) errors.push(`${prefix}: page title must match the curriculum title "${chapter.title}".`);
    if (rubricHeadings.test(source)) errors.push(`${prefix}: replace the generic teaching-rubric headings with headings about the actual work.`);
    if (!new RegExp(`<LessonProgress\\s[^>]*lessonId=["']${chapter.id}["']`).test(source)) {
      errors.push(`${prefix}: missing its own completion control.`);
    }
    if (!chapter.checkpoints?.length) errors.push(`${prefix}: no checkpoint is identified.`);
    for (const stage of chapter.checkpoints ?? []) {
      if (!stages.has(stage)) errors.push(`${prefix}: unknown checkpoint "${stage}".`);
    }
    if (chapter.kind === 'build' || chapter.kind === 'verification') {
      if (!chapter.from || !stages.has(chapter.from)) errors.push(`${prefix}: missing or invalid starting checkpoint.`);
      if (chapter.from !== previous) errors.push(`${prefix}: starts at "${chapter.from}" but the previous chapter ends at "${previous}".`);
    }
    if (chapter.kind !== 'tour') previous = chapter.checkpoints?.at(-1);
    if (chapter.kind === 'build') {
      if (!stepReferences(source).length) errors.push(`${prefix}: a build chapter needs source-backed code steps.`);
      if (!/```(?:bash|sh|shell|powershell)\b[\s\S]*?\b(?:aspire|dotnet)\b[\s\S]*?```/.test(source)) {
        errors.push(`${prefix}: a build chapter needs a runnable build or application command.`);
      }
    }
  }
  for (const id of course.support ?? []) {
    if (ids.has(id)) errors.push(`${id}: a support page cannot also be a core chapter.`);
    if (!pages.has(id)) errors.push(`${id}: support page is missing.`);
    if (pages.get(id)?.includes('<LessonProgress')) errors.push(`${id}: support pages must not mark a different chapter complete.`);
  }
  for (const id of pages.keys()) {
    if (id !== 'index' && !ids.has(id) && !course.support?.includes(id)) errors.push(`${id}: page is not listed as a chapter or support page.`);
  }
  for (const [previous, current] of Object.entries(course.legacyChapterIds ?? {})) {
    if (ids.has(previous)) errors.push(`${previous}: a legacy chapter ID cannot shadow a current chapter.`);
    if (!ids.has(current)) errors.push(`${previous}: legacy chapter destination "${current}" is not a current chapter.`);
  }
  return errors;
}

export function validateLegacyRedirects(course, base, pages) {
  const errors = [];
  const destinations = [
    ...Object.entries(course.legacyChapterIds ?? {}).map(([previous, current]) => [previous, `${current}/`]),
    ['01-readiness', '00-orientation/#check-your-tools']
  ];
  for (const [previous, current] of destinations) {
    const html = pages.get(previous);
    if (html === undefined) {
      errors.push(`Missing static redirect for workshop/${previous}/.`);
      continue;
    }
    const refresh = [...html.matchAll(/<meta\b[^>]*>/gi)]
      .find(([tag]) => /\bhttp-equiv\s*=\s*["']refresh["']/i.test(tag))?.[0];
    const content = refresh?.match(/\bcontent\s*=\s*(["'])(.*?)\1/i)?.[2];
    const target = content?.match(/^\s*\d+(?:\.\d+)?\s*;\s*url=(.*)$/i)?.[1];
    const expected = `${base.replace(/\/$/, '')}/workshop/${current}`;
    if (target !== expected) {
      errors.push(`workshop/${previous}/: the static redirect must lead to ${expected} without requiring JavaScript.`);
    }
  }
  return errors;
}

export function validateEditCoverage(course, pages, steps) {
  const errors = [];
  const known = new Map();
  for (const step of steps) {
    if (known.has(step.id)) errors.push(`Duplicate edit-step ID "${step.id}".`);
    known.set(step.id, step);
  }
  const covered = new Set();
  for (const chapter of course.chapters) {
    const source = pages.get(chapter.id) ?? '';
    const refs = stepReferences(source);
    const seen = new Set();
    for (const id of refs) {
      const step = known.get(id);
      if (!step) {
        errors.push(`${chapter.id}: unknown edit step "${id}".`);
        continue;
      }
      if (seen.has(id)) errors.push(`${chapter.id}: edit step "${id}" is repeated.`);
      seen.add(id);
      if (chapter.kind !== 'build' || !chapter.checkpoints.includes(step.to)) {
        errors.push(`${chapter.id}: edit step "${id}" does not belong to this chapter's transition.`);
      }
      if (covered.has(id)) errors.push(`${chapter.id}: edit step "${id}" is already taught in another chapter.`);
      covered.add(id);
    }
    if (chapter.kind === 'build') {
      const expected = steps.filter(item => chapter.checkpoints.includes(item.to));
      for (const step of expected) {
        if (!seen.has(step.id)) errors.push(`${chapter.id}: missing learner edit "${step.id}" in ${step.path}.`);
      }
      if (refs.length === expected.length && refs.some((id, index) => id !== expected[index].id)) {
        errors.push(`${chapter.id}: code steps must follow the replay order: ${expected.map(step => step.id).join(', ')}.`);
      }
    }
  }
  for (const step of steps) {
    if (!covered.has(step.id)) errors.push(`Edit step "${step.id}" is not taught by any chapter.`);
  }
  return errors;
}
