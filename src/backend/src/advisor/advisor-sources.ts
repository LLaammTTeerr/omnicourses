import type { Term } from '../terms/term.js';

// What the advisor's tools read, as small ports (ADR 0015). The advisor module wires what is on main
// (curriculum, onboarding, transcript); the rule engine (PR #72) and plans (PR #71) plug in by
// providing AuditSource and PlanIssuesSource, with no change to the tools, the prompt or the guard.

/** The pseudonymous record ADR 0003 allows F8 to send after consent: never a name, email or student ID. */
export interface AdvisorRecord {
  program: string | null;
  cohort: number | null;
  courses: { code: string; credits: number; result: string; grade: number | null; term: Term }[];
}

export abstract class RecordSource {
  abstract recordFor(userId: string): Promise<AdvisorRecord>;
}

/** The rule engine's answer, or why there is none. The model explains it; it never computes it. */
export type EngineResult<T> = { engine: 'available'; result: T } | { engine: 'unavailable'; reason: string };

export abstract class AuditSource {
  /** The degree audit of the signed-in student's record against their curriculum. */
  abstract auditFor(userId: string): Promise<EngineResult<unknown>>;
}

export abstract class PlanIssuesSource {
  /** The rule engine's violations for the student's plans (credit caps, prerequisites, offering terms). */
  abstract issuesFor(userId: string): Promise<EngineResult<unknown>>;
}

export abstract class CourseSource {
  /** A catalogue course by exact code, or null. Catalogue data, not the student's record. */
  abstract find(code: string): Promise<unknown | null>;
}

const NOT_CONNECTED = (what: string): EngineResult<never> => ({
  engine: 'unavailable',
  reason: `The rule engine's ${what} is not connected to the advisor yet, so this cannot be checked for the student.`,
});

/** Until the rule engine merges (PR #72): every audit question is "cannot confirm" (UC-08 A7). */
export class UnavailableAuditSource extends AuditSource {
  async auditFor(): Promise<EngineResult<unknown>> {
    return NOT_CONNECTED('degree audit');
  }
}

/** Until plans and the rule engine merge (PR #71, #72). */
export class UnavailablePlanIssuesSource extends PlanIssuesSource {
  async issuesFor(): Promise<EngineResult<unknown>> {
    return NOT_CONNECTED('plan check');
  }
}
