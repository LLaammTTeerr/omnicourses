export const COURSE_CODE_LENGTH = { min: 2, max: 20 } as const;
export const COURSE_CODE_PATTERN = new RegExp(`^[A-Z0-9]{${COURSE_CODE_LENGTH.min},${COURSE_CODE_LENGTH.max}}$`);

export const isCourseCode = (code: string): boolean => COURSE_CODE_PATTERN.test(code);
