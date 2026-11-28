import type { CurriculumCourse, RequirementGroup } from '../curriculum/api.js';

export function unlockedBy(groups: readonly RequirementGroup[], courseCode: string): CurriculumCourse[] {
  const seen = new Set<string>();
  const unlocked: CurriculumCourse[] = [];
  for (const group of groups) {
    for (const course of group.courses) {
      if (seen.has(course.code)) continue;
      if (Array.isArray(course.prerequisites) && course.prerequisites.includes(courseCode)) {
        seen.add(course.code);
        unlocked.push(course);
      }
    }
  }
  return unlocked;
}
