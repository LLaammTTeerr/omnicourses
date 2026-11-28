import type { PrintedRow } from './seed-types.js';

type Periods = number | null;
type Extra = Partial<Pick<PrintedRow, 'counts_toward_total' | 'counts_toward_gpa' | 'needs_check' | 'code_printed'>>;

export function row(type: PrintedRow['type'], code: string, name_vi: string, credits: number, lt: Periods, th: Periods, bt: Periods, dt: Periods, page: number, extra: Extra = {}): PrintedRow {
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

export const bb = (code: string, name_vi: string, credits: number, lt: Periods, th: Periods, bt: Periods, dt: Periods, page: number, extra?: Extra) =>
  row('BB', code, name_vi, credits, lt, th, bt, dt, page, extra);

export const tc = (code: string, name_vi: string, credits: number, lt: Periods, th: Periods, bt: Periods, dt: Periods, page: number, extra?: Extra) =>
  row('TC', code, name_vi, credits, lt, th, bt, dt, page, extra);
