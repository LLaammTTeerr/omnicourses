import { describe, expect, it } from 'vitest';
import { HttpError } from '../api.js';
import { byField, readFailure, readReference } from './errors.js';
import { ADMIN_MESSAGES } from './messages.js';

const answer = (status: number, body: Record<string, unknown> | null) =>
  new HttpError('/admin/x', status, 'PUT', typeof body?.message === 'string' ? [body.message] : ((body?.message as string[] | undefined) ?? []), typeof body?.code === 'string' ? body.code : null, body);

describe('readFailure (ADR 0011, "Validation, errors and removal")', () => {
  it('has no answer for a network error, a timeout and a server error: the outcome of a write is unknown', () => {
    expect(readFailure(new TypeError('Failed to fetch'))).toEqual({ kind: 'no_answer' });
    expect(readFailure(new DOMException('The operation timed out.', 'TimeoutError'))).toEqual({ kind: 'no_answer' });
    expect(readFailure(answer(500, { statusCode: 500, message: 'Internal server error' }))).toEqual({ kind: 'no_answer' });
    expect(readFailure(answer(502, null))).toEqual({ kind: 'no_answer' });
  });

  it('reads a session that ended', () => {
    expect(readFailure(answer(401, { statusCode: 401, message: 'Unauthorized' }))).toEqual({ kind: 'signed_out' });
  });

  it('reads the field messages of 400 validation_failed', () => {
    const failure = readFailure(answer(400, { statusCode: 400, code: 'validation_failed', message: ['name should not be empty', 'property creditsTotal should not exist'] }));
    expect(failure).toEqual({ kind: 'validation', details: ['name should not be empty', 'property creditsTotal should not exist'] });
  });

  it('reads a prerequisite cycle by its code, though it is a 400 and not a 409', () => {
    const failure = readFailure(answer(400, { statusCode: 400, code: 'prerequisite_cycle', cycle: ['ZZ101', 'ZZ103', 'ZZ102', 'ZZ101'], message: 'Prerequisite cycle: ZZ101 → ZZ103 → ZZ102 → ZZ101' }));
    expect(failure).toEqual({ kind: 'cycle', cycle: ['ZZ101', 'ZZ103', 'ZZ102', 'ZZ101'] });
  });

  it.each(['program_admin', 'catalog_maintainer', 'access_manager'] as const)('names the missing permission %s of a 403', (permission) => {
    expect(readFailure(answer(403, { statusCode: 403, code: 'permission_required', permission, message: 'x' }))).toEqual({ kind: 'permission', permission });
  });

  it('keeps a 403 it cannot name as a missing permission, without a name', () => {
    expect(readFailure(answer(403, { statusCode: 403, code: 'permission_required', permission: 'root', message: 'x' }))).toEqual({ kind: 'permission', permission: null });
    expect(readFailure(answer(403, { statusCode: 403, code: 'account_deletion_pending', message: 'x' }))).toEqual({ kind: 'deletion_pending' });
  });

  it('reads not found from the admin routes and from the read routes, which send no code', () => {
    expect(readFailure(answer(404, { statusCode: 404, code: 'not_found', message: 'No account has this ID' }))).toEqual({ kind: 'not_found' });
    expect(readFailure(answer(404, { statusCode: 404, message: 'No course has this code', error: 'Not Found' }))).toEqual({ kind: 'not_found' });
  });

  it.each(['duplicate_name', 'duplicate_code', 'last_access_manager', 'recipient_deletion_pending'] as const)('reads the 409 reason %s', (code) => {
    expect(readFailure(answer(409, { statusCode: 409, code, message: 'x' }))).toEqual({ kind: 'conflict', code, references: [] });
  });

  it('reads what still uses a referenced item', () => {
    const failure = readFailure(answer(409, { statusCode: 409, code: 'referenced_item', message: 'x', references: ['ZZ102 requires ZZ101', 7] }));
    expect(failure).toEqual({ kind: 'conflict', code: 'referenced_item', references: ['ZZ102 requires ZZ101'] });
  });

  it('reads the curricula a shared course change reaches, and whether the review is out of date', () => {
    const affectedCurricula = [{ curriculumId: '00000000-0000-4000-8000-0000000000c1', curriculumCode: 'ZZPROG2024', programCode: 'ZZPROG', cohortYear: 2024 }];
    expect(readFailure(answer(409, { statusCode: 409, code: 'impact_confirmation_required', message: 'x', affectedCurricula, reviewVersion: 'zz-v1' }))).toEqual({
      kind: 'impact',
      changed: false,
      affected: affectedCurricula,
      reviewVersion: 'zz-v1',
    });
    expect(readFailure(answer(409, { statusCode: 409, code: 'impact_changed', message: 'x', affectedCurricula: [], reviewVersion: 'zz-v2' }))).toEqual({
      kind: 'impact',
      changed: true,
      affected: [],
      reviewVersion: 'zz-v2',
    });
  });

  it('does not confirm an impact answer it cannot read', () => {
    const failure = readFailure(answer(409, { statusCode: 409, code: 'impact_confirmation_required', message: 'x', affectedCurricula: [{ curriculumId: 1 }] }));
    expect(failure).toEqual({ kind: 'refused', status: 409, code: 'impact_confirmation_required', details: ['x'] });
  });

  it('keeps a refusal it does not know as a refusal, with its code', () => {
    expect(readFailure(answer(409, { statusCode: 409, code: 'zz_new_reason', message: 'Something new' }))).toEqual({ kind: 'refused', status: 409, code: 'zz_new_reason', details: ['Something new'] });
    expect(readFailure(answer(429, { statusCode: 429, message: 'ThrottlerException: Too Many Requests' }))).toMatchObject({ kind: 'refused', status: 429, code: null });
  });
});

