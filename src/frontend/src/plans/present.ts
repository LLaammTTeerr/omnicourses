import type { IconName } from '../shell/icons.js';
import type { PlanIssue, PlanIssueKind } from './api.js';

// How the planner shows each kind of issue: a violation, a flag and an unknown never look alike, and each has an
// icon and words as well as a colour. Presentation only; the kind comes from the rule engine.

export const ISSUE_KINDS_SHOWN = ['violation', 'flag', 'unknown'] as const satisfies readonly PlanIssueKind[];

export const KIND_STYLE: Record<PlanIssueKind, { icon: IconName; tone: 'bad' | 'warn' | 'line' }> = {
  violation: { icon: 'alert', tone: 'bad' },
  flag: { icon: 'info', tone: 'warn' },
  unknown: { icon: 'info', tone: 'line' },
};

/** The strongest kind among some issues, for the colour of a tile or a term row; null when there are none. */
export function strongest(issues: readonly PlanIssue[] | undefined): PlanIssueKind | null {
  for (const kind of ISSUE_KINDS_SHOWN) if (issues?.some((issue) => issue.kind === kind)) return kind;
  return null;
}
