// The averages of QĐ 1175/QĐ-KHTN Điều 15. Pure functions, in integer arithmetic: grades in tenths
// times credits, divided once at the end, so every machine gives the same result.
import { fourPointTenths, toTenths } from './grades.js';

/** A grade with the credits that weight it (Điều 15.2.a: aᵢ the course grade, nᵢ its credits). */
export interface WeightedGrade {
  grade: number;
  credits: number;
}

/** An exact average: numerator / denominator on the 10-point (or 4-point) scale. */
export interface ExactAverage {
  /** Rounded half up to two decimals, for display. */
  value: number;
  numerator: number;
  denominator: number;
}

/** numerator / denominator, rounded half up to two decimals, without floating-point division. */
function toHundredths(numerator: number, denominator: number): number {
  return Math.floor((numerator * 200 + denominator) / (2 * denominator)) / 100;
}

function weighted(items: readonly WeightedGrade[], tenthsOf: (grade: number) => number): ExactAverage | null {
  const credits = items.reduce((sum, i) => sum + i.credits, 0);
  if (credits === 0) return null;
  const numerator = items.reduce((sum, i) => sum + tenthsOf(i.grade) * i.credits, 0);
  const denominator = credits * 10;
  return { value: toHundredths(numerator, denominator), numerator, denominator };
}

/** Điều 15.2.a: A = Σ aᵢ·nᵢ / Σ nᵢ on the 10-point scale. Null when there is nothing to average. */
export function weightedAverage(items: readonly WeightedGrade[]): ExactAverage | null {
  return weighted(items, toTenths);
}

/**
 * The same average over each grade's 4-point value (Điều 11.1). For reference only: Điều 11.2 says
 * the 4-point scale is never used to record or rank. Each course grade is converted, then averaged.
 */
export function fourPointAverage(items: readonly WeightedGrade[]): ExactAverage | null {
  return weighted(items, fourPointTenths);
}
