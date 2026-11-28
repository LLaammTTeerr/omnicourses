import { failureKind, HttpError } from '../api.js';
import type { AffectedCurriculum, ImportRowError } from './api.js';
import { PERMISSION_KINDS, type PermissionKind } from './grants.js';

const CONFLICT_CODES = ['duplicate_name', 'duplicate_code', 'duplicate_cohort', 'referenced_item', 'last_access_manager', 'recipient_deletion_pending'] as const;
export type ConflictCode = (typeof CONFLICT_CODES)[number];

export type Failure =
  | { kind: 'signed_out' }
  | { kind: 'validation'; details: string[] }
  | { kind: 'file'; details: string[]; errors: ImportRowError[] }
  | { kind: 'review_changed' }
  | { kind: 'too_large' }
  | { kind: 'compressed' }
  | { kind: 'cycle'; cycle: string[] }
  | { kind: 'permission'; permission: PermissionKind | null }
  | { kind: 'deletion_pending' }
  | { kind: 'not_found' }
  | { kind: 'conflict'; code: ConflictCode; references: string[] }
  | { kind: 'impact'; changed: boolean; affected: AffectedCurriculum[]; reviewVersion: string }
  | { kind: 'refused'; status: number; code: string | null; details: string[] }
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

export function readFailure(error: unknown): Failure {
  const kind = failureKind(error);
  if (kind === 'unauthorized') return { kind: 'signed_out' };
  if (kind === 'server_error' || kind === 'timed_out' || kind === 'unreachable') return { kind: 'no_answer' };
  const { status, code, details } = error as HttpError;
  const body = (error as HttpError).body ?? {};
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
    if (code === 'impact_changed') return { kind: 'review_changed' };
  }
  if (status === 413) return { kind: 'too_large' };
  if (status === 415 || code === 'unsupported_content_encoding') return { kind: 'compressed' };
  if ((CONFLICT_CODES as readonly (string | null)[]).includes(code)) return { kind: 'conflict', code: code as ConflictCode, references: strings(body.references) };
  if (code === 'not_found' || (kind === 'not_found' && code === null)) return { kind: 'not_found' };
  if (kind === 'invalid' && code === null) return { kind: 'validation', details };
  return { kind: 'refused', status, code, details };
}

export type Reference =
  | { kind: 'requires'; course: string; needs: string }
  | { kind: 'own_prerequisites'; course: string }
  | { kind: 'own_terms'; course: string }
  | { kind: 'links'; course: string }
  | { kind: 'linked_in'; curriculum: string }
  | { kind: 'count'; what: 'prerequisite_lists' | 'required_by' | 'offering_terms' | 'transcript_rows' | 'plans'; count: number }
  | { kind: 'group_plans'; count: number | null }
  | { kind: 'other'; text: string };

const COUNTED: Record<string, Extract<Reference, { kind: 'count' }>['what']> = {
  'curricula record its prerequisites': 'prerequisite_lists',
  'courses require it': 'required_by',
  'offering-term rows name it': 'offering_terms',
  'transcript rows name it': 'transcript_rows',
  'saved plans place it': 'plans',
};

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
