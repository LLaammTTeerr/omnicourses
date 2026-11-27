import { describe, expect, it } from 'vitest';
import { SETTINGS_MESSAGES } from './account/messages.js';
import { readReference } from './admin/errors.js';
import { ADMIN_MESSAGES } from './admin/messages.js';
import { AUDIT_MESSAGES } from './audit/messages.js';
import { AUTH_MESSAGES } from './auth/messages.js';
import { CALENDAR_MESSAGES } from './calendar/messages.js';
import { EXPLORER_MESSAGES } from './explorer/messages.js';
import { GUIDE_MESSAGES } from './guides/messages.js';
import type { Lang } from './locale.js';
import { NOTIFICATION_MESSAGES } from './notifications/messages.js';
import { GOAL_MESSAGES, ONBOARDING_MESSAGES, STUDY_MESSAGES } from './onboarding/messages.js';
import type { PlanIssue } from './plans/api.js';
import { PLANNER_MESSAGES } from './plans/messages.js';
import { PRIVACY_MESSAGES } from './privacy/messages.js';
import { SHARING_MESSAGES } from './sharing/messages.js';
import { SHELL_MESSAGES } from './shell/messages.js';
import { TRANSCRIPT_MESSAGES } from './transcript/messages.js';

const CATALOGUES: Record<string, Record<Lang, unknown>> = {
  ADMIN_MESSAGES,
  AUDIT_MESSAGES,
  AUTH_MESSAGES,
  CALENDAR_MESSAGES,
  EXPLORER_MESSAGES,
  GOAL_MESSAGES,
  GUIDE_MESSAGES,
  NOTIFICATION_MESSAGES,
  ONBOARDING_MESSAGES,
  PLANNER_MESSAGES,
  PRIVACY_MESSAGES,
  SETTINGS_MESSAGES,
  SHARING_MESSAGES,
  SHELL_MESSAGES,
  STUDY_MESSAGES,
  TRANSCRIPT_MESSAGES,
};

const SAMPLE_PLAN_ISSUE: PlanIssue = {
  code: 'prerequisite_not_met',
  kind: 'violation',
  term: { year: 2026, number: 1 },
  position: 0,
  courseCode: 'ZZ101',
  requirementGroupId: null,
  combinedMinimumId: null,
  missingCourseCodes: ['ZZ100'],
  offeredTermNumbers: [1],
  credits: 3,
  limit: 12,
  citation: 'Reg. 2021',
  message: 'Prerequisite not met',
};

const SAMPLE_ARGUMENTS: unknown[][] = [
  [],
  [1, 1, 1],
  ['2026-09-07'],
  [1, '2026-09-07'],
  ['ZZ101', 'ZZ102', 'ZZ103'],
  [['ZZ101'], ['ZZ102']],
  [[1, 3]],
  [{ year: 2026, number: 1 }],
  [SAMPLE_PLAN_ISSUE, { requirementName: () => 'ZZ-Group' }],
  [readReference('ZZ101')],
];

function sayAnything(message: (...args: unknown[]) => unknown): string | undefined {
  for (const args of SAMPLE_ARGUMENTS) {
    try {
      const said = message(...args);
      if (typeof said === 'string' && said.trim() !== '') return said;
    } catch {
      continue;
    }
  }
  return undefined;
}

function blankMessages(value: unknown, path: string): string[] {
  if (typeof value === 'string') return value.trim() === '' ? [path] : [];
  if (typeof value === 'function') return sayAnything(value as (...args: unknown[]) => unknown) === undefined ? [path] : [];
  if (Array.isArray(value)) return value.flatMap((item, i) => blankMessages(item, `${path}[${i}]`));
  if (value !== null && typeof value === 'object') return Object.entries(value).flatMap(([key, item]) => blankMessages(item, `${path}.${key}`));
  return [];
}

describe('the message catalogues', () => {
  it.each(Object.entries(CATALOGUES).flatMap(([name, catalogue]) => (['vi', 'en'] as const).map((lang) => [name, lang, catalogue[lang]] as const)))(
    '%s.%s has no empty message, so a test that looks for a message on screen cannot pass on an empty one',
    (name, lang, catalogue) => {
      expect(blankMessages(catalogue, `${name}.${lang}`)).toEqual([]);
    },
  );
});
