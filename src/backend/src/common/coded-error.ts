import type { HttpException } from '@nestjs/common';

/**
 * The body of an error a client branches on: a stable `code`, never the message (ADR 0011,
 * "Validation, errors and removal"). The F12 errors, the audit's 409 and the AI gateway's
 * `ai_unavailable` share it; each route's DTO implements it so its documented shape can't drift.
 */
export interface CodedErrorBody {
  statusCode: number;
  code: string;
  /** English text for the developer; the screen words its own message from `code`. */
  message: string | string[];
}

/** Builds `Exception` with a coded body: `{ statusCode, code, message, ...extra }`, statusCode from the exception's own. */
export function codedError<E extends HttpException>(
  Exception: new (body: CodedErrorBody) => E,
  code: string,
  message: string | string[],
  extra: Record<string, unknown> = {},
): E {
  const body = { statusCode: 0, code, message, ...extra };
  const error = new Exception(body);
  body.statusCode = error.getStatus();
  return error;
}
