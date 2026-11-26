import { HttpError } from '../api.js';
import { PERMISSION_KINDS, type AffectedCurriculum, type ImportRowError, type PermissionKind } from './api.js';

// What a failed administration call means, read from the API's answer (ADR 0011, "Validation, errors and
// removal"). The stable `code` of the error body decides, not the HTTP status: a prerequisite cycle is a 400 and a
// referenced item a 409, and both are refusals that saved nothing. Nothing here judges a value itself.

/** The 409 reasons that need no further step from the screen. */
export const CONFLICT_CODES = ['duplicate_name', 'duplicate_code', 'duplicate_cohort', 'referenced_item', 'last_access_manager', 'recipient_deletion_pending'] as const;
export type ConflictCode = (typeof CONFLICT_CODES)[number];

export type Failure =
  /** 401: the session ended. App.vue takes the user to sign in; the screen says nothing. */
  | { kind: 'signed_out' }
  /** 400 validation_failed: the API's messages, each starting with the field it names. */
  | { kind: 'validation'; details: string[] }
  /** 400 validation_failed for a CSV import file: where the file is wrong, by record. */
  | { kind: 'file'; details: string[]; errors: ImportRowError[] }
  /** 409 impact_changed of an import confirmation: the file, the saved data or the links changed since the preview. */
  | { kind: 'review_changed' }
  /** 413: the file or the request is over a size or record limit. */
  | { kind: 'too_large' }
  /** 415: the request was compressed, which the import routes refuse. */
  | { kind: 'compressed' }
  /** 400 prerequisite_cycle: from the edited course back to it. */
  | { kind: 'cycle'; cycle: string[] }
  /** 403 permission_required: the grant the caller lacks, or null when the answer does not name one. */
  | { kind: 'permission'; permission: PermissionKind | null }
  /** 403 account_deletion_pending: the caller's own account. */
  | { kind: 'deletion_pending' }
  | { kind: 'not_found' }
  | { kind: 'conflict'; code: ConflictCode; references: string[] }
  /** 409 impact_confirmation_required, or impact_changed (`changed`): the curricula a shared course change reaches. */
  | { kind: 'impact'; changed: boolean; affected: AffectedCurriculum[]; reviewVersion: string }
  /** Another refusal: the API answered, and saved nothing. */
  | { kind: 'refused'; status: number; code: string | null; details: string[] }
  /** No answer (offline, timeout) or a server error: the screen does not know whether the write was saved. */
  | { kind: 'no_answer' };

const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []);

function affected(value: unknown): AffectedCurriculum[] | null {
  if (!Array.isArray(value)) return null;
  const rows: AffectedCurriculum[] = [];
  for (const item of value as Partial<AffectedCurriculum>[]) {
    if (typeof item?.curriculumId !== 'string' || typeof item.curriculumCode !== 'string' || typeof item.programCode !== 'string' || typeof item.cohortYear !== 'number') return null;
    rows.push({ curriculumId: item.curriculumId, curriculumCode: item.curriculumCode, programCode: item.programCode, cohortYear: item.cohortYear });
  }
  return rows;
}

function rowErrors(value: unknown[]): ImportRowError[] {
  return value
    .filter((item): item is ImportRowError => typeof (item as ImportRowError)?.record === 'number' && typeof (item as ImportRowError).message === 'string')
    .map((item) => ({ record: item.record, field: typeof item.field === 'string' ? item.field : null, message: item.message }));
}

