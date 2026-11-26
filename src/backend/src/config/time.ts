export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

const VIETNAM_OFFSET_MS = 7 * HOUR_MS;

export function vietnamDate(now: Date): string {
  return new Date(now.getTime() + VIETNAM_OFFSET_MS).toISOString().slice(0, 10);
}

export function msUntilVietnamMidnight(now: Date): number {
  return DAY_MS - ((now.getTime() + VIETNAM_OFFSET_MS) % DAY_MS);
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}
