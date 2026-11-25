// The one course-code format of the catalog and the transcript, as the API checks it (ADR 0007):
// src/backend/src/common/course-code.ts. A bound on input, not an academic rule (AGENTS.md hard rule 1).
export const COURSE_CODE_PATTERN = /^[A-Z0-9]{2,20}$/;

/** The code, as the catalog stores it, has the format the API accepts. */
export const isCourseCode = (code: string): boolean => COURSE_CODE_PATTERN.test(code);
