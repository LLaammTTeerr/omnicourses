// UC-10 A5: a guide is out of date when more than OUT_OF_DATE_MONTHS calendar months have
// passed since a team member last checked it on the portal. Proposed in UC-10, to be
// confirmed by Lâm (B1 test cases §6 item 8). The API description follows the constant;
// the frontend's wording (src/frontend/src/guides/messages.ts) repeats the number.

export const OUT_OF_DATE_MONTHS = 6;

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
