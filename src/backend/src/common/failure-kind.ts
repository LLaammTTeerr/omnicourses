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

export function failureKind(error: unknown): string {
  const name = error instanceof Error ? error.constructor.name : typeof error;
  const sqlState = sqlStateOf(error);
  return sqlState ? `${name}, SQLSTATE ${sqlState}` : name;
}

export function failureStack(error: unknown): string | undefined {
  if (!(error instanceof Error) || error instanceof QueryFailedError) return undefined;
  const frames = (error.stack ?? '').split('\n').filter((line) => /^\s+at /.test(line));
  return frames.length ? frames.join('\n') : undefined;
}

export function logWithStack(logger: Logger, line: string, stack: string | undefined): void {
  if (stack) logger.error(line, stack);
  else logger.error(line);
}

export function logFailure(logger: Logger, line: string, error: unknown): void {
  logWithStack(logger, `${line}: ${failureKind(error)}`, failureStack(error));
}
