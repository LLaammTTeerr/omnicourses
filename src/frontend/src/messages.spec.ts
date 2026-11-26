import { describe, expect, it } from 'vitest';
import { SETTINGS_MESSAGES } from './account/messages.js';
import { ADMIN_MESSAGES } from './admin/messages.js';
import { AUDIT_MESSAGES } from './audit/messages.js';
import { AUTH_MESSAGES } from './auth/messages.js';
import { EXPLORER_MESSAGES } from './explorer/messages.js';
import { GUIDE_MESSAGES } from './guides/messages.js';
import { GOAL_MESSAGES, ONBOARDING_MESSAGES, STUDY_MESSAGES } from './onboarding/messages.js';
import { PRIVACY_MESSAGES } from './privacy/messages.js';
import { TRANSCRIPT_MESSAGES } from './transcript/messages.js';
import { readReference } from './admin/errors.js';
import type { Lang } from './locale.js';

const CATALOGUES: Record<string, Record<Lang, unknown>> = {
  ADMIN_MESSAGES,
  AUDIT_MESSAGES,
  AUTH_MESSAGES,
  EXPLORER_MESSAGES,
  GOAL_MESSAGES,
  GUIDE_MESSAGES,
  ONBOARDING_MESSAGES,
  PRIVACY_MESSAGES,
  SETTINGS_MESSAGES,
  STUDY_MESSAGES,
  TRANSCRIPT_MESSAGES,
};

const SAMPLE_ARGUMENTS: unknown[][] = [[], [1, 1, 1], ['ZZ101', 'ZZ102', 'ZZ103'], [['ZZ101'], ['ZZ102']], [[1, 3]], [readReference('ZZ101')]];

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
