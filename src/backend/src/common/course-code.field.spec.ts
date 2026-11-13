import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CourseCodeField } from './course-code.field.js';

class Typed {
  @CourseCodeField({ canonicalize: true, message: 'code must be a course code' })
  code!: string;
}

class Exact {
  @CourseCodeField({ message: 'code must be exact' })
  code!: string;
}

const messages = async (cls: new () => object, code: unknown) => (await validate(plainToInstance(cls, { code }))).flatMap((e) => Object.values(e.constraints ?? {}));

describe('CourseCodeField', () => {
  it('trims and upper-cases a typed code before checking it, when asked to', async () => {
    expect(plainToInstance(Typed, { code: ' cs101 ' }).code).toBe('CS101');
    expect(await messages(Typed, ' cs101 ')).toEqual([]);
  });

  it('checks a code as it is otherwise', async () => {
    expect(plainToInstance(Exact, { code: ' cs101 ' }).code).toBe(' cs101 ');
    expect(await messages(Exact, 'cs101')).toEqual(['code must be exact']);
    expect(await messages(Exact, 'CS101')).toEqual([]);
  });

  it("answers with the caller's message, then the string rule, for a value that is not a string", async () => {
    expect(await messages(Typed, 123)).toEqual(['code must be a course code', 'code must be a string']);
    expect(await messages(Exact, undefined)).toEqual(['code must be exact', 'code must be a string']);
  });

  it('refuses what canonicalising cannot fix', async () => {
    expect(await messages(Typed, 'CS-101')).toEqual(['code must be a course code']);
    expect(await messages(Typed, 'A'.repeat(21))).toEqual(['code must be a course code']);
  });
});
