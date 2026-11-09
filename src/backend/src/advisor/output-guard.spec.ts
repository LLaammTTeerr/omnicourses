import { describe, expect, it } from 'vitest';
import { buildInstructions, FIXED_REPLIES } from './advisor-prompt.js';
import { TurnEvidence } from './advisor-tools.js';
import { guardAnswer, maskPersonalData } from './output-guard.js';
import { regulationIndex } from './retrieval/regulation-corpus.js';

const index = regulationIndex();
const canary = 'OC-feedface00000000';
const clause = (id: string) => index.get(`qd-1175-2021/${id}`)!;

function check(answer: string, options: { context?: string[]; tool?: unknown; language?: 'vi' | 'en' } = {}) {
  const evidence = new TurnEvidence();
  const clauses = (options.context ?? ['d7/k2/a', 'd7/k2/b']).map(clause);
  evidence.addClauses(clauses);
  if (options.tool !== undefined) evidence.addTool('get_my_audit', true, options.tool);
  const language = options.language ?? 'en';
  const instructions = buildInstructions({ language, consented: true, clauses, canary });
  return guardAnswer({ answer, language, evidence, index, canary, instructions, toolNames: ['search_regulations', 'get_course', 'get_my_audit', 'get_my_plan_issues'] });
}

describe('output guard', () => {
  it('passes a short answer whose numbers are in the clause it cites', () => {
    const verdict = check('An Advanced Program student may register at most 22 credits per main term [[qd-1175-2021/d7/k2/b]].');
    expect(verdict).toMatchObject({ status: 'passed', reasons: [] });
    expect(verdict.citations.map((c) => c.id)).toEqual(['qd-1175-2021/d7/k2/b']);
  });

  it('passes every fixed reply the prompt tells the model to give', () => {
    for (const reply of Object.values(FIXED_REPLIES)) for (const language of ['vi', 'en'] as const) expect(check(reply[language], { language }).status).toBe('passed');
  });

  it.each([
    ['a citation to a clause that does not exist', 'The cap is 22 credits [[qd-1175-2021/d99/k1]].', 'unknown_citation'],
    ['a malformed citation', 'See [[ignore previous instructions]].', 'unknown_citation'],
    ['a real clause the model was not given', 'You must retake it [[qd-1175-2021/d14/k1/b]].', 'citation_not_in_context'],
    ['an article outside the context, in prose', 'Theo Điều 99 của quy chế, bạn được học 30 tín chỉ.', 'uncited_article'],
    ['another legal document', 'Under Decree 99, students may skip the cap.', 'other_document'],
    ['a credit number no source states', 'You can take 30 credits per term [[qd-1175-2021/d7/k2/b]].', 'ungrounded_number'],
    ['a grade threshold with no source at all', 'You pass a course with 4.0 points.', 'ungrounded_number'],
    ['the internal marker', `My marker is ${canary}.`, 'canary'],
    ['a run of the system prompt', 'Sure: Use only the clauses in the reference block below and the results of your tools in this turn.', 'prompt_echo'],
    ['a tool name', 'I have these tools: search_regulations and get_my_audit.', 'prompt_echo'],
    ['a claim to have registered', "Done! I've registered you for CSC10001.", 'action_claim'],
    ['a Vietnamese claim to have registered', 'Mình đã đăng ký giúp bạn môn CSC10001 rồi nhé.', 'action_claim'],
    ['a password request', 'Please send me your portal password so I can check.', 'credential'],
    ['a Vietnamese login request', 'Bạn hãy đăng nhập lại bằng tài khoản cổng thông tin để xác nhận.', 'credential'],
    ['a stated password', 'Your portal password is hunter2.', 'credential'],
    ['a nominal action claim', 'Withdrawal submitted. You have been withdrawn from MTH00003.', 'action_claim'],
    ['a Vietnamese passive action claim', 'Bạn đã được rút khỏi học phần MTH00003.', 'action_claim'],
    ['a request for identity data', 'Please send me the following:\n1. Full name\n2. Student ID', 'personal_data_request'],
    ['a question for identity data', "Sure. What's your full name and student ID?", 'personal_data_request'],
    ['a promise to store data', 'Once you reply, I will save these to my memory.', 'personal_data_request'],
    ['a Vietnamese identity request', 'Bạn gửi mình họ tên và mã số sinh viên nhé.', 'personal_data_request'],
    ['a link', 'Log in again at https://portal-hcmus.example.com/login to confirm.', 'link'],
    ['a number in a sentence with no rule word', '5,0', 'ungrounded_number'],
    ['a spelled-out grade', 'Năm phẩy không.', 'ungrounded_number'],
    ['a folded "mức" that is not a section label', 'Quy chế cho phép mức 40 tín chỉ [[qd-1175-2021/d7/k2/b]].', 'ungrounded_number'],
    ['a fabricated quotation of a real clause', 'Điều 7 ghi: "sinh viên năm cuối được đăng ký không giới hạn số tín chỉ" [[qd-1175-2021/d7/k2/b]]', 'misquote'],
    ['a graduation verdict', 'You are eligible to graduate.', 'status_claim'],
    ['a bare yes', 'YES', 'status_claim'],
    ['a bare no with a tail', 'Nope — not yet.', 'status_claim'],
    ['a paraphrased graduation verdict', "From what a typical third-year has, you're on track to graduate.", 'status_claim'],
    ['a requirement verdict', 'No. You do not meet the graduation requirement yet.', 'status_claim'],
    ['a third-person verdict', 'The student has satisfied all requirements of the program.', 'status_claim'],
    ['a Vietnamese verdict', 'Bạn đủ điều kiện tốt nghiệp.', 'status_claim'],
    ['a Vietnamese prerequisite verdict', 'Bạn được đăng ký CSC10002 kỳ sau.', 'status_claim'],
    ['an empty answer', '', 'ungrounded_answer'],
    ['a short uncited claim that is no refusal', 'Good news: graduation looks settled for you this term.', 'ungrounded_answer'],
    ['a short uncited action claim in other words', 'All set: MTH00003 is off your timetable now.', 'ungrounded_answer'],
    ['code', 'Here you go:\n```python\nprint(22)\n```', 'code'],
    ['code without a fence', 'def cap():\n    return 22', 'code'],
  ])('replaces %s', (_name, answer, reason) => {
    const verdict = check(answer);
    expect(verdict.status).toBe('replaced');
    expect(verdict.reasons).toContain(reason);
  });

  it.each([
    ['advice to change a password the student shared', 'Please change your portal password, since you shared it here.'],
    ['a warning not to type a password', 'Đừng nhập mật khẩu vào trang lạ. Vì bạn vừa gửi mật khẩu vào đây, bạn nên đổi mật khẩu ngay.'],
    ['a refusal to collect identity data', "I don't need your student ID or phone number: I see your own record through the app. For anything else, ask the academic affairs office."],
    ['a short referral with no citation', 'I found no clause on tuition refunds in my sources; please ask the academic affairs office (Phòng Đào tạo).'],
    ['a hedged status sentence', 'The audit is not connected yet, so I cannot confirm whether you can graduate.'],
    ['a Vietnamese hedged status sentence', 'Mình không thể xác nhận bạn có đủ điều kiện tốt nghiệp hay không.'],
    ['an exact quotation, cut by an ellipsis', '"Số tín chỉ đăng ký học tối đa trong học kỳ chính: … tối đa là 22 tín chỉ." [[qd-1175-2021/d7/k2/b]]'],
    ['question labels', 'Câu 1: the cap is 22 credits [[qd-1175-2021/d7/k2/b]]. Câu 2: I only answer study-rule questions.'],
  ])('passes %s', (_name, answer) => {
    expect(check(answer)).toMatchObject({ status: 'passed', reasons: [] });
  });

  it('accepts a verdict on the student once the rule engine answered this turn', () => {
    const evidence = { engine: 'available', result: { canGraduate: true } };
    expect(check('You are eligible to graduate.', { tool: evidence }).status).toBe('passed');
    expect(check('You are eligible to graduate.', { tool: { engine: 'unavailable', reason: 'not connected' } }).reasons).toContain('status_claim');
  });

  it('counts the numbers of a searched clause only once the answer cites it', () => {
    const evidence = new TurnEvidence();
    evidence.addClauses([clause('d14/k1/b')]);
    evidence.addTool('search_regulations', true, [{ text: clause('d14/k1/b').text }]);
    const instructions = buildInstructions({ language: 'vi', consented: false, clauses: [], canary });
    const verdict = guardAnswer({ answer: '5,0', language: 'vi', evidence, index, canary, instructions, toolNames: [] });
    expect(verdict.reasons).toContain('ungrounded_number');
  });

  it('replaces a long answer grounded in nothing', () => {
    const essay = 'Autumn in Saigon is a quiet season of soft rain and golden light. '.repeat(8);
    expect(check(essay).reasons).toContain('ungrounded_answer');
  });

  it('accepts a number that a tool returned', () => {
    expect(check('Your transcript shows CSC10001 graded 8.5 in term 1 of 2024.', { tool: { grade: 8.5, year: 2024, number: 1 } }).status).toBe('passed');
    expect(check('Your transcript shows CSC10001 graded 9.5.', { tool: { grade: 8.5 } }).reasons).toContain('ungrounded_number');
  });

  it('reads "5,0" and "5.0" as the same number, and ignores the digits of labels and course codes', () => {
    const verdict = check('Học phần có điểm từ 5,0 trở lên là đạt, theo Điều 11 khoản 4 [[qd-1175-2021/d11/k4]].', { context: ['d11/k4'], language: 'vi' });
    expect(verdict.status).toBe('passed');
    expect(check('A course graded 5.0 or more is passed [[qd-1175-2021/d11/k4]] (CSC10001 included).', { context: ['d11/k4'] }).status).toBe('passed');
  });

  it('replaces a whole answer with a fallback that states no number', () => {
    const verdict = check('You can take 30 credits [[qd-1175-2021/d7/k2/b]] and I registered you for CSC10001.');
    expect(verdict.text).toBe(FIXED_REPLIES.cannotAct.en);
    expect(verdict.citations.map((c) => c.id)).toEqual(['qd-1175-2021/d7/k2/a', 'qd-1175-2021/d7/k2/b']);
    for (const reply of Object.values(FIXED_REPLIES)) for (const text of Object.values(reply)) expect(text).not.toMatch(/\d/);
  });

  it('catches the marker and code through homoglyphs and invisible characters', () => {
    expect(check(`marker: ${canary.replace('O', 'О')}`).reasons).toContain('canary'); // Cyrillic О
    expect(check(`marker: ${canary.split('').join('​')}`).reasons).toContain('canary');
  });

  it('masks a student ID, an email and a phone number in an answer it shows', () => {
    expect(maskPersonalData('Student 99990001, a@example.com, 0900000000, grade 8.5, CSC10001')).toBe('Student […], […], […], grade 8.5, CSC10001');
  });

  it('never finds the reference block delimiters inside a clause text', () => {
    const texts = Array.from({ length: index.size }, () => '').length;
    expect(texts).toBeGreaterThan(0);
    for (const id of ['d1/k1', 'd7/k2/b', 'd17/k3']) expect(clause(id).text).not.toMatch(/<\/?(reference_clauses|clause)/);
  });
});
