import { createParamDecorator, ExecutionContext, type Type, ValidationError, ValidationPipe } from '@nestjs/common';
import { validationFailed } from './admin-errors.js';

/** "parent.child: message" for every failed constraint, nested ones included. */
export function flattenErrors(errors: ValidationError[], parent = ''): string[] {
  return errors.flatMap((e) => {
    const path = parent ? `${parent}.${e.property}` : e.property;
    const own = Object.values(e.constraints ?? {}).map((m) => (m.startsWith(e.property) ? (parent ? `${parent}.${m}` : m) : `${path}: ${m}`));
    return [...own, ...flattenErrors(e.children ?? [], path)];
  });
}

const STRICT = { whitelist: true, forbidNonWhitelisted: true, transform: true, validateCustomDecorators: true } as const;

const strictPipe = new ValidationPipe({ ...STRICT, exceptionFactory: (errors) => validationFailed(flattenErrors(errors)) });

class StrictValidationErrors extends Error {
  constructor(readonly errors: ValidationError[]) {
    super('strict validation failed');
  }
}

const collectingPipe = new ValidationPipe({ ...STRICT, exceptionFactory: (errors) => new StrictValidationErrors(errors) });

/**
 * The validation of `@StrictBody()` for a value that is not a request body: one row of a CSV
 * import (ADR 0011: manual entry and CSV use the same validation). Same DTO, same options;
 * the errors come back as a list, because an import reports every bad row, not the first.
 */
export async function validateStrict<T extends object>(dto: Type<T>, plain: unknown): Promise<{ value: T; errors: null } | { value: null; errors: ValidationError[] }> {
  try {
    return { value: (await collectingPipe.transform(plain, { type: 'custom', metatype: dto })) as T, errors: null };
  } catch (error) {
    if (error instanceof StrictValidationErrors) return { value: null, errors: error.errors };
    throw error;
  }
}

const RawBody = createParamDecorator((_: unknown, ctx: ExecutionContext): unknown => ctx.switchToHttp().getRequest<{ body: unknown }>().body);

/**
 * The request body, validated against the parameter's DTO with unknown fields refused:
 * `400 validation_failed` names them, instead of the global pipe dropping them silently.
 * ADR 0011 open item 2: an admin PATCH that tries to change an identifier or a gated field
 * (a credit total) must fail, not succeed while ignoring it. It is a custom parameter
 * decorator because the global ValidationPipe skips those; on `@Body()` the global pipe
 * would strip the unknown fields before a route pipe could see them. Pair it with
 * `@ApiBody({ type: Dto })`: Swagger cannot see a custom decorator's type.
 */
export const StrictBody = () => RawBody(strictPipe);
