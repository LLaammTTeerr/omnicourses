export const COURSE_CODE_PATTERN = /^[A-Z0-9]{2,20}$/;

export const isCourseCode = (code: string): boolean => COURSE_CODE_PATTERN.test(code);

export function canonicalCourseCode(input: string): string | null {
  const code = input.trim().toUpperCase();
  return isCourseCode(code) ? code : null;
}

export function normalizePrintedCode(printed: string): string {
  return printed.trim().toUpperCase().replace(/[\s\-‐-―]/g, '');
}
