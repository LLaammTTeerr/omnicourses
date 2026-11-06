import type { Logger } from '@nestjs/common';

/**
 * Logs an error by its name only. Its message or properties may carry the
 * prompt, a reply or tool arguments, which never reach a log (AGENTS.md hard
 * rule 3).
 */
export function logErrorName(logger: Logger, context: string, error: unknown): void {
  logger.warn(`${context}: ${error instanceof Error ? error.name : typeof error}`);
}
