import { describe, expect, it } from 'vitest';
import { apcs2024TeachingPlan } from './apcs-2024.teaching-plan.js';
import { apcs2025TeachingPlan } from './apcs-2025.teaching-plan.js';
import { apcsEquivalences } from './apcs-equivalences.js';
import { clcEquivalences } from './clc-equivalences.js';
import { buildCatalog, CatalogConflictError, COURSE_CODE_PATTERN, normalizeCourseCode, rowToCourse } from './catalog.js';
import { CATALOG_DECISIONS, CURRICULUM_SEEDS } from './index.js';
import type { CurriculumSeed, EquivalenceList, PrintedGroup, TeachingPlan } from './seed-types.js';

// Deterministic checks of the transcribed curricula against the totals printed
// in the PDFs. A failure means a transcription error or a printed total that
// does not add up; the fix is the data or a recorded discrepancy, never a
// weaker check.

const label = (seed: CurriculumSeed) => `${seed.program.code} ${seed.curriculum.cohort_year}`;
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

/**
 * Credits a compulsory group requires: its BB rows that count towards the
 * cohort total (all BB rows for a group outside that total), plus credits
 * chosen among its TC rows.
 */
function compulsoryCredits(group: PrintedGroup): number {
  const bb = group.rows.filter((r) => r.type === 'BB' && (r.counts_toward_total || group.outside_total));
  return sum(bb.map((r) => r.credits)) + (group.choose_credits?.credits ?? 0);
}

/** Credits available in a group's TC rows. */
function electivePool(group: PrintedGroup): number {
  return sum(group.rows.filter((r) => r.type === 'TC').map((r) => r.credits));
}

const TEACHING_PLANS: TeachingPlan[] = [apcs2024TeachingPlan, apcs2025TeachingPlan];
const EQUIVALENCE_LISTS: EquivalenceList[] = [apcsEquivalences, clcEquivalences];

function allStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(allStrings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(allStrings);
  return [];
}

