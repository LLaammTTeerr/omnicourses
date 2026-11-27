import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { shallowRef } from 'vue';
import type { CurriculumCourse } from '../curriculum/api.js';
import type { TranscriptRow } from './api.js';
import { autoFill, useTranscriptDraft } from './draft.js';
import { MAX_ROWS } from './rows.js';
import type { PastedRow } from './paste.js';

const course = { name: 'Môn thử', credits: 4 };

describe('autoFill', () => {
  it('fills a row whose name and credits are empty, and remembers what it filled', () => {
    expect(autoFill({ courseName: '', credits: '' }, course, null)).toEqual({ courseName: 'Môn thử', credits: '4', filled: { name: 'Môn thử', credits: '4' } });
  });

  it('treats spaces as empty', () => {
    expect(autoFill({ courseName: '  ', credits: ' ' }, course, null).courseName).toBe('Môn thử');
  });

  it('refills what it filled before when the student has not touched it', () => {
    const previous = { name: 'Môn cũ', credits: '3' };
    expect(autoFill({ courseName: 'Môn cũ', credits: '3' }, course, previous)).toEqual({
      courseName: 'Môn thử',
      credits: '4',
      filled: { name: 'Môn thử', credits: '4' },
    });
  });

  it('keeps what the student edited, and still remembers the earlier fill', () => {
    const previous = { name: 'Môn cũ', credits: '3' };
    expect(autoFill({ courseName: 'Tên riêng', credits: '5' }, course, previous)).toEqual({ courseName: 'Tên riêng', credits: '5', filled: previous });
  });

  it('keeps typed values and remembers nothing when nothing was filled before', () => {
    expect(autoFill({ courseName: 'Tên riêng', credits: '5' }, course, null)).toEqual({ courseName: 'Tên riêng', credits: '5', filled: null });
  });

  it('fills one field and leaves the other the student typed', () => {
    expect(autoFill({ courseName: 'Tên riêng', credits: '' }, course, null)).toEqual({ courseName: 'Tên riêng', credits: '4', filled: { name: undefined, credits: '4' } });
  });

  it('clears a previous fill when the code no longer matches a course', () => {
    const previous = { name: 'Môn cũ', credits: '3' };
    expect(autoFill({ courseName: 'Môn cũ', credits: '3' }, null, previous)).toEqual({ courseName: '', credits: '', filled: null });
  });

  it('keeps edited values when the code no longer matches a course', () => {
    const previous = { name: 'Môn cũ', credits: '3' };
    expect(autoFill({ courseName: 'Tên riêng', credits: '3' }, null, previous)).toEqual({ courseName: 'Tên riêng', credits: '', filled: null });
  });

  it('leaves a row alone when there is no course and nothing was filled', () => {
    expect(autoFill({ courseName: 'Tên riêng', credits: '5' }, null, null)).toEqual({ courseName: 'Tên riêng', credits: '5', filled: null });
  });
});

const savedRow = (code: string): TranscriptRow => ({ courseCode: code, courseName: 'Môn', credits: 3, result: 'graded', grade: 8, term: { year: 2025, number: 1 } });
const pasted = (count: number): PastedRow[] =>
  Array.from({ length: count }, (_, i) => ({ year: 2025, number: 1, courseCode: `ZZ${i}`, courseName: 'Môn', credits: '3', result: 'graded', grade: '8' }) as PastedRow);

describe('useTranscriptDraft', () => {
  beforeEach(() => setActivePinia(createPinia()));

  const open = (map: ReadonlyMap<string, CurriculumCourse> | null = null) => useTranscriptDraft(shallowRef(map));

  it('is clean after the saved rows are adopted and dirty after an edit', () => {
    const draft = open();
    draft.adoptSaved([savedRow('ZZ101')]);
    expect(draft.dirty.value).toBe(false);
    expect(draft.diff.value).toBeNull();
    draft.rows.value[0]!.courseName = 'Tên khác';
    expect(draft.dirty.value).toBe(true);
    expect(draft.diff.value).toEqual({ added: 0, changed: 1, removed: 0 });
  });

  it('restores the saved rows on cancel', () => {
    const draft = open();
    draft.adoptSaved([savedRow('ZZ101')]);
    draft.remove(0);
    expect(draft.dirty.value).toBe(true);
    draft.cancel();
    expect(draft.dirty.value).toBe(false);
    expect(draft.rows.value).toHaveLength(1);
  });

  it('adds a blank row and returns its key', () => {
    const draft = open();
    const key = draft.addBlankRow();
    expect(draft.rows.value.at(-1)!.key).toBe(key);
  });

  it('appends pasted rows within the limit', () => {
    const draft = open();
    draft.adoptSaved([savedRow('ZZ101')]);
    expect(draft.appendPasted(pasted(2))).toBe(true);
    expect(draft.rows.value).toHaveLength(3);
  });

  it('refuses to append past the row limit and leaves the rows alone', () => {
    const draft = open();
    draft.adoptSaved([savedRow('ZZ101')]);
    expect(draft.appendPasted(pasted(MAX_ROWS))).toBe(false);
    expect(draft.rows.value).toHaveLength(1);
  });

  it('replaces the rows within the limit and refuses past it', () => {
    const draft = open();
    draft.adoptSaved([savedRow('ZZ101')]);
    expect(draft.replaceWithPasted(pasted(MAX_ROWS + 1))).toBe(false);
    expect(draft.rows.value).toHaveLength(1);
    expect(draft.replaceWithPasted(pasted(MAX_ROWS))).toBe(true);
    expect(draft.rows.value).toHaveLength(MAX_ROWS);
  });

  it('fills a blank row from the curriculum, refills while untouched, and clears when the code stops matching', () => {
    const map = new Map([['ZZ101', { code: 'ZZ101', nameVi: 'Môn thử', nameEn: null, credits: 4 } as CurriculumCourse]]);
    const draft = open(map);
    draft.addBlankRow();
    const row = draft.rows.value[0]!;
    row.courseCode = 'ZZ101';
    draft.syncAutoFill(row);
    expect([row.courseName, row.credits]).toEqual(['Môn thử', '4']);
    row.courseCode = 'ZZ999';
    draft.syncAutoFill(row);
    expect([row.courseName, row.credits]).toEqual(['', '']);
  });

  it('does nothing without a curriculum', () => {
    const draft = open();
    draft.addBlankRow();
    const row = draft.rows.value[0]!;
    row.courseCode = 'ZZ101';
    draft.syncAutoFill(row);
    expect([row.courseName, row.credits]).toEqual(['', '']);
  });
});
