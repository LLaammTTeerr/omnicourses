export const DAY_MS = 86_400_000;

// Vietnam is UTC+7 all year: no daylight saving.
const VIETNAM_OFFSET_MS = 7 * 3_600_000;

/** The date in Vietnam at this instant, as YYYY-MM-DD. Guides and onboarding count days by it. */
export function vietnamDate(now: Date): string {
  return new Date(now.getTime() + VIETNAM_OFFSET_MS).toISOString().slice(0, 10);
}
