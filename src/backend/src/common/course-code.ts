// The one course-code format of the catalog and the transcript (ADR 0007). The
// CHECKs in migrations 1792912952302 and 1793159431000 repeat it in SQL.
export const COURSE_CODE_PATTERN = /^[A-Z0-9]{2,20}$/;

/** Strict: the code as given, or refused. */
export const isCourseCode = (code: string): boolean => COURSE_CODE_PATTERN.test(code);

/**
 * For a code an administrator types (UC-11 step 5, ADR 0011): trims and upper-cases, then
 * validates. Null when the result is still not a code; nothing else is dropped or guessed.
 */
export function canonicalCourseCode(input: string): string | null {
  const code = canonicalForm(input);
  return isCourseCode(code) ? code : null;
}

/** Trimmed and upper-cased, valid or not: the form canonicalCourseCode checks. */
export const canonicalForm = (input: string): string => input.trim().toUpperCase();

/**
 * Lenient, for transcribing a printed code: trims, upper-cases and drops spaces
 * and dashes. A code it cannot make valid (a dot) stays invalid, never guessed.
 */
export function normalizePrintedCode(printed: string): string {
  return canonicalForm(printed).replace(/[\s\-‐-―]/g, '');
}
