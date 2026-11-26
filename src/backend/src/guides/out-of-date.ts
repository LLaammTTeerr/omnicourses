import { isoDay } from '../config/time.js';

export const OUT_OF_DATE_MONTHS = 6;

export function addMonths(date: string, months: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return isoDay(target);
}

export function isOutOfDate(lastCheckedOn: string, today: string): boolean {
  return today > addMonths(lastCheckedOn, OUT_OF_DATE_MONTHS);
}
