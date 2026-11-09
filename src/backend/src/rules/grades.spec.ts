import { describe, expect, it } from 'vitest';
import { classify, fourPointTenths, isPassingGrade, letterGrade, toTenths, yearLevel } from './grades.js';

describe('grades (QĐ 1175/QĐ-KHTN)', () => {
  it('handles grades in exact tenths', () => {
    expect(toTenths(8.5)).toBe(85);
    expect(toTenths(0.1 + 0.2)).toBe(3);
  });

  it('passes a course from 5.0 (Điều 11.4)', () => {
    expect(isPassingGrade(5)).toBe(true);
    expect(isPassingGrade(4.9)).toBe(false);
    expect(isPassingGrade(10)).toBe(true);
    expect(isPassingGrade(0)).toBe(false);
  });

  it.each([
    [10, 40, 'A+'],
    [9, 40, 'A+'],
    [8.9, 35, 'A'],
    [8, 35, 'A'],
    [7.9, 30, 'B+'],
    [7, 30, 'B+'],
    [6, 25, 'B'],
    [5, 20, 'C'],
    [4.9, 15, 'D+'],
    [4, 15, 'D+'],
    [3, 10, 'D'],
    [2.9, 0, 'F'],
    [0, 0, 'F'],
  ] as const)('converts %s to %s tenths on the 4-point scale and %s (Điều 11.1)', (grade, four, letter) => {
    expect(fourPointTenths(grade)).toBe(four);
    expect(letterGrade(grade)).toBe(letter);
  });

  it('does not pass D+ or D even though they have a 4-point value', () => {
    expect(fourPointTenths(4.5)).toBeGreaterThan(0);
    expect(isPassingGrade(4.5)).toBe(false);
  });

  it('classifies an average for cohorts from 2021 (Điều 15.2.b)', () => {
    const at = (avg: number) => classify(avg * 100, 100, 2024);
    expect(at(9)).toBe('excellent');
    expect(at(8.99)).toBe('very_good');
    expect(at(8)).toBe('very_good');
    expect(at(7)).toBe('good');
    expect(at(6.5)).toBe('average');
    expect(at(5)).toBe('average');
    expect(at(4)).toBe('weak');
    expect(at(3.99)).toBe('poor');
  });

  it('keeps the "Trung bình khá" band for cohorts up to 2020', () => {
    expect(classify(65, 10, 2020)).toBe('fairly_good');
    expect(classify(59, 10, 2020)).toBe('average');
  });

  it('places the year of study by accumulated credits (Điều 15.3)', () => {
    expect([0, 37, 38, 75, 76, 113, 114, 163].map(yearLevel)).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
  });
});
