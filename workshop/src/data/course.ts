import course from './course.json';

export const curriculumVersion = course.version;
export const previousCurriculumVersions = course.previousVersions;
export const legacyChapterIds = course.legacyChapterIds;
export const chapters = course.chapters;
export type Chapter = (typeof chapters)[number];
export const chapterGroups = [...new Set(chapters.map(chapter => chapter.group))].map(label => ({
  label,
  chapters: chapters.filter(chapter => chapter.group === label)
}));
export const lessons = chapters.map(({ id, title, description }) => [id, title, description] as const);

export function siteLink(path: string) {
  return `${import.meta.env.BASE_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}
