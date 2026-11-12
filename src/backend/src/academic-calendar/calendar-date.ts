import { registerDecorator, ValidationOptions } from 'class-validator';

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * True for a calendar date written `YYYY-MM-DD` that exists (no 2026-02-30). A timestamp,
 * a time zone or any other shape is refused: school dates are whole days, not instants.
 */
export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const m = DATE_ONLY.exec(value);
  if (!m) return false;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** class-validator: the property is a `YYYY-MM-DD` date that exists. */
export function IsCalendarDate(options?: ValidationOptions): PropertyDecorator {
  return (target: object, propertyName: string | symbol) =>
    registerDecorator({
      name: 'isCalendarDate',
      target: target.constructor,
      propertyName: propertyName as string,
      options: { message: `${String(propertyName)} must be a date written YYYY-MM-DD`, ...options },
      validator: { validate: (value: unknown) => isCalendarDate(value) },
    });
}

/** The calendar year of a `YYYY-MM-DD` date. */
export const yearOf = (date: string): number => Number(date.slice(0, 4));
