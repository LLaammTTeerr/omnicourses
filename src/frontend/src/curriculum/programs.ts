import { computed } from 'vue';
import type { OnboardingDto } from '../api-schema/types.gen.js';
import { useAsyncLoad } from '../async-load.js';
import { useAuth } from '../auth/store.js';
import { localName, type Lang } from '../locale.js';
import { fetchPrograms, type Program } from './api.js';

// The programs a student can pick (onboarding, settings, the explorer): every program the API lists, and which of
// them this release offers.

/** A program this release offers: the contract lists them as the values of OnboardingDto.program. */
export type OfferedProgram = NonNullable<OnboardingDto['program']>;

/**
 * The programs and cohorts this release offers (B1 test cases §6 item 1). The API keeps them as a constant and
 * publishes them only in its contract (OnboardingDto): the type holds this copy to the same programs, and
 * programs.spec.ts checks the cohorts against openapi.json.
 */
export const OFFERED_COHORTS: Readonly<Record<OfferedProgram, readonly number[]>> = { APCS: [2024, 2025] };

/** Whether the release offers this program code, so a student may pick it (UC-01 A7). */
export const isOffered = (code: string): code is OfferedProgram => Object.hasOwn(OFFERED_COHORTS, code);

export interface ProgramChoice {
  code: string;
  program: Program | null;
  /** The cohorts both offered in this release and with a curriculum. */
  cohorts: number[];
  /** Offered in this release (B1 §6 item 1); the others are listed but cannot be picked (UC-01 A7). */
  offered: boolean;
}

/** Every program the API lists, the offered ones first; an offered program the list lacks still appears. */
export function programChoices(programs: readonly Program[]): ProgramChoice[] {
  const offered = Object.entries(OFFERED_COHORTS).map(([code, cohorts]): ProgramChoice => {
    const program = programs.find((p) => p.code === code) ?? null;
    return { code, program, cohorts: program ? cohorts.filter((c) => program.cohortYears.includes(c)) : [...cohorts], offered: true };
  });
  const others = programs.filter((p) => !isOffered(p.code)).map((program): ProgramChoice => ({ code: program.code, program, cohorts: [], offered: false }));
  return [...offered, ...others];
}

/** A program's name in the language on screen (`localName`), or its code while the list is not loaded. */
export const programName = (choice: ProgramChoice, lang: Lang): string => (choice.program ? localName(choice.program, lang) : choice.code);

/**
 * Loads the programs (GET /programs) and offers them as choices. Without the list the offered codes still show, so a
 * form never waits on it.
 */
export function usePrograms() {
  const auth = useAuth();
  const load = useAsyncLoad('the programs', () => auth.authed(fetchPrograms));
  return { ...load, choices: computed(() => programChoices(load.data.value?.programs ?? [])) };
}
