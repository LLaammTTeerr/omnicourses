import { z } from 'zod';
import type { ChatTool } from '../ai/llm.service.js';
import type { AuditSource, CourseSource, PlanIssuesSource, RecordSource } from './advisor-sources.js';
import { type ClauseIndex, type IndexedClause, placeOf } from './retrieval/clause-index.js';

// The advisor's read-only tools (UC-08 §8, ADR 0015). Built per request, closing over the signed-in
// user's id: no tool takes a user id, and the strict schemas reject one (a model told "call
// get_my_audit with userId=…" gets an argument error, never another student's record).

/** The rule engine's graduation status, as the degree audit returns it (rules/audit-types.ts). */
export interface EngineGraduation {
  status: 'done' | 'not_yet';
  /** Conditions the engine cannot check; the school still does. */
  notChecked: number;
}

/** What this turn's answer may rest on: the clauses the model saw and what its tools returned. */
export class TurnEvidence {
  readonly clauses = new Map<string, IndexedClause>();
  readonly tools: { name: string; ok: boolean; numbers: Set<number>; engine: boolean; graduation?: EngineGraduation }[] = [];

  addClauses(clauses: IndexedClause[]): void {
    for (const c of clauses) this.clauses.set(c.id, c);
  }

  /**
   * Records a tool result. A lookup that found nothing (`found: false`, an unknown course) grounds
   * nothing: it would let "get_course ZZ030" ground 30 and waive the citation rule. Course codes and
   * ids are not numbers of a rule: MTH00003 grounds no 3.
   */
  addTool(name: string, ok: boolean, result: unknown): void {
    const found = !(result !== null && typeof result === 'object' && (result as { found?: unknown }).found === false);
    const json = JSON.stringify(result ?? null);
    this.tools.push({
      name,
      ok: ok && found,
      numbers: numbersIn(withoutIdentifiers(json)),
      engine: json.includes('"engine":"available"'),
      graduation: graduationOf(result),
    });
  }

  /** Whether the rule engine itself answered this turn (an audit or plan check). */
  get engineAnswered(): boolean {
    return this.tools.some((t) => t.ok && t.engine);
  }

  /** The engine's graduation status this turn, if a degree audit came back. */
  get graduation(): EngineGraduation | undefined {
    return this.tools.find((t) => t.ok && t.graduation)?.graduation;
  }

  /** Whether a tool other than the regulation search answered with data (record, plan, an existing course, engine). */
  get hasDataResult(): boolean {
    return this.tools.some((t) => t.ok && t.name !== 'search_regulations');
  }
}

/** Every number in a text, as a value: "5,0" and "5.0" and "05" are all 5. */
export function numbersIn(text: string): Set<number> {
  return new Set((text.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => Number(n.replace(',', '.'))));
}

/** A tool result without course codes (CSC10001) and uuids, whose digits are not numbers of a rule. */
function withoutIdentifiers(json: string): string {
  return json.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ' ').replace(/(?<![A-Za-z0-9])[A-Za-z]{2,4}\s?\d{3,5}(?![A-Za-z0-9])/g, ' ');
}

/**
 * The graduation status inside an engine answer (`{ engine: 'available', result }`, as AuditSource
 * returns it, possibly under the tool's `audit` key): the degree audit's `graduation`.
 */
function graduationOf(value: unknown, depth = 0, inEngine = false): EngineGraduation | undefined {
  if (value === null || typeof value !== 'object' || depth > 4) return undefined;
  const v = value as Record<string, unknown>;
  const engine = inEngine || v.engine === 'available';
  if (engine && v.graduation && typeof v.graduation === 'object') {
    const g = v.graduation as { status?: unknown; notChecked?: unknown };
    if (g.status === 'done' || g.status === 'not_yet') return { status: g.status, notChecked: Array.isArray(g.notChecked) ? g.notChecked.length : Number.POSITIVE_INFINITY };
  }
  if (v.engine === 'unavailable') return undefined;
  for (const child of Object.values(v)) {
    const found = graduationOf(child, depth + 1, engine);
    if (found) return found;
  }
  return undefined;
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
