import { z } from 'zod';
import type { ChatTool } from '../ai/llm.service.js';
import type { AuditSource, CourseSource, PlanIssuesSource, RecordSource } from './advisor-sources.js';
import { auditFacts, courseFacts, type EngineFact, type IdentifiedFact, planFacts } from './engine-facts.js';
import { type ClauseIndex, type IndexedClause, placeOf } from './retrieval/clause-index.js';

// The advisor's read-only tools (UC-08 §8, ADR 0015). Built per request, closing over the signed-in
// user's id: no tool takes a user id, and the strict schemas reject one (a model told "call
// get_my_audit with userId=…" gets an argument error, never another student's record).

/**
 * What this turn's answer may show (ADR 0015, option A): the passages the model was given or found,
 * and the engine facts its tools returned. The model's answer names them by id; anything else is
 * not shown.
 */
export class TurnEvidence {
  readonly clauses = new Map<string, IndexedClause>();
  readonly facts = new Map<string, EngineFact>();

  addClauses(clauses: IndexedClause[]): void {
    for (const c of clauses) this.clauses.set(c.id, c);
  }

  /** Records a tool's facts and returns their ids, for the model to pick from. */
  addFacts(facts: IdentifiedFact[]): string[] {
    for (const f of facts) this.facts.set(f.id, f.fact);
    return facts.map((f) => f.id);
  }
}

export interface ToolDeps {
  index: ClauseIndex;
  records: RecordSource;
  audits: AuditSource;
  planIssues: PlanIssuesSource;
  courses: CourseSource;
}

const SEARCH_LIMIT = 5;
/** What a record tool returns once the student has withdrawn consent: nothing from the record. */
export const CONSENT_WITHDRAWN = { error: 'The student has withdrawn consent: their record is not available.', factIds: [] } as const;

/**
 * The tools for one request. Without consent only the regulation search and the course catalogue
 * (UC-08 A1). With it, each record tool asks `stillConsented` again before it reads anything: a
 * student may withdraw consent while the model runs (J35), and then nothing of the record is read.
 */
export function advisorTools(deps: ToolDeps, userId: string, consented: boolean, evidence: TurnEvidence, stillConsented: () => Promise<boolean>): ChatTool<any>[] {
  const tool = <A>(name: string, description: string, schema: z.ZodType<A>, handler: (args: A) => Promise<unknown>): ChatTool<A> => ({ name, description, schema, handler });

  const tools: ChatTool<any>[] = [
    tool(
      'search_regulations',
      'Search the HCMUS training regulation (QĐ 1175/QĐ-KHTN) and the HCMUS student handbook 2024–2025 (scholarships, conduct scores, exams and re-marking, discipline, dormitory, tuition support, the academic calendar, offices) and return the best matching passages with their ids, labels, pages and exact Vietnamese text. Put the ids you want shown in "passageIds".',
      z.strictObject({ query: z.string().trim().min(1).max(200) }),
      async ({ query }) => {
        const clauses = deps.index.search(query, SEARCH_LIMIT).hits.map((h) => h.clause);
        evidence.addClauses(clauses);
        return clauses.map((c) => ({ id: c.id, label: c.label, document: c.documentShortName, place: placeOf(c), pages: c.pages, text: c.text }));
      },
    ),
    tool(
      'get_course',
      'Look up one course of the HCMUS catalogue by its exact code (for example CSC10001): name, credits and the curricula and requirement groups that include it. Put the "factIds" you want shown in "engineFacts".',
      z.strictObject({ code: z.string().trim().regex(/^[A-Za-z]{2,4}\d{3,5}$/, 'a course code such as CSC10001') }),
      async ({ code }) => {
        const course = await deps.courses.find(code.toUpperCase());
        // An unknown course gives no fact: nothing about it is shown (ADR 0015).
        if (!course) return { found: false, code: code.toUpperCase(), factIds: [] };
        return { found: true, course, factIds: evidence.addFacts(courseFacts(course)) };
      },
    ),
  ];
  if (!consented) return tools;
  return [
    ...tools,
    tool(
      'get_my_audit',
      "The signed-in student's own pseudonymous record (program, cohort, courses with credits, results, grades and terms) and the rule engine's degree audit. Takes no arguments: it always reads the signed-in student. Put the \"factIds\" you want shown in \"engineFacts\".",
      z.strictObject({}),
      async () => {
        if (!(await stillConsented())) return CONSENT_WITHDRAWN;
        const [record, audit] = await Promise.all([deps.records.recordFor(userId), deps.audits.auditFor(userId)]);
        return { record, audit, factIds: evidence.addFacts(auditFacts(record, audit)) };
      },
    ),
    tool(
      'get_my_plan_issues',
      "The rule engine's violations for the signed-in student's plans: credit caps, prerequisites, offering terms, uncovered requirements. Takes no arguments. Put the \"factIds\" you want shown in \"engineFacts\".",
      z.strictObject({}),
      async () => {
        if (!(await stillConsented())) return CONSENT_WITHDRAWN;
        const issues = await deps.planIssues.issuesFor(userId);
        return { issues, factIds: evidence.addFacts(planFacts(issues)) };
      },
    ),
  ];
}
