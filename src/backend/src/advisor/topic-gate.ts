import type { ClauseHit, ClauseIndex } from './retrieval/clause-index.js';
import { words } from './retrieval/text.js';

// The topic gate (ADR 0016): a deterministic check before any model call. A question that matches
// no clause well and is not about the student's own record, plan or a course gets a fixed reply,
// costs nothing and does not count toward the daily cap. It saves money; it is not the security
// boundary (an attack can always borrow regulation words): the prompt and the output guard are.

/**
 * Relevance is coverage × the best BM25 score: coverage says how much of the question the clauses
 * explain, the score how strongly. The scale grows with the corpus (IDF), so the threshold is
 * re-measured whenever a source is added. With QĐ 1175 and the 2024–2025 handbook, on the labelled
 * set (labelled-questions.ts) every regulation and handbook question scores at least 11.5, and every
 * off-topic question at most 9.7 but one: "Dịch câu này sang tiếng Anh…" (11.2), whose words (dịch
 * vụ, tiếng Anh, Việt Nam) fill the handbook's office and faculty pages. The threshold sits low in
 * the gap, nearer the off-topic side: a refused real question costs the student more than one
 * off-topic call does, which the prompt and the guard answer with the fixed off-topic reply.
 */
export const RELEVANCE_THRESHOLD = 10.4;

/** A follow-up ("and in summer?") is gated together with the question before it, if it is this short. */
export const FOLLOW_UP_MAX_LENGTH = 120;

const SELF = new Set(['toi', 'minh', 'em', 'to', 'tao', 'i', 'me', 'my', 'mine', 'im', 'ive']);
// Study words of Vietnamese, folded, matched as phrases on the folded words.
const RECORD_PHRASES = /\b(diem|tin chi|mon|hoc phan|hoc ky|ky (nay|sau|toi|truoc|he)|tot nghiep|ra truong|lo trinh|ke hoach|chuong trinh|bang diem|tich luy|tien quyet|hoc lai|cai thien|khoa luan|thuc tap|nganh|khoa hoc)\b/;
const RECORD_WORDS = new Set([
  'gpa', 'dtb',
  // English
  'grade', 'grades', 'gpa', 'credit', 'credits', 'course', 'courses', 'class', 'classes', 'subject', 'subjects', 'term', 'terms', 'semester', 'semesters',
  'graduate', 'graduation', 'graduating', 'plan', 'plans', 'roadmap', 'transcript', 'record', 'audit', 'retake', 'prerequisite', 'prerequisites',
  'requirement', 'requirements', 'program', 'programme', 'major', 'cohort', 'thesis', 'internship', 'schedule',
]);
/**
 * An HCMUS course code: letters then digits, e.g. CSC10001, CS163, MTH00003, csc10001. A space is
 * allowed only in capitals ("CS 163"): "of 500" and "in 2024" are words and numbers, not codes.
 */
export const COURSE_CODE = /(?<![A-Za-z0-9])(?:[A-Za-z]{2,4}\d{3,5}|[A-Z]{2,4}\s\d{3,5})(?![A-Za-z0-9])/;

export type GateDecision =
  /** Call the model. */
  | 'answer'
  /** Fixed refusal: not about studies. */
  | 'off_topic'
  /** Fixed reply: about the student's own record, which needs consent first (UC-08 A1). */
  | 'needs_consent';

export interface GateResult {
  decision: GateDecision;
  regulationMatch: boolean;
  recordIntent: boolean;
  courseIntent: boolean;
  relevance: number;
  /** The clauses retrieved for the question, given to the model as reference text. */
  hits: ClauseHit[];
}

/** Whether a question is about the student's own record or plan: a first-person word and a study word. */
export function hasRecordIntent(question: string): boolean {
  const ws = words(question);
  return ws.some((w) => SELF.has(w)) && (ws.some((w) => RECORD_WORDS.has(w)) || RECORD_PHRASES.test(ws.join(' ')));
}

export function gate(index: ClauseIndex, userTurns: string[], consented: boolean): GateResult {
  const last = userTurns.at(-1) ?? '';
  const previous = userTurns.at(-2);
  let search = index.search(last, 5);
  let relevance = search.coverage * (search.hits[0]?.score ?? 0);
  if (relevance < RELEVANCE_THRESHOLD && previous !== undefined && last.length <= FOLLOW_UP_MAX_LENGTH) {
    const joined = index.search(`${previous}\n${last}`, 5);
    const joinedRelevance = joined.coverage * (joined.hits[0]?.score ?? 0);
    if (joinedRelevance >= RELEVANCE_THRESHOLD) {
      search = joined;
      relevance = joinedRelevance;
    }
  }
  const regulationMatch = relevance >= RELEVANCE_THRESHOLD;
  const recordIntent = hasRecordIntent(last);
  const courseIntent = COURSE_CODE.test(last);
  let decision: GateDecision = 'answer';
  if (!regulationMatch && !recordIntent && !courseIntent) decision = 'off_topic';
  else if (!regulationMatch && !courseIntent && recordIntent && !consented) decision = 'needs_consent';
  return { decision, regulationMatch, recordIntent, courseIntent, relevance, hits: regulationMatch ? search.hits : search.hits.slice(0, 3) };
}
