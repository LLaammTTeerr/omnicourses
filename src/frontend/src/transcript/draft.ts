import { computed, ref, shallowRef, type Ref } from 'vue';
import type { CurriculumCourse } from '../curriculum/api.js';
import { courseName as nameIn } from '../curriculum/present.js';
import { useLocale } from '../locale.js';
import type { TranscriptRow } from './api.js';
import type { PastedRow } from './paste.js';
import { blankRow, diffRows, fromRow, MAX_ROWS, normalizeCode, type DraftRow } from './rows.js';

export interface AutoFilled {
  name?: string;
  credits?: string;
}

export interface AutoFillResult {
  courseName: string;
  credits: string;
  filled: AutoFilled | null;
}

type Typed = Pick<DraftRow, 'courseName' | 'credits'>;
type AutoFillSource = { name: string; credits: number };

const isBlank = (text: string): boolean => text.trim() === '';

function fillField(typed: string, next: string, previous: string | undefined): { text: string; filled: string | undefined } {
  if (isBlank(typed) || (previous !== undefined && typed === previous)) return { text: next, filled: next };
  return { text: typed, filled: previous };
}

function clearField(typed: string, previous: string | undefined): string {
  return previous !== undefined && typed === previous ? '' : typed;
}

export function autoFill(row: Typed, course: AutoFillSource | null, previous: AutoFilled | null): AutoFillResult {
  if (!course) {
    return { courseName: clearField(row.courseName, previous?.name), credits: clearField(row.credits, previous?.credits), filled: null };
  }
  const name = fillField(row.courseName, course.name, previous?.name);
  const credits = fillField(row.credits, String(course.credits), previous?.credits);
  const remembered = name.filled !== undefined || credits.filled !== undefined;
  return { courseName: name.text, credits: credits.text, filled: remembered ? { name: name.filled, credits: credits.filled } : null };
}

const snapshot = (list: readonly DraftRow[]): string => JSON.stringify(list.map(({ key: _key, ...fields }) => fields));

const copyRows = (list: readonly DraftRow[]): DraftRow[] => list.map((row) => ({ ...row }));

export function useTranscriptDraft(curriculumCourses: Ref<ReadonlyMap<string, CurriculumCourse> | null>) {
  const locale = useLocale();
  const rows = ref<DraftRow[]>([]);
  const baseline = shallowRef<readonly DraftRow[]>([]);
  const savedState = ref(snapshot([]));
  const autoFilled = new WeakMap<DraftRow, AutoFilled>();
  let nextKey = 0;

  const dirty = computed(() => snapshot(rows.value) !== savedState.value);
  const diff = computed(() => (dirty.value && baseline.value.length > 0 ? diffRows(baseline.value, rows.value) : null));

  function adoptSaved(saved: readonly TranscriptRow[]): void {
    const loaded = saved.map((row) => fromRow(row, nextKey++));
    baseline.value = copyRows(loaded);
    rows.value = loaded;
    savedState.value = snapshot(rows.value);
  }

  function addBlankRow(): number {
    const row = blankRow(nextKey++, rows.value);
    rows.value.push(row);
    return row.key;
  }

  function remove(index: number): void {
    rows.value.splice(index, 1);
  }

  function cancel(): void {
    rows.value = copyRows(baseline.value);
  }

  const withKeys = (pasted: readonly PastedRow[]): DraftRow[] => pasted.map((row) => ({ key: nextKey++, ...row }));

  function appendPasted(pasted: readonly PastedRow[]): boolean {
    if (rows.value.length + pasted.length > MAX_ROWS) return false;
    rows.value.push(...withKeys(pasted));
    return true;
  }

  function replaceWithPasted(pasted: readonly PastedRow[]): boolean {
    if (pasted.length > MAX_ROWS) return false;
    rows.value = withKeys(pasted);
    return true;
  }

  function syncAutoFill(row: DraftRow): void {
    if (!curriculumCourses.value) return;
    const found = curriculumCourses.value.get(normalizeCode(row.courseCode));
    const course = found ? { name: nameIn(found, locale.lang), credits: found.credits } : null;
    const result = autoFill(row, course, autoFilled.get(row) ?? null);
    row.courseName = result.courseName;
    row.credits = result.credits;
    if (result.filled) autoFilled.set(row, result.filled);
    else autoFilled.delete(row);
  }

  return { rows, dirty, diff, adoptSaved, addBlankRow, remove, cancel, appendPasted, replaceWithPasted, syncAutoFill };
}
