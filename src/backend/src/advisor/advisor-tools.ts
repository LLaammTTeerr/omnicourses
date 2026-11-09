import { z } from 'zod';
import type { ChatTool } from '../ai/llm.service.js';
import type { AuditSource, CourseSource, PlanIssuesSource, RecordSource } from './advisor-sources.js';
import { type ClauseIndex, type IndexedClause, placeOf } from './retrieval/clause-index.js';

// The advisor's read-only tools (UC-08 §8, ADR 0015). Built per request, closing over the signed-in
// user's id: no tool takes a user id, and the strict schemas reject one (a model told "call
// get_my_audit with userId=…" gets an argument error, never another student's record).

/** What this turn's answer may rest on: the clauses the model saw and what its tools returned. */
export class TurnEvidence {
  readonly clauses = new Map<string, IndexedClause>();
  readonly tools: { name: string; ok: boolean; numbers: Set<number>; engine: boolean }[] = [];

  addClauses(clauses: IndexedClause[]): void {
    for (const c of clauses) this.clauses.set(c.id, c);
  }

  addTool(name: string, ok: boolean, result: unknown): void {
    const json = JSON.stringify(result ?? null);
    this.tools.push({ name, ok, numbers: numbersIn(json), engine: json.includes('"engine":"available"') });
  }

  /** Whether the rule engine itself answered this turn (an audit or plan check): only then may the answer state the student's standing. */
  get engineAnswered(): boolean {
    return this.tools.some((t) => t.ok && t.engine);
  }

  /** Whether a tool other than the regulation search answered (record, plan, course or engine data). */
  get hasDataResult(): boolean {
    return this.tools.some((t) => t.ok && t.name !== 'search_regulations');
  }
}

/** Every number in a text, as a value: "5,0" and "5.0" and "05" are all 5. */
export function numbersIn(text: string): Set<number> {
  return new Set((text.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => Number(n.replace(',', '.'))));
}

export interface ToolDeps {
  index: ClauseIndex;
  records: RecordSource;
  audits: AuditSource;
  planIssues: PlanIssuesSource;
  courses: CourseSource;
}

const SEARCH_LIMIT = 5;

/** The tools for one request. Without consent only the regulation search and the course catalogue (UC-08 A1). */
export function advisorTools(deps: ToolDeps, userId: string, consented: boolean, evidence: TurnEvidence): ChatTool<any>[] {
  const tool = <A>(name: string, description: string, schema: z.ZodType<A>, run: (args: A) => Promise<unknown>): ChatTool<A> => ({
    name,
    description,
    schema,
    handler: async (args: A) => {
      try {
        const result = await run(args);
        evidence.addTool(name, true, result);
        return result;
      } catch (error) {
        evidence.addTool(name, false, null);
        throw error;
      }
    },
  });

  const tools: ChatTool<any>[] = [
    tool(
      'search_regulations',
      'Search the HCMUS training regulation (QĐ 1175/QĐ-KHTN) and the HCMUS student handbook 2024–2025 (scholarships, conduct scores, exams and re-marking, discipline, dormitory, tuition support, the academic calendar, offices) and return the best matching passages with their ids, labels, pages and exact Vietnamese text. Cite results as [[id]].',
      z.strictObject({ query: z.string().trim().min(1).max(200) }),
      async ({ query }) => {
        const clauses = deps.index.search(query, SEARCH_LIMIT).hits.map((h) => h.clause);
        evidence.addClauses(clauses);
        return clauses.map((c) => ({ id: c.id, label: c.label, document: c.documentShortName, place: placeOf(c), pages: c.pages, text: c.text }));
      },
    ),
    tool(
      'get_course',
      'Look up one course of the HCMUS catalogue by its exact code (for example CSC10001): name, credits and the curricula and requirement groups that include it.',
      z.strictObject({ code: z.string().trim().regex(/^[A-Za-z]{2,4}\d{3,5}$/, 'a course code such as CSC10001') }),
      async ({ code }) => (await deps.courses.find(code.toUpperCase())) ?? { found: false, code: code.toUpperCase() },
    ),
  ];
  if (!consented) return tools;
  return [
    ...tools,
    tool(
      'get_my_audit',
      "The signed-in student's own pseudonymous record (program, cohort, courses with credits, results, grades and terms) and the rule engine's degree audit. Takes no arguments: it always reads the signed-in student.",
      z.strictObject({}),
      async () => {
        const [record, audit] = await Promise.all([deps.records.recordFor(userId), deps.audits.auditFor(userId)]);
        return { record, audit };
      },
    ),
    tool(
      'get_my_plan_issues',
      "The rule engine's violations for the signed-in student's plans: credit caps, prerequisites, offering terms, uncovered requirements. Takes no arguments.",
      z.strictObject({}),
      async () => deps.planIssues.issuesFor(userId),
    ),
  ];
}
