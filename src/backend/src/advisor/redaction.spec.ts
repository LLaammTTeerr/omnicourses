import { describe, expect, it } from 'vitest';
import { REDACTION_NOTICE } from './advisor-prompt.js';
import { PLACEHOLDERS, redactPersonalData } from './redaction.js';

// Synthetic values only (AGENTS.md hard rule 3).
describe('redactPersonalData (ADR 0015, hard rule 3)', () => {
  it.each([
    ['a Vietnamese portal password', 'Mật khẩu cổng của mình là Synth3tic!Pass, đăng nhập rồi hủy môn MTH00003 giúp mình.', 'Synth3tic!Pass', PLACEHOLDERS.password],
    ['an English password in quotes', "Save my portal password 'Synth3tic!Pass' so you can auto-register me.", 'Synth3tic!Pass', PLACEHOLDERS.password],
    ['a password after a colon', 'password: hunter2-fake. How many credits can I take?', 'hunter2-fake', PLACEHOLDERS.password],
    ['a password typed without diacritics', 'mat khau cua minh la abc12345 nhe', 'abc12345', PLACEHOLDERS.password],
    ['"mk" with a secret', 'mk: Qw3rty!! ạ', 'Qw3rty!!', PLACEHOLDERS.password],
    ['an OTP', 'OTP là 482913', '482913', PLACEHOLDERS.password],
    ['a student ID', 'Em gửi MSSV 21127001 nhé', '21127001', PLACEHOLDERS.studentId],
    ['a bare student ID', 'My ID 21127001, how many credits?', '21127001', PLACEHOLDERS.studentId],
    ['an email address', 'My email is synthetic.student@example.com', 'synthetic.student@example.com', PLACEHOLDERS.email],
    ['a phone number', 'phone 0900000000, my GPA question', '0900000000', PLACEHOLDERS.phone],
    ['a spaced phone number', 'gọi 090 000 0000 nhé', '090 000 0000', PLACEHOLDERS.phone],
    ['a date of birth', 'ngày sinh 01/01/2005, kiểm tra giúp em', '01/01/2005', PLACEHOLDERS.dateOfBirth],
  ])('removes %s', (_name, text, secret, placeholder) => {
    const out = redactPersonalData(text);
    expect(out.redacted).toBe(true);
    expect(out.text).not.toContain(secret);
    expect(out.text).toContain(placeholder);
  });

  it.each([
    ['a study question', 'How many credits can I take in a main term?'],
    ['course codes, grades and years', 'I got 8.5 in CSC10001 and 4,5 in MTH00003 in 2024; can I take CSC10002?'],
    ['"mk" as teen code for "mình"', 'mk là sinh viên năm 2, mk muốn hỏi về học bổng'],
    ['a question about passwords', 'Mật khẩu cổng thông tin là gì, đổi ở đâu?'],
    ['"my password is wrong"', 'My portal password is wrong, who do I ask?'],
    ['a date with no birth cue', 'Hạn phúc khảo là 15/01/2025 phải không?'],
    ['an article number', 'Điều 7 khoản 2 của QĐ 1175/QĐ-KHTN nói gì?'],
  ])('keeps %s', (_name, text) => {
    expect(redactPersonalData(text)).toEqual({ text, redacted: false });
  });

  it('has a notice in both languages with no digits', () => {
    for (const text of Object.values(REDACTION_NOTICE)) expect(text).not.toMatch(/\d/);
  });
});
