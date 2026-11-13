// Grade rules of the HCMUS training regulation, QĐ 1175/QĐ-KHTN (2021). Pure functions.
// Grades are handled in integer tenths: the regulation rounds a course grade to one decimal
// (Điều 11.1), so tenths are exact and no comparison depends on floating point.

/** A 10-point grade (one decimal) as an integer number of tenths: 8.5 → 85. */
export function toTenths(grade: number): number {
  return Math.round(grade * 10);
}

/** Điều 11.4: a course graded 5.0 or more is passed, and its credits are accumulated. */
export const PASSING_GRADE_TENTHS = 50;

export function isPassingGrade(grade: number): boolean {
  return toTenths(grade) >= PASSING_GRADE_TENTHS;
}

/**
 * Điều 11.1: the 10-point grade converted to the 4-point scale (A+ to F). Điều 11.2: for reference
 * only, never for recording or ranking. D+ (4.0–4.9) and D (3.0–3.9) have a 4-point value but are
 * not passing grades (Điều 11.4).
 */
const CONVERSION: { fromTenths: number; fourPointTenths: number }[] = [
  { fromTenths: 90, fourPointTenths: 40 },
  { fromTenths: 80, fourPointTenths: 35 },
  { fromTenths: 70, fourPointTenths: 30 },
  { fromTenths: 60, fourPointTenths: 25 },
  { fromTenths: 50, fourPointTenths: 20 },
  { fromTenths: 40, fourPointTenths: 15 },
  { fromTenths: 30, fourPointTenths: 10 },
  { fromTenths: 0, fourPointTenths: 0 },
];

/** The 4-point value in tenths (Điều 11.1): 8.5 → 35, i.e. 3.5. */
export function fourPointTenths(grade: number): number {
  const tenths = toTenths(grade);
  return (CONVERSION.find((c) => tenths >= c.fromTenths) ?? CONVERSION[CONVERSION.length - 1]).fourPointTenths;
}

export const CLASSIFICATIONS = ['excellent', 'very_good', 'good', 'fairly_good', 'average', 'weak', 'poor'] as const;
/** Điều 15.2.b: Xuất sắc, Giỏi, Khá, Trung bình khá (cohorts up to 2020 only), Trung bình, Yếu, Kém. */
export type Classification = (typeof CLASSIFICATIONS)[number];

/**
 * Điều 15.2.b: the classification of an average, given exactly as numerator / denominator on the
 * 10-point scale. Cohorts from 2021 have no "Trung bình khá" band; earlier cohorts do.
 */
export function classify(numerator: number, denominator: number, cohortYear: number): Classification {
  const atLeast = (points: number) => numerator >= points * denominator;
  if (atLeast(9)) return 'excellent';
  if (atLeast(8)) return 'very_good';
  if (atLeast(7)) return 'good';
  if (cohortYear <= 2020 && atLeast(6)) return 'fairly_good';
  if (atLeast(5)) return 'average';
  if (atLeast(4)) return 'weak';
  return 'poor';
}

/**
 * Điều 15.3: the year of study from the credits accumulated since the start of the course,
 * with 38 credits per year in the standard plan.
 */
export const YEAR_LEVELS = [1, 2, 3, 4] as const;
export type YearLevel = (typeof YEAR_LEVELS)[number];

export function yearLevel(accumulatedCredits: number): YearLevel {
  if (accumulatedCredits < 38) return 1;
  if (accumulatedCredits < 76) return 2;
  if (accumulatedCredits < 114) return 3;
  return 4;
}
