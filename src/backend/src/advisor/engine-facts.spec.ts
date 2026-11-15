import { describe, expect, it } from 'vitest';
import { auditFacts, courseFacts, planFacts, renderFact } from './engine-facts.js';
import { SYNTHETIC_COURSE, SYNTHETIC_RECORD } from './testing/advisor-test-kit.js';

const unchecked = [{ id: 'language', description: 'Chuẩn ngoại ngữ', citation: 'QĐ 1175/QĐ-KHTN Điều 17.3.d', status: 'not_checked' }];
const audit = (status: 'done' | 'not_yet') => ({
  engine: 'available',
  result: {
    graduation: { status, met: [], unmet: status === 'done' ? [] : [{ id: 'g', description: 'Core: CSC10002', citation: 'x', status: 'not_met' }], notChecked: unchecked },
    credits: { towardTotal: 7, inProgressTowardTotal: 4, totalRequired: 138, remaining: 131 },
    gpa: { accumulatedAverage: 6.5, gradedCredits: 7 },
  },
});

describe('engine facts', () => {
  it('names the facts of a course, a record and an unavailable engine', () => {
    expect(courseFacts(SYNTHETIC_COURSE).map((f) => f.id)).toEqual(['course:CSC10001']);
    expect(courseFacts(null)).toEqual([]);
    expect(courseFacts({ found: false, code: 'ZZ030' })).toEqual([]);
    expect(auditFacts(SYNTHETIC_RECORD, { engine: 'unavailable', reason: 'x' }).map((f) => f.id)).toEqual([
      'record',
      'record:CSC10001:2024-1',
      'record:MTH00003:2024-1',
      'record:CSC10002:2024-2',
      'audit:unavailable',
    ]);
    expect(planFacts({ engine: 'unavailable', reason: 'x' }).map((f) => f.id)).toEqual(['plan:unavailable']);
  });

  it('gives no fact for a result of an unknown shape', () => {
    expect(auditFacts({ name: 'x' }, { engine: 'available', result: { eligibleToGraduate: true } }).map((f) => f.id)).toEqual([]);
    expect(planFacts({ issues: 'none' })).toEqual([]);
  });

  it('renders the degree audit in fixed words, and never "can graduate" while the school still checks something (R12)', () => {
    const done = auditFacts(null, audit('done'));
    expect(done.map((f) => f.id)).toEqual(['audit:graduation', 'audit:credits', 'audit:gpa']);
    const [graduation, credits, gpa] = done.map((f) => renderFact(f.fact, 'en'));
    expect(graduation).toBe('Degree audit (rule engine): every condition the engine can check is met. The school still checks the conditions the engine cannot: Chuẩn ngoại ngữ.');
    expect(graduation).not.toMatch(/can graduate|eligible/i);
    expect(credits).toBe('Degree audit (rule engine): 7 of 138 credits count toward the program total; 4 credits in progress.');
    expect(gpa).toBe('Degree audit (rule engine): accumulated average 6.50 over 7 graded credits.');
    expect(renderFact(auditFacts(null, audit('not_yet'))[0].fact, 'vi')).toBe(
      'Bảng xét tốt nghiệp (bộ máy quy tắc): chưa hoàn tất. Điều kiện chưa đạt: Core: CSC10002. Điều kiện bộ máy không kiểm tra được: Chuẩn ngoại ngữ.',
    );
  });

  it('renders a course and a transcript row in both languages', () => {
    const course = courseFacts(SYNTHETIC_COURSE)[0].fact;
    expect(renderFact(course, 'en')).toBe('Course catalogue: CSC10001 Introduction to Programming (Nhập môn lập trình), 4 credits. Listed in: APCS cohort 2024: Core (compulsory).');
    expect(renderFact(course, 'vi')).toBe('Danh mục học phần: CSC10001 Nhập môn lập trình, 4 tín chỉ. Thuộc: APCS khóa 2024: Core (bắt buộc).');
    const row = auditFacts(SYNTHETIC_RECORD, null)[2].fact;
    expect(renderFact(row, 'vi')).toBe('Bảng điểm của bạn: MTH00003, 3 tín chỉ, học kỳ 1 năm học 2024–2025, có điểm, điểm 4,5.');
  });
});
