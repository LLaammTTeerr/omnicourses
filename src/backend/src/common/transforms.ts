import { TransformFnParams } from 'class-transformer';

/** `@Transform(trimString)`: trims a string and leaves anything else for the validators. */
export const trimString = ({ value }: TransformFnParams): unknown => (typeof value === 'string' ? value.trim() : value);

/** A text that may be blank, trimmed, or null when nothing is left: an optional note or English name. */
export const blankToNull = (value: string | null | undefined): string | null => (value?.trim() ? value.trim() : null);
