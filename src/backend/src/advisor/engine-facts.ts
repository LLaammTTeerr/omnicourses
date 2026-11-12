import { z } from 'zod';
import type { AdvisorLanguage } from './advisor-prompt.js';

// Engine facts (ADR 0016, option A). What the advisor states about a course, the student's record or
// the rule engine's results is written by the server, from data it holds, in fixed Vietnamese and
// English templates. A tool result lists the ids of its facts; the model picks facts by id and never
// supplies a word or a number of their text (hard rule 1). A result of an unknown shape gives no fact.

const term = z.object({ year: z.number().int(), number: z.number().int() });

const CourseSchema = z.object({
  code: z.string(),
  nameVi: z.string(),
  nameEn: z.string().nullable().optional(),
  credits: z.number(),
  memberships: z
    .array(z.object({ programCode: z.string(), cohortYear: z.number().int(), requirementGroupName: z.string(), kind: z.string() }))
    .optional(),
});

const RecordSchema = z.object({
  program: z.string().nullable(),
  cohort: z.number().int().nullable(),
  courses: z.array(z.object({ code: z.string(), credits: z.number(), result: z.string(), grade: z.number().nullable(), term })),
});

const condition = z.object({ description: z.string() });
/** The parts of the degree audit (rules/audit-types.ts) the advisor states. */
const AuditSchema = z.object({
  graduation: z.object({ status: z.enum(['done', 'not_yet']), unmet: z.array(condition), notChecked: z.array(condition) }).optional(),
  credits: z.object({ towardTotal: z.number(), inProgressTowardTotal: z.number(), totalRequired: z.number().nullable(), remaining: z.number().nullable() }).optional(),
  gpa: z.object({ accumulatedAverage: z.number().nullable(), gradedCredits: z.number() }).optional(),
});

/** The plan check's issues (plans/plan-issues.ts): each carries the engine's own message. */
const PlanIssuesSchema = z.object({ issues: z.array(z.object({ message: z.string(), citation: z.string().nullable().optional() })) });

const EngineAnswer = z.discriminatedUnion('engine', [z.object({ engine: z.literal('available'), result: z.unknown() }), z.object({ engine: z.literal('unavailable') })]);

export type EngineFact =
  | { kind: 'course'; course: z.infer<typeof CourseSchema> }
  | { kind: 'record'; program: string | null; cohort: number | null; courses: number }
  | { kind: 'record_course'; course: z.infer<typeof RecordSchema>['courses'][number] }
  | { kind: 'engine_unavailable'; what: 'audit' | 'plan' }
  | { kind: 'graduation'; graduation: NonNullable<z.infer<typeof AuditSchema>['graduation']> }
  | { kind: 'credits'; credits: NonNullable<z.infer<typeof AuditSchema>['credits']> }
  | { kind: 'gpa'; gpa: NonNullable<z.infer<typeof AuditSchema>['gpa']> }
  | { kind: 'plan_issue'; message: string; citation: string | null };

export interface IdentifiedFact {
  id: string;
  fact: EngineFact;
}

const MAX_RECORD_COURSES = 60;
const MAX_PLAN_ISSUES = 20;

/** The facts of one course lookup; none for a course the catalogue does not have. */
export function courseFacts(result: unknown): IdentifiedFact[] {
  const course = CourseSchema.safeParse(result);
  return course.success ? [{ id: `course:${course.data.code}`, fact: { kind: 'course', course: course.data } }] : [];
}

/** The facts of the student's record and the degree audit (get_my_audit). */
export function auditFacts(record: unknown, audit: unknown): IdentifiedFact[] {
  const out: IdentifiedFact[] = [];
  const r = RecordSchema.safeParse(record);
  if (r.success) {
    out.push({ id: 'record', fact: { kind: 'record', program: r.data.program, cohort: r.data.cohort, courses: r.data.courses.length } });
    const seen = new Set<string>();
    for (const course of r.data.courses.slice(0, MAX_RECORD_COURSES)) {
      const id = `record:${course.code}:${course.term.year}-${course.term.number}`;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({ id, fact: { kind: 'record_course', course } });
    }
  }
  const answer = EngineAnswer.safeParse(audit);
  if (!answer.success) return out;
  if (answer.data.engine === 'unavailable') return [...out, { id: 'audit:unavailable', fact: { kind: 'engine_unavailable', what: 'audit' } }];
  const a = AuditSchema.safeParse(answer.data.result);
  if (!a.success) return out;
  if (a.data.graduation) out.push({ id: 'audit:graduation', fact: { kind: 'graduation', graduation: a.data.graduation } });
  if (a.data.credits) out.push({ id: 'audit:credits', fact: { kind: 'credits', credits: a.data.credits } });
  if (a.data.gpa) out.push({ id: 'audit:gpa', fact: { kind: 'gpa', gpa: a.data.gpa } });
  return out;
}

