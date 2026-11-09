import { createParamDecorator, ExecutionContext, ValidationError, ValidationPipe } from '@nestjs/common';
import { validationFailed } from './admin-errors.js';

/** "parent.child: message" for every failed constraint, nested ones included. */
export function flattenErrors(errors: ValidationError[], parent = ''): string[] {
  return errors.flatMap((e) => {
    const path = parent ? `${parent}.${e.property}` : e.property;
    const own = Object.values(e.constraints ?? {}).map((m) => (m.startsWith(e.property) ? (parent ? `${parent}.${m}` : m) : `${path}: ${m}`));
    return [...own, ...flattenErrors(e.children ?? [], path)];
  });
}

const strictPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  validateCustomDecorators: true,
  exceptionFactory: (errors) => validationFailed(flattenErrors(errors)),
});

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
