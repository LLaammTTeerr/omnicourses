export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

// Vietnam is UTC+7 all year: no daylight saving.
const VIETNAM_OFFSET_MS = 7 * HOUR_MS;

/** The date in Vietnam at this instant, as YYYY-MM-DD. Guides, onboarding and notifications count days by it. */
export function vietnamDate(now: Date): string {
  return new Date(now.getTime() + VIETNAM_OFFSET_MS).toISOString().slice(0, 10);
}

/** How long until the next day starts in Vietnam (00:00 UTC+7); a full day at exactly midnight. */
export function msUntilVietnamMidnight(now: Date): number {
  return DAY_MS - ((now.getTime() + VIETNAM_OFFSET_MS) % DAY_MS);
}

/** A YYYY-MM-DD date plus whole days. */
export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}