/** The facts of the plan check (get_my_plan_issues). */
export function planFacts(result: unknown): IdentifiedFact[] {
  const answer = EngineAnswer.safeParse(result);
  if (!answer.success) return [];
  if (answer.data.engine === 'unavailable') return [{ id: 'plan:unavailable', fact: { kind: 'engine_unavailable', what: 'plan' } }];
  const report = PlanIssuesSchema.safeParse(answer.data.result);
  if (!report.success) return [];
  return report.data.issues.slice(0, MAX_PLAN_ISSUES).map((issue, i) => ({ id: `plan:issue:${i + 1}`, fact: { kind: 'plan_issue', message: issue.message, citation: issue.citation ?? null } }));
}

// ── Templates ────────────────────────────────────────────────────────────────
// Numbers are printed from the data: grades with one decimal as the school writes them (8,5 in
// Vietnamese), credits as integers.

const grade = (value: number, language: AdvisorLanguage) => (language === 'vi' ? value.toFixed(1).replace('.', ',') : value.toFixed(1));
const termLabel = (t: { year: number; number: number }, language: AdvisorLanguage) =>
  language === 'vi' ? `học kỳ ${t.number} năm học ${t.year}–${t.year + 1}` : `term ${t.number} of ${t.year}–${t.year + 1}`;
const RESULT: Record<string, Record<AdvisorLanguage, string>> = {
  graded: { vi: 'có điểm', en: 'graded' },
  in_progress: { vi: 'đang học', en: 'in progress' },
  pass: { vi: 'đạt', en: 'passed' },
  fail: { vi: 'không đạt', en: 'failed' },
  exempt: { vi: 'miễn', en: 'exempt' },
};
const KIND: Record<string, Record<AdvisorLanguage, string>> = {
  compulsory: { vi: 'bắt buộc', en: 'compulsory' },
  elective: { vi: 'tự chọn', en: 'elective' },
};
const list = (items: string[], language: AdvisorLanguage) => (items.length ? items.join('; ') : language === 'vi' ? 'không có' : 'none');

/**
 * A catalogue or engine string as one line of plain text (J30, J31): format characters (bidi
 * overrides and isolates, zero-width characters, the BOM) are removed, and control characters and
 * line breaks become a space, so a name cannot reorder the line or start a new "SYSTEM:" line.
 * Markup is not escaped here: every segment is plain text, and the screen renders it as text, never
 * as HTML (AdvisorSegmentDto). Escaping here would show "&lt;" on a screen that does that right.
 */
export function plainText(text: string): string {
  return text
    .normalize('NFC')
    .replace(/\p{Cf}/gu, '')
    .replace(/[\p{Cc}\s\u2028\u2029]+/gu, ' ')
    .trim();
}

/** The fact in the student's language, written by the server, as one line of plain text. */
export function renderFact(fact: EngineFact, language: AdvisorLanguage): string {
  return plainText(renderTemplate(fact, language));
}

