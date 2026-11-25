import { QueryFailedError } from 'typeorm';

/**
 * What a log line may say about a failure: the error's class, and the SQLSTATE code when the
 * database refused a statement. Never the message, the statement or its parameters: a database
 * message quotes row values (AGENTS.md hard rule 3).
 */
export function failureKind(error: unknown): string {
  const name = error instanceof Error ? error.constructor.name : typeof error;
  const sqlState = (error as { driverError?: { code?: unknown } } | null)?.driverError?.code;
  return typeof sqlState === 'string' && /^[0-9A-Z]{5}$/.test(sqlState) ? `${name}, SQLSTATE ${sqlState}` : name;
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
