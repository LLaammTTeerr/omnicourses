import { byField } from '../api.js';
import { readReference, type Failure } from './errors.js';
import type { AdminText } from './messages.js';
import type { Problem } from './write.js';

// A write that is not known to be saved, in the words of the language on screen (UC-11 A3, A4, A7).

export interface ProblemView<F extends string = string> {
  /** A stable name for test scripts: the API's reason, or how a lost answer ended. */
  code: string;
  /** `warn`: the outcome is not a refusal, the administrator has to look at the saved data. */
  tone: 'bad' | 'warn';
  text: string;
  /** Below the text: what still uses a referenced item, or the API's messages that name no field of the form. */
  items: string[];
  /** `items` are the API's own English messages, shown as it wrote them. */
  serverText: boolean;
  /** The API's messages by the field they name, to show under each field. */
  fields: Partial<Record<F, string[]>>;
  /** The saved data could not be reloaded: offer to reload it. */
  reload: boolean;
}

function refusal<F extends string>(failure: Failure, m: AdminText, fields: readonly F[]): Omit<ProblemView<F>, 'tone' | 'reload' | 'serverText'> & { serverText?: true } {
  switch (failure.kind) {
    case 'validation': {
      const split = byField(failure.details, fields);
      return { code: 'validation_failed', text: m.problem.validation, items: split.other, fields: split.fields, serverText: true };
    }
    case 'file':
      return { code: 'validation_failed', text: m.problem.file, items: failure.errors.map((error) => m.importRowError(error.record, error.field, error.message)), fields: {}, serverText: true };
    case 'review_changed':
      return { code: 'impact_changed', text: m.problem.reviewChanged, items: [], fields: {} };
    case 'too_large':
      return { code: 'payload_too_large', text: m.problem.tooLarge, items: [], fields: {} };
    case 'compressed':
      return { code: 'unsupported_content_encoding', text: m.problem.compressed, items: [], fields: {} };
    case 'cycle':
      return { code: 'prerequisite_cycle', text: m.problem.cycle(failure.cycle), items: [], fields: {} };
    case 'permission':
      return { code: 'permission_required', text: m.problem.permission(failure.permission && m.permissions[failure.permission]), items: [], fields: {} };
    case 'deletion_pending':
      return { code: 'account_deletion_pending', text: m.problem.deletionPending, items: [], fields: {} };
    case 'not_found':
      return { code: 'not_found', text: m.problem.notFound, items: [], fields: {} };
    case 'conflict':
      return { code: failure.code, text: m.problem.conflict[failure.code], items: failure.references.map((text) => m.reference(readReference(text))), fields: {} };
    case 'impact':
      return { code: failure.changed ? 'impact_changed' : 'impact_confirmation_required', text: m.problem.impact, items: [], fields: {} };
    case 'refused':
      return { code: failure.code ?? `http_${failure.status}`, text: failure.status === 429 ? m.problem.rateLimited : m.problem.refused(failure.status), items: failure.details, fields: {}, serverText: true };
    case 'signed_out':
    case 'no_answer':
      return { code: failure.kind, text: m.problem.unknown, items: [], fields: {} };
  }
}

export const fieldInvalid = <F extends string>(problem: ProblemView<F> | null, field: F): 'true' | undefined => (problem?.fields[field] ? 'true' : undefined);

export function fieldDescription<F extends string>(problem: ProblemView<F> | null, prefix: string, field: F, hint?: string | false | null): string | undefined {
  return [hint, problem?.fields[field] && `${prefix}-${field}-error`].filter(Boolean).join(' ') || undefined;
}

/** `fields`: the fields of the form the write came from; the API's validation messages are sorted by them. */
export function describeProblem<F extends string = never>(problem: Problem, m: AdminText, fields: readonly F[] = []): ProblemView<F> {
  if (problem.outcome === 'refused') return { serverText: false, ...refusal(problem.failure, m, fields), tone: 'bad', reload: false };
  if (problem.outcome === 'not_applied') return { code: 'not_applied', tone: 'warn', text: m.problem.notApplied, items: [], serverText: false, fields: {}, reload: false };
  return { code: 'unknown', tone: 'warn', text: m.problem.unknown, items: [], serverText: false, fields: {}, reload: true };
}
