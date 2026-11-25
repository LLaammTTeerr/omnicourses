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
