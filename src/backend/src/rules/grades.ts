// Grade rules of the HCMUS training regulation, QĐ 1175/QĐ-KHTN (2021). Pure functions.
// Grades are handled in integer tenths: the regulation rounds a course grade to one decimal
// (Điều 11.1), so tenths are exact and no comparison depends on floating point.

export const TENTHS_PER_POINT = 10;

/** A 10-point grade (one decimal) as an integer number of tenths: 8.5 → 85. */
export function toTenths(grade: number): number {
  return Math.round(grade * TENTHS_PER_POINT);
}

/** Điều 11.4: a course graded 5.0 or more is passed, and its credits are accumulated. */
const PASSING_GRADE_TENTHS = 50;

export function isPassingGrade(grade: number): boolean {
  return toTenths(grade) >= PASSING_GRADE_TENTHS;
}

/**
 * Điều 11.1: the 10-point grade converted to the 4-point scale and to a letter. Điều 11.2: both are
 * for reference only, never for recording or ranking. D+ and D have a 4-point value but are not
 * passing grades (Điều 11.4).
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

const LAST_COHORT_WITH_FAIRLY_GOOD = 2020;

const CLASSIFICATION_BANDS: { minPoints: number; classification: Classification; lastCohort: number | null }[] = [
  { minPoints: 9, classification: 'excellent', lastCohort: null },
  { minPoints: 8, classification: 'very_good', lastCohort: null },
  { minPoints: 7, classification: 'good', lastCohort: null },
  { minPoints: 6, classification: 'fairly_good', lastCohort: LAST_COHORT_WITH_FAIRLY_GOOD },
  { minPoints: 5, classification: 'average', lastCohort: null },
  { minPoints: 4, classification: 'weak', lastCohort: null },
];

/**
 * Điều 15.2.b: the classification of an average, given exactly as numerator / denominator on the
 * 10-point scale. Cohorts from 2021 have no "Trung bình khá" band; earlier cohorts do.
 */
export function classify(numerator: number, denominator: number, cohortYear: number): Classification {
  const band = CLASSIFICATION_BANDS.find(
    (b) => (b.lastCohort === null || cohortYear <= b.lastCohort) && numerator >= b.minPoints * denominator,
  );
  return band?.classification ?? 'poor';
}

const CREDITS_PER_YEAR = 38;
const YEAR_LEVELS = [1, 2, 3, 4] as const;

/**
 * Điều 15.3: the year of study from the credits accumulated since the start of the course,
 * with 38 credits per year in the standard plan.
 */
export function yearLevel(accumulatedCredits: number): (typeof YEAR_LEVELS)[number] {
  return YEAR_LEVELS.find((level) => accumulatedCredits < level * CREDITS_PER_YEAR) ?? YEAR_LEVELS[YEAR_LEVELS.length - 1];
}
