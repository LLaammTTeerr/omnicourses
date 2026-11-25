import { describe, expect, it } from 'vitest';
import { ADMIN_MESSAGES } from './messages.js';
import { describeProblem } from './problem.js';
import type { Problem } from './write.js';

const vi = ADMIN_MESSAGES.vi;
const en = ADMIN_MESSAGES.en;

describe('describeProblem: each reason in words, in both languages', () => {
  it('names the missing permission of a 403 (UC-11 A4)', () => {
    const problem: Problem = { outcome: 'refused', failure: { kind: 'permission', permission: 'catalog_maintainer' } };
    expect(describeProblem(problem, vi)).toMatchObject({
      code: 'permission_required',
      tone: 'bad',
      text: 'Thao tác này cần quyền “Quản lý danh mục học phần”. Tài khoản của bạn không có quyền đó. Chưa lưu gì.',
    });
    expect(describeProblem(problem, en).text).toBe('This needs the “Catalog maintainer” permission. Your account does not hold it. Nothing was saved.');
    expect(describeProblem({ outcome: 'refused', failure: { kind: 'permission', permission: 'program_admin' } }, en).text).toContain('“Program administrator”');
    expect(describeProblem({ outcome: 'refused', failure: { kind: 'permission', permission: 'access_manager' } }, vi).text).toContain('“Quản lý phân quyền”');
    expect(describeProblem({ outcome: 'refused', failure: { kind: 'permission', permission: null } }, en).text).toBe('Your account may not do this. Nothing was saved.');
  });

  it('spells out a prerequisite cycle', () => {
    const problem: Problem = { outcome: 'refused', failure: { kind: 'cycle', cycle: ['ZZ101', 'ZZ103', 'ZZ102', 'ZZ101'] } };
    expect(describeProblem(problem, vi)).toMatchObject({ code: 'prerequisite_cycle', text: expect.stringContaining('Vòng tiên quyết: ZZ101 → ZZ103 → ZZ102 → ZZ101.') });
    expect(describeProblem(problem, en).text).toContain('Prerequisite cycle: ZZ101 → ZZ103 → ZZ102 → ZZ101. Each course in the cycle requires the next one');
  });

  it('sorts the API\'s validation messages by the fields of the form, and keeps the rest to show below', () => {
    const problem: Problem = { outcome: 'refused', failure: { kind: 'validation', details: ['name should not be empty', 'property creditsTotal should not exist'] } };
    expect(describeProblem(problem, vi, ['name', 'kind'])).toEqual({
      code: 'validation_failed',
      tone: 'bad',
      text: 'Máy chủ từ chối giá trị đã nhập. Chưa lưu gì.',
      items: ['property creditsTotal should not exist'],
      serverText: true,
      fields: { name: ['name should not be empty'] },
      reload: false,
    });
  });

  it('says what still uses a referenced item, in the language on screen', () => {
    const problem: Problem = {
      outcome: 'refused',
      failure: { kind: 'conflict', code: 'referenced_item', references: ['ZZ102 requires ZZ101', 'offering terms of ZZ101 are recorded', '2 transcript rows name it', 'a new kind of reference'] },
    };
    expect(describeProblem(problem, vi)).toMatchObject({
      code: 'referenced_item',
      text: 'Chưa gỡ được vì còn chỗ đang dùng mục này. Chưa đổi gì. Gỡ các chỗ sau trước:',
      items: ['ZZ102 cần ZZ101 làm tiên quyết', 'kỳ mở của ZZ101 đã được ghi nhận', '2 dòng bảng điểm ghi học phần này', 'a new kind of reference'],
      serverText: false,
    });
    expect(describeProblem(problem, en).items).toEqual(['ZZ102 requires ZZ101', 'the offering terms of ZZ101 are recorded', '2 transcript rows name this course', 'a new kind of reference']);
  });

  it.each([
    ['duplicate_name', 'Khóa này đã có một nhóm yêu cầu cùng tên. Chưa lưu gì.', 'This cohort already has a requirement group with this name. Nothing was saved.'],
    ['duplicate_code', 'Danh mục đã có học phần mang mã này. Chưa lưu gì.', 'The catalog already has a course with this code. Nothing was saved.'],
    [
      'last_access_manager',
      'Đây là người quản lý phân quyền cuối cùng còn hoạt động. Cấp quyền này cho người khác trước khi thu hồi. Chưa đổi gì.',
      'This is the last active access manager. Grant the permission to someone else before you revoke it. Nothing was changed.',
    ],
    ['recipient_deletion_pending', 'Tài khoản đó đang chờ xóa nên không nhận quyền được. Chưa cấp gì.', 'That account is waiting for deletion, so it cannot receive a permission. Nothing was granted.'],
  ] as const)('words the 409 reason %s', (code, inVietnamese, inEnglish) => {
    const problem: Problem = { outcome: 'refused', failure: { kind: 'conflict', code, references: [] } };
    expect(describeProblem(problem, vi)).toMatchObject({ code, text: inVietnamese, tone: 'bad' });
    expect(describeProblem(problem, en).text).toBe(inEnglish);
  });

  it('words the other refusals, with the code a test script can read', () => {
    expect(describeProblem({ outcome: 'refused', failure: { kind: 'not_found' } }, en)).toMatchObject({ code: 'not_found', text: expect.stringContaining('was not found') });
    expect(describeProblem({ outcome: 'refused', failure: { kind: 'deletion_pending' } }, vi)).toMatchObject({ code: 'account_deletion_pending', text: expect.stringContaining('đang chờ xóa') });
    expect(describeProblem({ outcome: 'refused', failure: { kind: 'refused', status: 429, code: null, details: [] } }, en)).toMatchObject({ code: 'http_429', text: expect.stringContaining('Too many requests') });
    expect(describeProblem({ outcome: 'refused', failure: { kind: 'refused', status: 409, code: 'zz_new_reason', details: ['Something new'] } }, en)).toMatchObject({
      code: 'zz_new_reason',
      text: 'The server refused the request (status 409). Nothing was saved.',
      items: ['Something new'],
      serverText: true,
    });
  });

  it('never says saved for a write that got no answer (UC-11 A7)', () => {
    const notApplied = describeProblem({ outcome: 'not_applied' }, en);
    expect(notApplied).toMatchObject({ code: 'not_applied', tone: 'warn', reload: false });
    expect(notApplied.text).toBe('The server did not answer the save, so OmniCourse reloaded the saved data. The saved data does not have this change. Check it, then save again if needed.');
    const unknown = describeProblem({ outcome: 'unknown' }, vi);
    expect(unknown).toMatchObject({ code: 'unknown', tone: 'warn', reload: true });
    expect(unknown.text).toBe('Máy chủ không trả lời, và OmniCourse cũng chưa tải lại được dữ liệu đã lưu. Chưa rõ thay đổi đã được lưu hay chưa. Hãy tải lại dữ liệu trước khi thử lại.');
  });
});
