import { fourPointTenths, TENTHS_PER_POINT, toTenths } from './grades.js';

export interface WeightedGrade {
  grade: number;
  credits: number;
}

interface ExactAverage {
  value: number;
  numerator: number;
  denominator: number;
}

const HUNDREDTHS = 100;

function toHundredths(numerator: number, denominator: number): number {
  return Math.floor((numerator * 2 * HUNDREDTHS + denominator) / (2 * denominator)) / HUNDREDTHS;
}

function weighted(items: readonly WeightedGrade[], tenthsOf: (grade: number) => number): ExactAverage | null {
  const credits = items.reduce((sum, i) => sum + i.credits, 0);
  if (credits === 0) return null;
  const numerator = items.reduce((sum, i) => sum + tenthsOf(i.grade) * i.credits, 0);
  const denominator = credits * TENTHS_PER_POINT;
  return { value: toHundredths(numerator, denominator), numerator, denominator };
}

export function weightedAverage(items: readonly WeightedGrade[]): ExactAverage | null {
  return weighted(items, toTenths);
}

export function fourPointAverage(items: readonly WeightedGrade[]): ExactAverage | null {
  return weighted(items, fourPointTenths);
}
