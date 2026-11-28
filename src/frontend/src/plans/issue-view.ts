import type { IconName } from '../shell/icons.js';
import type { PlanIssue, PlanIssueCode, PlanIssueKind, PlanTermLoad } from './api.js';

export const ISSUE_KINDS_SHOWN = ['violation', 'flag', 'unknown'] as const satisfies readonly PlanIssueKind[];

export const KIND_STYLE: Record<PlanIssueKind, { icon: IconName; tone: 'bad' | 'warn' | 'line' }> = {
  violation: { icon: 'alert', tone: 'bad' },
  flag: { icon: 'info', tone: 'warn' },
  unknown: { icon: 'info', tone: 'line' },
};

export function strongest(issues: readonly Pick<PlanIssue, 'kind'>[] | undefined): PlanIssueKind | null {
  for (const kind of ISSUE_KINDS_SHOWN) if (issues?.some((issue) => issue.kind === kind)) return kind;
  return null;
}

export const BAR_CODES: ReadonlySet<PlanIssueCode> = new Set(['load_above_maximum', 'load_below_minimum']);

export const METER_HEADROOM_CREDITS = 6;

export type CapState = 'under' | 'over' | 'ok' | '';

export interface Meter {
  fill: number;
  from: number;
  to: number;
  min: number | null;
  minLabel: number | null;
  max: number;
  maxLabel: number;
}

export const clause = (citation: string) => /Điều\s+[\w.]+/.exec(citation)?.[0] ?? null;

export function capOf(issues: readonly Pick<PlanIssue, 'code'>[], credits: number): CapState {
  if (issues.some((i) => i.code === 'load_above_maximum')) return 'over';
  if (issues.some((i) => i.code === 'load_below_minimum')) return 'under';
  return credits > 0 ? 'ok' : '';
}

export function toneOf(issues: readonly Pick<PlanIssue, 'kind'>[]): string {
  const kind = strongest(issues.filter((i) => i.kind !== 'unknown'));
  return kind ? `has-${kind}` : '';
}

export function meter(load: PlanTermLoad | null, base: number): Meter | null {
  if (!load?.caps) return null;
  const scale = load.caps.max + METER_HEADROOM_CREDITS;
  const pct = (n: number) => Math.max(0, Math.min(100, (n / scale) * 100));
  return {
    fill: pct(Math.min(base, load.credits)),
    from: pct(Math.min(base, load.credits)),
    to: pct(Math.max(base, load.credits)),
    min: load.caps.min === null ? null : pct(load.caps.min),
    minLabel: load.caps.min,
    max: pct(load.caps.max),
    maxLabel: load.caps.max,
  };
}
