import { TransformFnParams } from 'class-transformer';

/** `@Transform(trimString)`: trims a string and leaves anything else for the validators. */
export const trimString = ({ value }: TransformFnParams): unknown => (typeof value === 'string' ? value.trim() : value);
