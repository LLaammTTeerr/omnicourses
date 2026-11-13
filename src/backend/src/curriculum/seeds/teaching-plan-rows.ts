import type { TeachingPlanRow } from './seed-types.js';

/** One plan row, in the PDF's column order: semester, code, "Loại HP", credits, page. */
export const p = (semester: number, code: string, type: 'BB' | 'TC', credits: number, page: number): TeachingPlanRow => ({
  semester,
  code,
  type,
  credits,
  page,
});

export const TEACHING_PLAN_NOTE =
  'Section 8 "Kế hoạch giảng dạy (dự kiến)" is a tentative order of study by semester index 1-12 over four ' +
  'years, not a list of offering terms. Mapping an index to an ADR 0009 term number (1, 2 or 3) assumes three ' +
  'terms a year and is left to a human decision. The seed script does not load this file.';
