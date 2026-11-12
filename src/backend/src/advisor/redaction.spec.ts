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
    ['an OTP', 'OTP là 482913', '482913', PLACEHOLDERS.code],
    ['a student ID', 'Em gửi MSSV 21127001 nhé', '21127001', PLACEHOLDERS.studentId],
    ['a bare student ID', 'My ID 21127001, how many credits?', '21127001', PLACEHOLDERS.studentId],
    ['an email address', 'My email is synthetic.student@example.com', 'synthetic.student@example.com', PLACEHOLDERS.email],
    ['a phone number', 'phone 0900000000, my GPA question', '0900000000', PLACEHOLDERS.phone],
    ['a spaced phone number', 'gọi 090 000 0000 nhé', '090 000 0000', PLACEHOLDERS.phone],
    ['a date of birth', 'ngày sinh 01/01/2005, kiểm tra giúp em', '01/01/2005', PLACEHOLDERS.dateOfBirth],
    // rt77 round 2: natural phrasings, new kinds, cues split or disguised
    ['a password after a long phrase', 'Mật khẩu cổng thông tin đào tạo của mình hiện tại là Synth3tic!Pass, đăng ký thế nào?', 'Synth3tic!Pass', PLACEHOLDERS.password],
    ['"mk mình là"', 'mk mình là abc@1234, đăng ký học phần thế nào?', 'abc@1234', PLACEHOLDERS.password],
    ['a password with a zero-width space removed from its cue', 'mậtkhẩu: Synth3tic!Pass', 'Synth3tic!Pass', PLACEHOLDERS.password],
    ['a password after a Cyrillic cue', 'раssword: Synth3tic!Pass', 'Synth3tic!Pass', PLACEHOLDERS.password],
    ['a password next to a login', 'login/pw: synthuser / Synth3tic!Pass. How do I register?', 'Synth3tic!Pass', PLACEHOLDERS.password],
    ['a verification code', 'Mã xác thực của mình là 482913, xem kết quả ở đâu?', '482913', PLACEHOLDERS.code],
    ['an international phone number', 'SĐT mình (+84) 901 234 567 nhé', '901 234 567', PLACEHOLDERS.phone],
    ['a phone number with slashes', 'SĐT 090/123/4567.', '090/123/4567', PLACEHOLDERS.phone],
    ['an English birth date', 'I was born 12/03/2004.', '12/03/2004', PLACEHOLDERS.dateOfBirth],
    ['a Vietnamese birth date in words', 'Mình sinh ngày 12 tháng 3 năm 2004 nhé', '12 tháng 3 năm 2004', PLACEHOLDERS.dateOfBirth],
    ['a student ID after "SV-"', 'Mã SV-21127001 của mình', '21127001', PLACEHOLDERS.studentId],
    ['a spaced student ID', 'My student ID is 2 1 1 2 7 0 0 1, ok?', '2 1 1 2 7 0 0 1', PLACEHOLDERS.studentId],
    ['a citizen ID (CCCD)', 'Số CCCD của mình là 079204001234', '079204001234', PLACEHOLDERS.nationalId],
    ['a bare 12-digit ID', 'gửi 079204001234 nhé', '079204001234', PLACEHOLDERS.nationalId],
    ['an old ID card (CMND)', 'CMND của em: 123456789', '123456789', PLACEHOLDERS.nationalId],
    ['a home address', 'Nhà mình ở 12 Hẻm Synthetic, Phường 4, Quận 5; điều kiện học bổng?', '12 Hẻm Synthetic, Phường 4, Quận 5', PLACEHOLDERS.address],
    ['an email written with "at" and "dot"', 'Email mình là an.synthetic at example dot com nhé', 'an.synthetic at example dot com', PLACEHOLDERS.email],
    ['an email written with "(at)"', 'Reach me at an.synthetic(at)example(dot)com.', 'an.synthetic(at)example(dot)com', PLACEHOLDERS.email],
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
    ['passing a course', 'How do I pass CSC10001 and MTH00003?'],
    ['a school year typed with spaces', 'Học kỳ 1 năm học 2024 2025 được đăng ký tối đa bao nhiêu tín chỉ?'],
    ['citations in a history turn', 'Theo [[qd-1175-2021/d7/k2/b]] và [[so-tay-2024-2025/hoc-bong/d2/k1]], đúng không?'],
    ['an office address question', 'Địa chỉ phòng đào tạo ở đâu?'],
    ['the dormitory', 'Mình ở ký túc xá, phí nội trú tính thế nào?'],
    ['grades with decimals', 'Điểm của em 8.5 4.5 7.0 6.0 9.0 thì xếp loại gì?'],
    ['a password reset question', 'How do I do a password-reset on the portal?'],
    ['a sign-in question', 'What is the OTP for when I sign in to the portal?'],
  ])('keeps %s', (_name, text) => {
    expect(redactPersonalData(text)).toEqual({ text, redacted: false });
  });

  it('has a notice in both languages with no digits', () => {
    for (const text of Object.values(REDACTION_NOTICE)) expect(text).not.toMatch(/\d/);
  });
});
