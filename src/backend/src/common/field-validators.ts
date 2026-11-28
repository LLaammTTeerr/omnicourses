import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import { buildMessage, IsNotEmpty, IsString, registerDecorator, ValidateBy, ValidateIf, ValidationOptions } from 'class-validator';

export const MaxCodePoints = (max: number) =>
  ValidateBy({
    name: 'maxCodePoints',
    constraints: [max],
    validator: {
      validate: (value: unknown) => typeof value === 'string' && [...value].length <= max,
      defaultMessage: buildMessage((each) => `${each}$property must be shorter than or equal to $constraint1 characters`),
    },
  });

export const NoNullCharacter = ValidateBy({
  name: 'noNullCharacter',
  validator: {
    validate: (value: unknown) => typeof value === 'string' && !value.includes('\u0000'),
    defaultMessage: buildMessage((each) => `${each}$property must not contain a null character (U+0000)`),
  },
});

export const NoControlCharacter = ValidateBy({
  name: 'noControlCharacter',
  validator: {
    validate: (value: unknown) => typeof value === 'string' && !/\p{Cc}/u.test(value),
    defaultMessage: buildMessage((each) => `${each}$property must not contain a control character`),
  },
});

export const trimString = ({ value }: TransformFnParams): unknown => (typeof value === 'string' ? value.trim() : value);

export const trimmedOrNull = (value: string | null | undefined): string | null => (value?.trim() ? value.trim() : null);

export const nullIfBlank = (value: string | null | undefined): string | null => (value === undefined || value === null || value.trim() === '' ? null : value);

type Normalisers = Readonly<Record<string, (value: never) => unknown>>;

export function sentFields<F extends string>(fields: readonly F[], body: Partial<Record<F, unknown>>, normalise: Normalisers = {}): Partial<Record<F, unknown>> {
  const patch: Partial<Record<F, unknown>> = {};
  for (const field of fields) {
    const value = body[field];
    if (value === undefined) continue;
    const normaliser = normalise[field] as ((value: unknown) => unknown) | undefined;
    patch[field] = normaliser ? normaliser(value) : value;
  }
  return patch;
}

export function changedFields<F extends string>(fields: readonly F[], stored: Record<F, unknown>, body: Partial<Record<F, unknown>>, normalise: Normalisers = {}): Partial<Record<F, unknown>> {
  const sent = sentFields(fields, body, normalise);
  return Object.fromEntries(fields.filter((field) => field in sent && sent[field] !== stored[field]).map((field) => [field, sent[field]])) as Partial<Record<F, unknown>>;
}

export const ifPresent = ValidateIf((_: object, value: unknown) => value !== undefined);
export const ifSet = ValidateIf((_: object, value: unknown) => value !== undefined && value !== null);
export const ifFilled = ValidateIf((_: object, value: unknown) => value !== undefined && value !== null && value !== '');

interface TextFieldOptions {
  maxLength: number;
  required?: boolean;
  example?: string;
  description?: string;
}

export const RequiredTextField = (api: TextFieldOptions) =>
  applyDecorators(MaxCodePoints(api.maxLength), IsNotEmpty(), NoNullCharacter, IsString(), Transform(trimString), ApiProperty(api));

export const NullableTextField = (api: TextFieldOptions) =>
  applyDecorators(MaxCodePoints(api.maxLength), NoNullCharacter, IsString(), ifSet, Transform(trimString), ApiProperty({ type: String, nullable: true, required: false, ...api }));

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = DATE_ONLY.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

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

export const yearOf = (date: string): number => Number(date.slice(0, 4));
