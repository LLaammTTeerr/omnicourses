import type { PrintedRow } from './seed-types.js';

type Time = number | null;
type Extra = Partial<Pick<PrintedRow, 'counts_toward_total' | 'needs_check' | 'code_printed'>>;

// One call per printed table row, arguments in the order of the PDF's columns:
//   bb(code, name_vi, credits, LT, TH, BT, ĐT, page)
// LT = theory_time, TH = lab_work_time, BT = exercise_time,
// ĐT ("Thực hiện đề tài") = project_time. null = blank cell.

function row(type: PrintedRow['type'], code: string, name_vi: string, credits: number, lt: Time, th: Time, bt: Time, dt: Time, page: number, extra: Extra = {}): PrintedRow {
  return {
    code,
    name_vi,
    credits,
    theory_time: lt,
    lab_work_time: th,
    exercise_time: bt,
    project_time: dt,
    type,
    counts_toward_total: true,
    page,
    ...extra,
  };
}

/** A "BB" (bắt buộc, compulsory) row. */
export const bb = (code: string, name_vi: string, credits: number, lt: Time, th: Time, bt: Time, dt: Time, page: number, extra?: Extra) =>
  row('BB', code, name_vi, credits, lt, th, bt, dt, page, extra);

/** A "TC" (tự chọn, elective) row. */
export const tc = (code: string, name_vi: string, credits: number, lt: Time, th: Time, bt: Time, dt: Time, page: number, extra?: Extra) =>
  row('TC', code, name_vi, credits, lt, th, bt, dt, page, extra);