function renderTemplate(fact: EngineFact, language: AdvisorLanguage): string {
  const vi = language === 'vi';
  switch (fact.kind) {
    case 'course': {
      const c = fact.course;
      const name = vi || !c.nameEn ? c.nameVi : `${c.nameEn} (${c.nameVi})`;
      const groups = (c.memberships ?? []).map(
        (m) => `${m.programCode} ${vi ? 'khóa' : 'cohort'} ${m.cohortYear}: ${m.requirementGroupName} (${KIND[m.kind]?.[language] ?? m.kind})`,
      );
      return vi
        ? `Danh mục học phần: ${c.code} ${name}, ${c.credits} tín chỉ. Thuộc: ${list(groups, language)}.`
        : `Course catalogue: ${c.code} ${name}, ${c.credits} credits. Listed in: ${list(groups, language)}.`;
    }
    case 'record':
      return vi
        ? `Hồ sơ của bạn: chương trình ${fact.program ?? 'chưa khai báo'}, khóa ${fact.cohort ?? 'chưa khai báo'}, ${fact.courses} lượt học phần trong bảng điểm.`
        : `Your record: program ${fact.program ?? 'not given'}, cohort ${fact.cohort ?? 'not given'}, ${fact.courses} course entries on the transcript.`;
    case 'record_course': {
      const c = fact.course;
      const result = RESULT[c.result]?.[language] ?? c.result;
      const g = c.grade === null ? '' : vi ? `, điểm ${grade(c.grade, language)}` : `, grade ${grade(c.grade, language)}`;
      return vi
        ? `Bảng điểm của bạn: ${c.code}, ${c.credits} tín chỉ, ${termLabel(c.term, language)}, ${result}${g}.`
        : `Your transcript: ${c.code}, ${c.credits} credits, ${termLabel(c.term, language)}, ${result}${g}.`;
    }
    case 'engine_unavailable':
      return fact.what === 'audit'
        ? vi
          ? 'Bảng xét tốt nghiệp của bộ máy quy tắc chưa được kết nối với trợ lý, nên OmniCourse chưa thể xác nhận điều này cho bạn. Phòng Đào tạo có thể xác nhận.'
          : "The rule engine's degree audit is not connected to the advisor yet, so OmniCourse cannot confirm this for you. The academic affairs office can."
        : vi
          ? 'Phần kiểm tra lộ trình của bộ máy quy tắc chưa được kết nối với trợ lý, nên OmniCourse chưa thể kiểm tra lộ trình của bạn ở đây.'
          : "The rule engine's plan check is not connected to the advisor yet, so OmniCourse cannot check your plan here.";
    case 'graduation': {
      const g = fact.graduation;
      const unmet = g.unmet.map((c) => c.description);
      const unchecked = g.notChecked.map((c) => c.description);
      // R12: "done" never reads as "can graduate": the school still checks what the engine cannot.
      if (g.status === 'not_yet') {
        return vi
          ? `Bảng xét tốt nghiệp (bộ máy quy tắc): chưa hoàn tất. Điều kiện chưa đạt: ${list(unmet, language)}. Điều kiện bộ máy không kiểm tra được: ${list(unchecked, language)}.`
          : `Degree audit (rule engine): not complete. Conditions not met: ${list(unmet, language)}. Conditions the engine cannot check: ${list(unchecked, language)}.`;
      }
      return vi
        ? `Bảng xét tốt nghiệp (bộ máy quy tắc): mọi điều kiện bộ máy kiểm tra được đều đạt. Nhà trường vẫn xét các điều kiện bộ máy không kiểm tra được: ${list(unchecked, language)}.`
        : `Degree audit (rule engine): every condition the engine can check is met. The school still checks the conditions the engine cannot: ${list(unchecked, language)}.`;
    }
    case 'credits': {
      const c = fact.credits;
      const of = c.totalRequired === null ? '' : vi ? ` trên ${c.totalRequired}` : ` of ${c.totalRequired}`;
      return vi
        ? `Bảng xét tốt nghiệp (bộ máy quy tắc): ${c.towardTotal}${of} tín chỉ tính vào tổng của chương trình; ${c.inProgressTowardTotal} tín chỉ đang học.`
        : `Degree audit (rule engine): ${c.towardTotal}${of} credits count toward the program total; ${c.inProgressTowardTotal} credits in progress.`;
    }
    case 'gpa':
      return fact.gpa.accumulatedAverage === null
        ? vi
          ? 'Bảng xét tốt nghiệp (bộ máy quy tắc): chưa có điểm trung bình tích lũy.'
          : 'Degree audit (rule engine): no accumulated average yet.'
        : vi
          ? `Bảng xét tốt nghiệp (bộ máy quy tắc): điểm trung bình tích lũy ${fact.gpa.accumulatedAverage.toFixed(2).replace('.', ',')} trên ${fact.gpa.gradedCredits} tín chỉ có điểm.`
          : `Degree audit (rule engine): accumulated average ${fact.gpa.accumulatedAverage.toFixed(2)} over ${fact.gpa.gradedCredits} graded credits.`;
    case 'plan_issue':
      return `${vi ? 'Kiểm tra lộ trình (bộ máy quy tắc)' : 'Plan check (rule engine)'}: ${fact.message}${fact.citation ? ` (${fact.citation})` : ''}`;
  }
}
