// A blank, non-numeric, zero or negative value falls back to the default:
// '' would otherwise read as 0 and a typo as NaN, and both silently change
// behaviour (a 0 ms timeout, a cap that never triggers, a 0-day grace period).
export function positiveInt(value: string | undefined, fallback: number): number {
  const n = Number(value?.trim() || NaN);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}
