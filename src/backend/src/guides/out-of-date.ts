// UC-10 A5: a guide is out of date when more than OUT_OF_DATE_MONTHS calendar months have
// passed since a team member last checked it on the portal. Proposed in UC-10, to be
// confirmed by Lâm (B1 test cases §6 item 8): a different rule changes this file only.

export const OUT_OF_DATE_MONTHS = 6;

const DAY_MS = 86_400_000;
// Vietnam is UTC+7 all year: no daylight saving.
const VIETNAM_OFFSET_MS = 7 * 3_600_000;

/** The date in Vietnam at this instant, as YYYY-MM-DD. */
export function vietnamDate(now: Date): string {
  return new Date(now.getTime() + VIETNAM_OFFSET_MS).toISOString().slice(0, 10);
}

/** A YYYY-MM-DD date plus whole days. */
export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** A YYYY-MM-DD date plus calendar months. A day the target month lacks becomes its last day (31 Aug + 6 months = end of Feb). */
export function addMonths(date: string, months: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

/** True when `today` (a Vietnam date) is after lastCheckedOn plus the allowed months. A guide checked exactly 6 months ago is still fresh. */
export function isOutOfDate(lastCheckedOn: string, today: string): boolean {
  return today > addMonths(lastCheckedOn, OUT_OF_DATE_MONTHS);
}
