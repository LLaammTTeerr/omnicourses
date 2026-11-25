import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { NotificationsQueryDto } from './notifications.dto.js';

// As the global ValidationPipe reads a query string: every value arrives as text.
const parse = (query: Record<string, unknown>) => {
  const dto = plainToInstance(NotificationsQueryDto, query);
  return { dto, errors: validateSync(dto, { whitelist: true }).map((e) => e.property) };
};

describe('NotificationsQueryDto', () => {
  it('accepts no filter at all', () => {
    expect(parse({})).toEqual({ dto: {}, errors: [] });
  });

  it('reads unread as the words true and false only', () => {
    expect(parse({ unread: 'true' }).dto.unread).toBe(true);
    // Boolean('false') would be true.
    expect(parse({ unread: 'false' }).dto.unread).toBe(false);
    for (const unread of ['', '1', '0', 'yes', 'TRUE', ['true', 'false']]) expect(parse({ unread }).errors, String(unread)).toEqual(['unread']);
  });

  it('reads one kind or several, and refuses an unknown or repeated kind', () => {
    expect(parse({ kind: 'term_start' })).toEqual({ dto: { kind: ['term_start'] }, errors: [] });
    expect(parse({ kind: ['registration_soon', 'registration_open'] }).errors).toEqual([]);
    expect(parse({ kind: 'add_drop' }).errors).toEqual(['kind']);
    expect(parse({ kind: ['term_start', 'party'] }).errors).toEqual(['kind']);
    expect(parse({ kind: ['term_start', 'term_start'] }).errors).toEqual(['kind']);
    expect(parse({ kind: '' }).errors).toEqual(['kind']);
  });

  it('keeps limit a whole number from 1 to 100', () => {
    expect(parse({ limit: '1' }).dto.limit).toBe(1);
    expect(parse({ limit: '100' }).errors).toEqual([]);
    for (const limit of ['0', '101', '-1', '1.5', 'ten', '']) expect(parse({ limit }).errors, limit).toEqual(['limit']);
  });

  it('takes a UUID as the page cursor', () => {
    expect(parse({ before: '00000000-0000-4000-8000-000000000000' }).errors).toEqual([]);
    for (const before of ['42', '', 'not-a-uuid']) expect(parse({ before }).errors, before).toEqual(['before']);
  });
});