describe.each(CURRICULUM_SEEDS.map((seed) => [label(seed), seed] as const))('%s curriculum seed', (_, seed) => {
  const rows = seed.groups.flatMap((g) => g.rows);

  it('has codes that meet the courses.code CHECK and positive credits', () => {
    for (const row of rows) {
      expect(row.code, row.code).toMatch(COURSE_CODE_PATTERN);
      expect(normalizeCourseCode(row.code_printed ?? row.code), row.code).toBe(row.code);
      expect(row.credits, row.code).toBeGreaterThan(0);
      for (const time of [row.theory_time, row.lab_work_time, row.exercise_time, row.project_time]) {
        if (time !== null) expect(time, row.code).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('gives every row, group and printed total a page inside its PDF', () => {
    const structurePages = [
      seed.program.page,
      seed.curriculum.decision.page,
      ...seed.curriculum.total_credits_pages,
      ...seed.blocks.map((b) => b.page),
      ...(seed.subtotals ?? []).map((s) => s.page),
      ...seed.groups.flatMap((g) => [
        g.page,
        ...g.credits_pages,
        ...(g.choose_credits ? [g.choose_credits.page] : []),
        ...(g.options ?? []).map((o) => o.page),
      ]),
    ];
    const rowPages = [...rows.map((r) => r.page), ...seed.appendix.map((a) => a.page)];
    const inside = (page: number, last: number) => Number.isInteger(page) && page >= 1 && page <= last;
    const structureLast = (seed.source.structure ?? seed.source).pages;
    for (const page of structurePages) expect(inside(page, structureLast), `structure page ${page}`).toBe(true);
    for (const page of rowPages) expect(inside(page, seed.source.pages), `row page ${page}`).toBe(true);
  });

  it('writes Vietnamese text in Unicode NFC, without stray spaces', () => {
    for (const text of allStrings(seed)) {
      expect(text, text).toBe(text.normalize('NFC'));
      expect(text, text).toBe(text.trim());
      expect(text, text).not.toMatch(/ {2}/);
    }
  });

  it('has no duplicate group names, and no duplicate course within a group', () => {
    const names = seed.groups.map((g) => g.name);
    expect(new Set(names).size).toBe(names.length);
    for (const group of seed.groups) {
      const codes = group.rows.map((r) => r.code);
      expect(new Set(codes).size, group.name).toBe(codes.length);
    }
  });

  it('adds each compulsory group up to its printed total', () => {
    for (const group of seed.groups.filter((g) => g.kind === 'compulsory')) {
      expect(group.credits_total_min, group.name).toBeNull();
      expect(compulsoryCredits(group), group.name).toBe(group.credits_total);
      if (group.choose_credits) {
        expect(electivePool(group), group.name).toBeGreaterThanOrEqual(group.choose_credits.credits);
      } else {
        expect(group.rows.every((r) => r.type === 'BB'), group.name).toBe(true);
      }
    }
  });

  it('gives each elective group a pool at least its printed minimum', () => {
    for (const group of seed.groups.filter((g) => g.kind === 'elective')) {
      expect(group.credits_total, group.name).toBeNull();
      expect(group.rows.every((r) => r.type === 'TC'), group.name).toBe(true);
      expect(electivePool(group), group.name).toBeGreaterThanOrEqual(group.credits_total_min ?? 0);
      for (const option of group.options ?? []) {
        const credits = option.codes.map((code) => {
          const row = group.rows.find((r) => r.code === code);
          expect(row, `${group.name}: option course ${code}`).toBeDefined();
          return row!.credits;
        });
        const label = `${group.name}: ${option.codes.join(' + ')}`;
        if (option.at_least) expect(sum(credits), label).toBeGreaterThanOrEqual(group.credits_total_min!);
        else expect(sum(credits), label).toBe(group.credits_total_min);
      }
    }
  });

  it('adds the groups up to each printed block and the blocks up to the cohort total', () => {
    const covered = seed.blocks.flatMap((b) => b.groups);
    const counted = seed.groups.filter((g) => !g.outside_total).map((g) => g.name);
    expect([...covered].sort()).toEqual([...counted].sort());

    for (const block of seed.blocks) {
      const groups = block.groups.map((name) => seed.groups.find((g) => g.name === name)!);
      if (block.at_least) {
        // A minimum over several groups, such as "(B) + (C) ≥ 43": the groups'
        // own minimums fit inside it and their pools can reach it.
        expect(sum(groups.map((g) => g.credits_total_min ?? 0)), block.name).toBeLessThanOrEqual(block.credits);
        expect(sum(groups.map(electivePool)), block.name).toBeGreaterThanOrEqual(block.credits);
      } else {
        const required = groups.map((g) => g.credits_total ?? g.credits_total_min);
        expect(required, block.name).not.toContain(null);
        expect(sum(required as number[]), block.name).toBe(block.credits);
      }
    }
    expect(sum(seed.blocks.map((b) => b.credits))).toBe(seed.curriculum.total_credits_min);
  });

  it('adds the groups up to each printed subtotal', () => {
    for (const subtotal of seed.subtotals ?? []) {
      const groups = subtotal.groups.map((name) => seed.groups.find((g) => g.name === name));
      expect(groups, subtotal.name).not.toContain(undefined);
      expect(sum(groups.map((g) => g!.credits_total ?? g!.credits_total_min ?? Number.NaN)), subtotal.name).toBe(subtotal.credits);
    }
  });

  it('checks a group outside the cohort total against its own printed total', () => {
    for (const group of seed.groups.filter((g) => g.outside_total)) {
      expect(group.rows.every((r) => !r.counts_toward_total), group.name).toBe(true);
    }
    for (const group of seed.groups.filter((g) => !g.outside_total)) {
      expect(group.rows.filter((r) => !r.counts_toward_total).every((r) => r.type === 'BB'), group.name).toBe(true);
    }
  });

  it.skipIf(seed.appendix.length === 0)('matches every row to its appendix row, with the same Vietnamese name', () => {
    const appendixCodes = seed.appendix.map((a) => a.code);
    expect(new Set(appendixCodes).size).toBe(appendixCodes.length);
    expect([...new Set(rows.map((r) => r.code))].sort()).toEqual([...appendixCodes].sort());
    for (const row of rows) {
      const appendix = seed.appendix.find((a) => a.code === row.code)!;
      expect(appendix.name_vi, row.code).toBe(row.name_vi);
      expect(rowToCourse(seed, row).name_en, row.code).toBe(appendix.name_en);
    }
  });
});

describe('shared course catalog', () => {
  it('builds from every seed with no unexplained difference between cohorts', () => {
    expect(() => buildCatalog(CURRICULUM_SEEDS, CATALOG_DECISIONS)).not.toThrow();
  });

  it('uses every catalog decision, and each decision quotes the seed data exactly', () => {
    for (const decision of CATALOG_DECISIONS) {
      expect(decision.printed.map((p) => p.value), decision.code).toContain(decision.catalog_value);
      for (const printed of decision.printed) {
        const seed = CURRICULUM_SEEDS.find((s) => s.curriculum.code === printed.curriculum)!;
        const row = seed.groups.flatMap((g) => g.rows).find((r) => r.code === decision.code)!;
        expect(rowToCourse(seed, row)[decision.field], `${decision.code} ${printed.curriculum}`).toBe(printed.value);
      }
      // Without the decision, the same seeds must conflict on that field.
      const others = CATALOG_DECISIONS.filter((d) => d !== decision);
      expect(() => buildCatalog(CURRICULUM_SEEDS, others), decision.code).toThrow(CatalogConflictError);
    }
  });

  it('takes the decided value for a decided field', () => {
    const catalog = buildCatalog(CURRICULUM_SEEDS, CATALOG_DECISIONS);
    for (const decision of CATALOG_DECISIONS) {
      expect(catalog.get(decision.code)![decision.field]).toBe(decision.catalog_value);
    }
  });

  it('refuses to let the last cohort win when a code differs', () => {
    const [first] = CURRICULUM_SEEDS;
    const changed: CurriculumSeed = structuredClone(first);
    changed.curriculum.cohort_year = 2099;
    changed.groups[0].rows[0].credits += 1;
    const code = changed.groups[0].rows[0].code;

    expect(() => buildCatalog([first, changed], [])).toThrow(CatalogConflictError);
    try {
      buildCatalog([first, changed], []);
    } catch (error) {
      expect((error as CatalogConflictError).conflicts).toContainEqual(
        expect.objectContaining({ code, field: 'credits' }),
      );
    }
  });

  it('describes each program the same way in every seed that names it', () => {
    for (const seed of CURRICULUM_SEEDS) {
      const first = CURRICULUM_SEEDS.find((s) => s.program.code === seed.program.code)!;
      expect({ ...seed.program, page: 0 }, label(seed)).toEqual({ ...first.program, page: 0 });
    }
  });
});

describe('CLC 2025 specialisations', () => {
  const SHARED = [
    'Lý luận chính trị - Pháp luật',
    'Khoa học xã hội - Kinh tế - Kỹ năng',
    'Toán - Khoa học tự nhiên - Công nghệ - Môi trường: bắt buộc',
    'Toán - Khoa học tự nhiên - Công nghệ - Môi trường: chọn 01 học phần toán học',
    'Toán - Khoa học tự nhiên - Công nghệ - Môi trường: chọn học 08 tín chỉ',
    'Tin học',
    'Giáo dục thể chất',
    'Giáo dục quốc phòng - An ninh',
    'Kiến thức cơ sở ngành',
  ];
  const clc = CURRICULUM_SEEDS.filter((s) => s.program.code.startsWith('CNTT-TCTA-'));

  it('seeds all nine specialisations as programs with one 2025 curriculum each', () => {
    expect(clc).toHaveLength(9);
    expect(new Set(clc.map((s) => s.program.code)).size).toBe(9);
    expect(clc.every((s) => s.curriculum.cohort_year === 2025 && s.curriculum.total_credits_min === 138)).toBe(true);
  });

  it('gives every specialisation the same general-education and cơ sở ngành groups', () => {
    const shape = (seed: CurriculumSeed) =>
      SHARED.map((name) => {
        const g = seed.groups.find((x) => x.name === name)!;
        return { name, kind: g.kind, total: g.credits_total, min: g.credits_total_min, codes: g.rows.map((r) => r.code) };
      });
    for (const seed of clc) expect(shape(seed), label(seed)).toEqual(shape(clc[0]));
  });

  it('puts every course of a table PDF in exactly one group', () => {
    for (const seed of clc) {
      const codes = seed.groups.flatMap((g) => g.rows.map((r) => r.code));
      expect(new Set(codes).size, label(seed)).toBe(codes.length);
    }
  });
});

describe('normalizeCourseCode', () => {
  it('trims, upper-cases and drops spaces and dashes', () => {
    expect(normalizeCourseCode(' cs 160 ')).toBe('CS160');
    expect(normalizeCourseCode('CS-160')).toBe('CS160');
    expect(normalizeCourseCode('baa00030')).toBe('BAA00030');
  });

  it('leaves a dotted code invalid for the CHECK rather than guessing', () => {
    expect(normalizeCourseCode('CTH001.2')).not.toMatch(COURSE_CODE_PATTERN);
  });
});

describe.each(TEACHING_PLANS.map((plan) => [plan.curriculum, plan] as const))('teaching plan %s (not loaded)', (code, plan) => {
  const seed = CURRICULUM_SEEDS.find((s) => s.curriculum.code === code)!;
  const rows = seed.groups.flatMap((g) => g.rows);

  it('places only courses of the curriculum, with their credits and type', () => {
    for (const planned of plan.rows) {
      const row = rows.find((r) => r.code === planned.code);
      expect(row, planned.code).toBeDefined();
      expect(planned.credits, planned.code).toBe(row!.credits);
      expect(planned.type, planned.code).toBe(row!.type);
      expect(planned.semester, planned.code).toBeGreaterThanOrEqual(1);
      expect(planned.semester, planned.code).toBeLessThanOrEqual(12);
    }
  });

  it('places every course of the curriculum, except those listed as not in the plan', () => {
    const planned = new Set(plan.rows.map((r) => r.code));
    const missing = [...new Set(rows.map((r) => r.code))].filter((code) => !planned.has(code));
    expect(missing.sort()).toEqual(plan.not_in_plan.map((n) => n.code).sort());
  });
});

describe.each(EQUIVALENCE_LISTS.map((list) => [list.source.file, list] as const))('equivalence list %s (not loaded)', (_, list) => {
  it('has a normalised code meeting the CHECK for each course, or null with a reason', () => {
    for (const row of list.rows) {
      expect(row.page).toBeGreaterThanOrEqual(1);
      expect(row.page).toBeLessThanOrEqual(list.source.pages);
      for (const course of [...row.hp01, ...row.hp02, ...row.hp03]) {
        if (course.credits === null) expect(row.needs_check, course.code_printed).toBeTruthy();
        else expect(course.credits, course.code_printed).toBeGreaterThan(0);
        if (course.code === null) {
          expect(row.needs_check, course.code_printed).toBeTruthy();
          expect(normalizeCourseCode(course.code_printed)).not.toMatch(COURSE_CODE_PATTERN);
        } else {
          expect(course.code).toBe(normalizeCourseCode(course.code_printed));
          expect(course.code).toMatch(COURSE_CODE_PATTERN);
        }
      }
    }
  });

  it('prints the catalog credits for every seeded course it names, or flags the row', () => {
    const catalog = buildCatalog(CURRICULUM_SEEDS, CATALOG_DECISIONS);
    for (const row of list.rows) {
      for (const course of [...row.hp01, ...row.hp02, ...row.hp03]) {
        const seeded = course.code ? catalog.get(course.code) : undefined;
        if (seeded && course.credits !== seeded.credits) expect(row.needs_check, `STT ${row.stt.join(',')} ${course.code}`).toBeTruthy();
      }
    }
  });

  it('covers every printed STT exactly once', () => {
    const stt = list.rows.flatMap((r) => r.stt).sort((a, b) => a - b);
    expect(stt).toEqual(Array.from({ length: stt.length }, (_, i) => i + 1));
  });
});
