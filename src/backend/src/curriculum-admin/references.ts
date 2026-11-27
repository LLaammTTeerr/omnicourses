export const COUNTED_REFERENCES = {
  prerequisiteLists: 'curricula record its prerequisites',
  requiredBy: 'courses require it',
  offeringTerms: 'offering-term rows name it',
  transcriptRows: 'transcript rows name it',
  plans: 'saved plans place it',
} as const;
export type CountedReference = keyof typeof COUNTED_REFERENCES;

export const REFERENCES = {
  links: (code: string) => `links ${code}`,
  requires: (course: string, code: string) => `${course} requires ${code}`,
  ownPrerequisites: (code: string) => `prerequisites of ${code} are recorded`,
  ownTerms: (code: string) => `offering terms of ${code} are recorded`,
  linkedIn: (curriculumCode: string) => `linked in ${curriculumCode}`,
  groupPlans: (count: number | null) => (count === null ? 'saved plans use it' : `${count} saved plans use it`),
  groupOverflows: (count: number | null) => (count === null ? 'overflow rules name it' : `${count} overflow rules name it`),
  groupCombinedMinimums: (count: number | null) => (count === null ? 'combined-minimum rules name it' : `${count} combined-minimum rules name it`),
  countingRule: (code: string) => `counting_rule:${code}`,
  counted: (count: number, what: CountedReference) => `${count} ${COUNTED_REFERENCES[what]}`,
} as const;
