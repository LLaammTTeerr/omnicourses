import { describe, expect, it } from 'vitest';
import { readReference } from './admin/errors.js';
import type { Lang } from './locale.js';
import type { PlanIssue } from './plans/api.js';
import { sourceFiles } from './testing/files.js';

const CATALOGUE_EXPORT = /_MESSAGES$/;
const LANGS: Lang[] = ['en', 'vi'];
const CATALOGUES_WHEN_GLOBBED = 16;

const MODULES: Record<string, unknown>[] = await Promise.all(sourceFiles('messages.ts').map((path) => import(/* @vite-ignore */ path)));

const CATALOGUE_LIST: [string, Record<Lang, unknown>][] = MODULES.flatMap((module) =>
  Object.entries(module)
    .filter(([name]) => CATALOGUE_EXPORT.test(name))
    .map(([name, catalogue]) => [name, catalogue as Record<Lang, unknown>] as [string, Record<Lang, unknown>]),
);

const CATALOGUES: Record<string, Record<Lang, unknown>> = Object.fromEntries(CATALOGUE_LIST);

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

const keyPaths = (value: unknown, path = ''): string[] =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? Object.entries(value).flatMap(([key, item]) => keyPaths(item, `${path}.${key}`))
    : [path];

describe('the message catalogues', () => {
  it('are collected from every messages.ts, each under its own name', () => {
    expect(CATALOGUE_LIST.length).toBe(Object.keys(CATALOGUES).length);
    expect(CATALOGUE_LIST.length).toBeGreaterThanOrEqual(CATALOGUES_WHEN_GLOBBED);
  });

  it.each(Object.entries(CATALOGUES))('%s has exactly the languages and the same messages in each', (_name, catalogue) => {
    expect(Object.keys(catalogue).sort()).toEqual(LANGS);
    expect(keyPaths(catalogue.vi)).toEqual(keyPaths(catalogue.en));
  });

  it.each(Object.entries(CATALOGUES).flatMap(([name, catalogue]) => (['vi', 'en'] as const).map((lang) => [name, lang, catalogue[lang]] as const)))(
    '%s.%s has no empty message, so a test that looks for a message on screen cannot pass on an empty one',
    (name, lang, catalogue) => {
      expect(blankMessages(catalogue, `${name}.${lang}`)).toEqual([]);
    },
  );
});
