import { PASSWORD_MIN_LENGTH } from './api.js';

// The password meter of the sign-up form (UI prototypes). A hint for the student, not a rule: the API checks only
// the length (ADR 0002), and so does the form.

export type Strength = 'short' | 'weak' | 'fair' | 'strong' | 'very-strong';

/** One point each for the minimum length, four more characters, a digit, and a character that is not a letter or digit. */
export function passwordStrength(password: string): Strength {
  if (password.length < PASSWORD_MIN_LENGTH) return 'short';
  const score = 1 + Number(password.length >= PASSWORD_MIN_LENGTH + 4) + Number(/\d/.test(password)) + Number(/[^\p{L}\d]/u.test(password));
  return (['weak', 'weak', 'fair', 'strong', 'very-strong'] as const)[score];
}

/** How full the meter is, from 0 to 1. */
export function strengthFill(password: string): number {
  const steps: Record<Strength, number> = { short: 0, weak: 1, fair: 2, strong: 3, 'very-strong': 4 };
  if (password.length === 0) return 0;
  return Math.max(steps[passwordStrength(password)], 0.5) / 4;
}
