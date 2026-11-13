import { isCourseCode, normalizePrintedCode } from '../../common/course-code.js';
import type { EquivalenceCourse, PrintedRow } from './seed-types.js';

type Periods = number | null;
type Extra = Partial<Pick<PrintedRow, 'counts_toward_total' | 'counts_toward_gpa' | 'needs_check' | 'code_printed'>>;

// One call per printed table row, arguments in the order of the PDF's columns:
//   bb(code, name_vi, credits, LT, TH, BT, ĐT, page)
// LT = theory_periods, TH = lab_periods, BT = exercise_periods,
// ĐT ("Thực hiện đề tài") = project_periods. null = blank cell.

function row(type: PrintedRow['type'], code: string, name_vi: string, credits: number, lt: Periods, th: Periods, bt: Periods, dt: Periods, page: number, extra: Extra = {}): PrintedRow {
  return {
    code,
    name_vi,
    credits,
    theory_periods: lt,
    lab_periods: th,
    exercise_periods: bt,
    project_periods: dt,
    type,
    counts_toward_total: true,
    counts_toward_gpa: true,
    page,
    ...extra,
  };
}

/** A "BB" (bắt buộc, compulsory) row. */
export const bb = (code: string, name_vi: string, credits: number, lt: Periods, th: Periods, bt: Periods, dt: Periods, page: number, extra?: Extra) =>
  row('BB', code, name_vi, credits, lt, th, bt, dt, page, extra);

/** A "TC" (tự chọn, elective) row. */
export const tc = (code: string, name_vi: string, credits: number, lt: Periods, th: Periods, bt: Periods, dt: Periods, page: number, extra?: Extra) =>
  row('TC', code, name_vi, credits, lt, th, bt, dt, page, extra);

/** One course of an equivalence list. Its code is normalised, or null when the printed code cannot meet the CHECK. */
export function equivalenceCourse(code_printed: string, name: string, credits: number | null): EquivalenceCourse {
  const code = normalizePrintedCode(code_printed);
  return { code: isCourseCode(code) ? code : null, code_printed, name, credits };
}