describe('byField', () => {
  const fields = ['name', 'nameVi', 'credits', 'prerequisites'] as const;

  it('puts each message under the field it starts with, and the rest apart', () => {
    expect(
      byField(
        ['nameVi should not be empty', 'credits must not be less than 1', 'credits must be an integer number', 'prerequisites: ZZ900 not a course of this curriculum; link it to a group first', 'property code should not exist'],
        fields,
      ),
    ).toEqual({
      fields: {
        nameVi: ['nameVi should not be empty'],
        credits: ['credits must not be less than 1', 'credits must be an integer number'],
        prerequisites: ['prerequisites: ZZ900 not a course of this curriculum; link it to a group first'],
      },
      other: ['property code should not exist'],
    });
  });

  it('does not take nameVi for name, and reads an indexed field', () => {
    expect(byField(['nameVi must be shorter than or equal to 255 characters', 'prerequisites[0]: "x y" is not a course code (letters A-Z and digits, 2 to 20)'], fields)).toEqual({
      fields: { nameVi: ['nameVi must be shorter than or equal to 255 characters'], prerequisites: ['prerequisites[0]: "x y" is not a course code (letters A-Z and digits, 2 to 20)'] },
      other: [],
    });
  });
});

describe('readReference', () => {
  it.each([
    ['ZZ102 requires ZZ101', { kind: 'requires', course: 'ZZ102', needs: 'ZZ101' }],
    ['prerequisites of ZZ101 are recorded', { kind: 'own_prerequisites', course: 'ZZ101' }],
    ['offering terms of ZZ101 are recorded', { kind: 'own_terms', course: 'ZZ101' }],
    ['links ZZ101', { kind: 'links', course: 'ZZ101' }],
    ['linked in ZZPROG2024', { kind: 'linked_in', curriculum: 'ZZPROG2024' }],
    ['2 curricula record its prerequisites', { kind: 'count', what: 'prerequisite_lists', count: 2 }],
    ['1 courses require it', { kind: 'count', what: 'required_by', count: 1 }],
    ['3 offering-term rows name it', { kind: 'count', what: 'offering_terms', count: 3 }],
    ['4 transcript rows name it', { kind: 'count', what: 'transcript_rows', count: 4 }],
    ['1 saved plans place it', { kind: 'count', what: 'plans', count: 1 }],
    // A requirement group's delete (curriculum-admin.service.ts): a count of distinct saved plans, or no number.
    ['2 saved plans use it', { kind: 'group_plans', count: 2 }],
    ['saved plans use it', { kind: 'group_plans', count: null }],
  ])('reads "%s"', (text, reference) => {
    expect(readReference(text)).toEqual(reference);
  });

  it('keeps a sentence it does not know as the API wrote it', () => {
    expect(readReference('5 new things name it')).toEqual({ kind: 'other', text: '5 new things name it' });
  });

  it('words the saved plans that use a group in both languages, with and without a number', () => {
    const say = (lang: 'vi' | 'en', text: string) => ADMIN_MESSAGES[lang].reference(readReference(text));
    expect(say('en', '3 saved plans use it')).toBe('3 saved plans use this group');
    expect(say('en', '1 saved plans use it')).toBe('1 saved plan uses this group');
    expect(say('en', 'saved plans use it')).toBe('saved plans use this group');
    expect(say('vi', '3 saved plans use it')).toBe('3 lộ trình đã lưu đang dùng nhóm này');
    expect(say('vi', 'saved plans use it')).toBe('có lộ trình đã lưu đang dùng nhóm này');
  });

});

describe('readFailure for the CSV import and the program routes (UC-11 A1, A2, A9)', () => {
  it('keeps the record-numbered errors of a file the API could not read', () => {
    const failure = readFailure(
      answer(400, { statusCode: 400, code: 'validation_failed', message: 'The CSV does not have the header of this template', errors: [{ record: 1, field: null, message: 'the header must be exactly: a,b' }, { record: 'x' }] }),
    );
    expect(failure).toEqual({ kind: 'file', details: ['The CSV does not have the header of this template'], errors: [{ record: 1, field: null, message: 'the header must be exactly: a,b' }] });
  });

  it('reads a 409 impact_changed without a new review as a changed import, to preview again', () => {
    expect(readFailure(answer(409, { statusCode: 409, code: 'impact_changed', message: 'x' }))).toEqual({ kind: 'review_changed' });
  });

  it('reads a 413 as too large, with the code or without it (the body parser answers before the route)', () => {
    expect(readFailure(answer(413, { statusCode: 413, code: 'payload_too_large', message: 'x' }))).toEqual({ kind: 'too_large' });
    expect(readFailure(answer(413, { statusCode: 413, message: 'request entity too large' }))).toEqual({ kind: 'too_large' });
    expect(readFailure(answer(413, null))).toEqual({ kind: 'too_large' });
  });

  it('reads a 415 as a compressed body', () => {
    expect(readFailure(answer(415, { statusCode: 415, code: 'unsupported_content_encoding', message: 'x' }))).toEqual({ kind: 'compressed' });
  });

  it('reads a second cohort of the same year as a conflict', () => {
    expect(readFailure(answer(409, { statusCode: 409, code: 'duplicate_cohort', message: 'x' }))).toEqual({ kind: 'conflict', code: 'duplicate_cohort', references: [] });
  });
});
