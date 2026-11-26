export const TENTHS_PER_POINT = 10;

export function toTenths(grade: number): number {
  return Math.round(grade * TENTHS_PER_POINT);
}

const PASSING_GRADE_TENTHS = 50;

export function isPassingGrade(grade: number): boolean {
  return toTenths(grade) >= PASSING_GRADE_TENTHS;
}

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

export function fourPointTenths(grade: number): number {
  const tenths = toTenths(grade);
  return (CONVERSION.find((c) => tenths >= c.fromTenths) ?? CONVERSION[CONVERSION.length - 1]).fourPointTenths;
}

export const CLASSIFICATIONS = ['excellent', 'very_good', 'good', 'fairly_good', 'average', 'weak', 'poor'] as const;
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

export function classify(numerator: number, denominator: number, cohortYear: number): Classification {
  const band = CLASSIFICATION_BANDS.find(
    (b) => (b.lastCohort === null || cohortYear <= b.lastCohort) && numerator >= b.minPoints * denominator,
  );
  return band?.classification ?? 'poor';
}

const CREDITS_PER_YEAR = 38;
export const YEAR_LEVELS = [1, 2, 3, 4] as const;

export function yearLevel(accumulatedCredits: number): (typeof YEAR_LEVELS)[number] {
  return YEAR_LEVELS.find((level) => accumulatedCredits < level * CREDITS_PER_YEAR) ?? YEAR_LEVELS[YEAR_LEVELS.length - 1];
}
