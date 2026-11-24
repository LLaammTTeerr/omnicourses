// The code of a program or of a cohort's curriculum, as F12 accepts it (ADR 0011, "Programs and
// cohorts as built"). The schema gives both columns a length (varchar(50)) and no format, so this
// is a structural rule only: capital letters and digits, in parts joined by single hyphens. It
// accepts every seeded code (APCS, CNTT-TCTA-KHMT, APCS2024, CNTT-TCTA-KHMT-2025). A program code is
// a path segment of the read API (/api/programs/:program/curricula/:cohort), so it holds no
// space, slash or other character a URL would need to escape.
export const ADMIN_CODE_PATTERN = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/;
export const ADMIN_CODE_MAX_LENGTH = 50;
export const ADMIN_CODE_MESSAGE = 'code must be letters A-Z and digits, in parts joined by single hyphens (for example ZZ-PROG-2024)';

export const isAdminCode = (code: string): boolean => code.length <= ADMIN_CODE_MAX_LENGTH && ADMIN_CODE_PATTERN.test(code);

/**
 * For a code an administrator types: trims and upper-cases, as a course code is (UC-11 step 5).
 * It decides nothing: the validators that follow accept or refuse the result. Two spellings of
 * one code are therefore one code, and the second is a duplicate.
 */
export const canonicalAdminCode = (input: unknown): unknown => (typeof input === 'string' ? input.trim().toUpperCase() : input);
