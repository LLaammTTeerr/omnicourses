import { computed, type Ref } from 'vue';
import { useAsyncLoad } from '../async-load.js';
import { useAudit } from '../audit/present.js';
import { useAuth } from '../auth/store.js';
import { fetchCurriculum, type CurriculumCourse, type RequirementGroup } from '../curriculum/api.js';
import { groupColour, orderGroups, type GroupId } from '../groups.js';
import { localName, useLocale } from '../locale.js';
import { compareTerms, type Term } from '../terms.js';
import { useTranscriptCodes } from '../transcript/codes.js';
import type { Plan } from './api.js';

export interface CourseInfo {
  course: CurriculumCourse;
  colour: GroupId;
}

/**
 * What the planner shows around the board, read from other features: the plan's curriculum (the tray, the tiles'
 * names and colours), the degree audit (the terms already taken, passed and in-progress courses, their grades) and
 * the saved transcript's course codes. Each is the API's or the rule engine's answer; nothing here judges one.
 */
export function usePlanContext(plan: Ref<Plan | null>, now: () => Term) {
  const auth = useAuth();
  const locale = useLocale();

  const curriculum = useAsyncLoad(
    'the curriculum of the plan',
    async () => {
      const c = plan.value?.curriculum;
      return c ? auth.authed((token) => fetchCurriculum(token, c.programCode, c.cohortYear)) : null;
    },
    () => plan.value?.curriculum.id ?? null,
  );
  const requirementGroups = computed<readonly RequirementGroup[]>(() => curriculum.data.value?.requirementGroups ?? []);
  /** Each course of the curriculum once, in the group order of the explorer. */
  const catalog = computed(() => {
    const courses = new Map<string, CourseInfo>();
    for (const group of orderGroups(requirementGroups.value)) {
      const colour = groupColour(group);
      for (const course of group.courses) if (!courses.has(course.code)) courses.set(course.code, { course, colour });
    }
    return courses;
  });
  const groupNames = computed(() => new Map(requirementGroups.value.map((g) => [g.id, g])));

  // A neutral mark on the courses of the student's saved transcript, as in the explorer: whether one counts as passed
  // is the engine's call (it flags a placed one as already_passed). No transcript, or none loaded, shows no marks.
  const transcriptCodes = useTranscriptCodes('the planner');

  // The degree audit (the rule engine's reading of the transcript, F3). Without one (no transcript, no onboarding, a
  // failure) none of it shows.
  const { audit } = useAudit();
  const auditCourses = computed(() => audit.value?.groups.flatMap((g) => g.courses) ?? []);
  const passed = computed(() => auditCourses.value.filter((c) => c.status === 'passed'));
  const passedCodes = computed(() => new Set(passed.value.map((c) => c.code)));
  const gradeOf = computed(() => new Map(auditCourses.value.filter((c) => c.grade !== null).map((c) => [c.code, c.grade!])));
  /** The audit's terms before the current one. */
  const pastTerms = computed(() => audit.value?.terms.filter((t) => compareTerms(t.term, now()) < 0) ?? []);
  /** The courses the transcript has in progress in the current term: shown in its row, locked. */
  const inProgressNow = computed(() => {
    const term = audit.value?.terms.find((t) => compareTerms(t.term, now()) === 0);
    return (term?.inProgressCourseCodes ?? []).map((code) => {
      const info = catalog.value.get(code);
      return { code, name: info ? localName(info.course, locale.lang) : null, credits: info?.course.credits ?? null, colour: info?.colour ?? 'core' };
    });
  });

  return { curriculum, requirementGroups, catalog, groupNames, transcriptCodes, audit, passed, passedCodes, gradeOf, pastTerms, inProgressNow };
}
