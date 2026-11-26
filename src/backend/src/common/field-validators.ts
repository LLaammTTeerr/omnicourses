import { TransformFnParams } from 'class-transformer';
import { buildMessage, registerDecorator, ValidateBy, ValidateIf, ValidationOptions } from 'class-validator';

// PostgreSQL refuses U+0000 in any text value and counts a varchar's length in code points. A
// text field of a request checks both, so a value the route accepts never makes the query fail
// with a 500 (issue #163).

/**
 * A text column's length as PostgreSQL counts it: in code points. Use it instead of MaxLength:
 * class-validator's MaxLength does not count a variation selector (U+FE0E, U+FE0F) after a
 * character, so a value it accepts could still be too long for varchar(n), and the insert would
 * fail with a 500. Same words as MaxLength's refusal.
 */
export const MaxCodePoints = (max: number) =>
  ValidateBy({
    name: 'maxCodePoints',
    constraints: [max],
    validator: {
      validate: (value: unknown) => typeof value === 'string' && [...value].length <= max,
      defaultMessage: buildMessage((each) => `${each}$property must be shorter than or equal to $constraint1 characters`),
    },
  });

/** PostgreSQL refuses U+0000 in any text value, with a 500 if it got that far. */
export const NoNullCharacter = ValidateBy({
  name: 'noNullCharacter',
  validator: {
    validate: (value: unknown) => typeof value === 'string' && !value.includes('\u0000'),
    defaultMessage: buildMessage((each) => `${each}$property must not contain a null character (U+0000)`),
  },
});

/** `@Transform(trimString)`: trims a string and leaves anything else for the validators. */
export const trimString = ({ value }: TransformFnParams): unknown => (typeof value === 'string' ? value.trim() : value);

export const trimmedOrNull = (value: string | null | undefined): string | null => (value?.trim() ? value.trim() : null);

export const nullIfBlank = (value: string | null | undefined): string | null => (value === undefined || value === null || value.trim() === '' ? null : value);

/** Present: validated. Absent: left as it is. */
export const ifPresent = ValidateIf((_: object, value: unknown) => value !== undefined);
/** Present and not null: validated. null clears the column. */
export const ifSet = ValidateIf((_: object, value: unknown) => value !== undefined && value !== null);
/** Present, not null and not blank: validated. null or '' clears the column (an empty form field). */
export const ifFilled = ValidateIf((_: object, value: unknown) => value !== undefined && value !== null && value !== '');

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
