import type { Logger } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

export const SQLSTATE = {
  restrictViolation: '23001',
  foreignKeyViolation: '23503',
  uniqueViolation: '23505',
} as const;

const SQLSTATE_SHAPE = /^[0-9A-Z]{5}$/;

interface DriverError {
  code?: unknown;
  constraint?: unknown;
}

const driverErrorOf = (error: unknown): DriverError | undefined => (error as { driverError?: DriverError } | null)?.driverError;

function sqlStateOf(error: unknown): string | undefined {
  const code = driverErrorOf(error)?.code;
  return typeof code === 'string' && SQLSTATE_SHAPE.test(code) ? code : undefined;
}

export function isRefusal(error: unknown, sqlStates: readonly string[], constraint?: string): boolean {
  if (!(error instanceof QueryFailedError)) return false;
  const sqlState = sqlStateOf(error);
  if (sqlState === undefined || !sqlStates.includes(sqlState)) return false;
  return constraint === undefined || driverErrorOf(error)?.constraint === constraint;
}

/**
 * What a log line may say about a failure: the error's class, and the SQLSTATE code when the
 * database refused a statement. Never the message, the statement or its parameters: a database
 * message quotes row values (AGENTS.md hard rule 3).
 */
export function failureKind(error: unknown): string {
  const name = error instanceof Error ? error.constructor.name : typeof error;
  const sqlState = sqlStateOf(error);
  return sqlState ? `${name}, SQLSTATE ${sqlState}` : name;
}

/**
 * Where a failure that is not a database error was thrown: the frames of its stack, for the
 * second argument of Logger.error. The first line of a stack repeats the message, so only the
 * "at …" lines are kept; a frame names code, never a row value. Undefined for a QueryFailedError
 * (its class and SQLSTATE say enough, and nothing of it may be logged beyond them) and for a
 * thrown value that is not an Error.
 */
export function failureStack(error: unknown): string | undefined {
  if (!(error instanceof Error) || error instanceof QueryFailedError) return undefined;
  const frames = (error.stack ?? '').split('\n').filter((line) => /^\s+at /.test(line));
  return frames.length ? frames.join('\n') : undefined;
}

export function logFailure(logger: Logger, line: string, error: unknown): void {
  const stack = failureStack(error);
  const text = `${line}: ${failureKind(error)}`;
  if (stack) logger.error(text, stack);
  else logger.error(text);
}
