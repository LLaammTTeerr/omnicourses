import { PASSWORD_MIN_LENGTH } from './api.js';

export type Strength = 'short' | 'weak' | 'fair' | 'strong' | 'very-strong';

export function passwordStrength(password: string): Strength {
  if (password.length < PASSWORD_MIN_LENGTH) return 'short';
  const score = 1 + Number(password.length >= PASSWORD_MIN_LENGTH + 4) + Number(/\d/.test(password)) + Number(/[^\p{L}\d]/u.test(password));
  return (['weak', 'weak', 'fair', 'strong', 'very-strong'] as const)[score];
}

export function strengthFill(password: string): number {
  const steps: Record<Strength, number> = { short: 0, weak: 1, fair: 2, strong: 3, 'very-strong': 4 };
  if (password.length === 0) return 0;
  return Math.max(steps[passwordStrength(password)], 0.5) / 4;
}
