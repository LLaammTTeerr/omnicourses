import { type ArgumentMetadata, createParamDecorator, ExecutionContext, ParseUUIDPipe, type PipeTransform, type Type, ValidationError, ValidationPipe } from '@nestjs/common';
import { validationFailed } from './api-errors.js';

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class LowerCaseUuidPipe extends ParseUUIDPipe {
  override async transform(value: string, metadata: ArgumentMetadata) {
    const id = await super.transform(value, metadata);
    return typeof id === 'string' ? id.toLowerCase() : id;
  }
}

export const uuidParam = (name: string) => new LowerCaseUuidPipe({ exceptionFactory: () => validationFailed(`${name}: must be a UUID`) });

export class UuidOr404Pipe implements PipeTransform<string, string> {
  constructor(private readonly notFound: () => Error) {}

  transform(value: string): string {
    if (!UUID_PATTERN.test(value)) throw this.notFound();
    return value.toLowerCase();
  }
}

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

export async function validateStrict<T extends object>(dto: Type<T>, plain: unknown): Promise<{ value: T; errors: null } | { value: null; errors: ValidationError[] }> {
  try {
    return { value: (await collectingPipe.transform(plain, { type: 'custom', metatype: dto })) as T, errors: null };
  } catch (error) {
    if (error instanceof StrictValidationErrors) return { value: null, errors: error.errors };
    throw error;
  }
}

const RawBody = createParamDecorator((_: unknown, ctx: ExecutionContext): unknown => ctx.switchToHttp().getRequest<{ body: unknown }>().body);

export const StrictBody = () => RawBody(strictPipe);