/** Reads a failed call. Anything that is not an answer from the API is `no_answer`. */
export function readFailure(error: unknown): Failure {
  if (!(error instanceof HttpError)) return { kind: 'no_answer' };
  const { status, code, details } = error;
  const body = error.body ?? {};
  if (status === 401) return { kind: 'signed_out' };
  // A gateway or the API itself failed: a write may or may not have been committed.
  if (status >= 500) return { kind: 'no_answer' };
  if (code === 'validation_failed' && Array.isArray(body.errors)) return { kind: 'file', details, errors: rowErrors(body.errors) };
  if (code === 'validation_failed') return { kind: 'validation', details };
  if (code === 'prerequisite_cycle') return { kind: 'cycle', cycle: strings(body.cycle) };
  if (code === 'permission_required') {
    const permission = (PERMISSION_KINDS as readonly unknown[]).includes(body.permission) ? (body.permission as PermissionKind) : null;
    return { kind: 'permission', permission };
  }
  if (code === 'account_deletion_pending') return { kind: 'deletion_pending' };
  if (code === 'impact_confirmation_required' || code === 'impact_changed') {
    const rows = affected(body.affectedCurricula);
    if (rows && typeof body.reviewVersion === 'string') return { kind: 'impact', changed: code === 'impact_changed', affected: rows, reviewVersion: body.reviewVersion };
    // An import confirmation: the 409 carries no new review, the file is previewed again.
    if (code === 'impact_changed') return { kind: 'review_changed' };
  }
  // A 413 may come from the body parser, before the route, with no code of its own.
  if (status === 413) return { kind: 'too_large' };
  if (status === 415 || code === 'unsupported_content_encoding') return { kind: 'compressed' };
  if ((CONFLICT_CODES as readonly (string | null)[]).includes(code)) return { kind: 'conflict', code: code as ConflictCode, references: strings(body.references) };
  // The read routes answer a plain 404 without a code.
  if (code === 'not_found' || (status === 404 && code === null)) return { kind: 'not_found' };
  // A 400 from a route outside F12's strict bodies still lists what it refused.
  if (status === 400 && code === null) return { kind: 'validation', details };
  return { kind: 'refused', status, code, details };
}

/**
 * The API's validation messages by the field each one names at its start ("credits must not be less than 1",
 * "prerequisites: ZZ101 not a course of this curriculum"). A message that names none of `fields`, such as an
 * unknown property, is in `other`. The messages are the API's English text: it sends no code per field.
 */
export function byField<F extends string>(details: readonly string[], fields: readonly F[]): { fields: Partial<Record<F, string[]>>; other: string[] } {
  const found: Partial<Record<F, string[]>> = {};
  const other: string[] = [];
  for (const detail of details) {
    const field = fields.find((name) => detail.startsWith(name) && !/^[A-Za-z0-9_]/.test(detail.slice(name.length)));
    if (field) (found[field] ??= []).push(detail);
    else other.push(detail);
  }
  return { fields: found, other };
}

/** What still needs an item the API refused to remove (409 referenced_item), read from its English sentence. */
export type Reference =
  | { kind: 'requires'; course: string; needs: string }
  | { kind: 'own_prerequisites'; course: string }
  | { kind: 'own_terms'; course: string }
  | { kind: 'links'; course: string }
  | { kind: 'linked_in'; curriculum: string }
  | { kind: 'count'; what: 'prerequisite_lists' | 'required_by' | 'offering_terms' | 'transcript_rows' | 'plans'; count: number }
  /** Saved plans whose slots name a requirement group: count is the number of distinct plans, or null when the API gave none. */
  | { kind: 'group_plans'; count: number | null }
  /** A sentence this screen does not know: shown as the API wrote it. */
  | { kind: 'other'; text: string };

const COUNTED: Record<string, Extract<Reference, { kind: 'count' }>['what']> = {
  'curricula record its prerequisites': 'prerequisite_lists',
  'courses require it': 'required_by',
  'offering-term rows name it': 'offering_terms',
  'transcript rows name it': 'transcript_rows',
  'saved plans place it': 'plans',
};

/** The sentences are those of curriculum-admin.service.ts and catalog-admin.service.ts. */
export function readReference(text: string): Reference {
  let match = /^(\S+) requires (\S+)$/.exec(text);
  if (match) return { kind: 'requires', course: match[1]!, needs: match[2]! };
  match = /^prerequisites of (\S+) are recorded$/.exec(text);
  if (match) return { kind: 'own_prerequisites', course: match[1]! };
  match = /^offering terms of (\S+) are recorded$/.exec(text);
  if (match) return { kind: 'own_terms', course: match[1]! };
  match = /^links (\S+)$/.exec(text);
  if (match) return { kind: 'links', course: match[1]! };
  match = /^linked in (.+)$/.exec(text);
  if (match) return { kind: 'linked_in', curriculum: match[1]! };
  match = /^(?:(\d+) )?saved plans use it$/.exec(text);
  if (match) return { kind: 'group_plans', count: match[1] === undefined ? null : Number(match[1]) };
  match = /^(\d+) (.+)$/.exec(text);
  if (match && Object.hasOwn(COUNTED, match[2]!)) return { kind: 'count', what: COUNTED[match[2]!]!, count: Number(match[1]) };
  return { kind: 'other', text };
}
