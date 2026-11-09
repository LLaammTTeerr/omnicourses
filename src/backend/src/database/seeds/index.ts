import type { DataSource } from 'typeorm';
import { apcs2024 } from './apcs-2024.js';
import { apcs2025 } from './apcs-2025.js';
import { apcsCatalogDecisions } from './apcs-catalog-decisions.js';
import { CLC_2025_SEEDS } from './clc-2025.js';
import { seedCurricula } from './seed-curricula.js';
import type { CatalogDecision, CurriculumSeed } from './seed-types.js';

/** Every curriculum `npm run db:seed` loads, in load order. */
export const CURRICULUM_SEEDS: CurriculumSeed[] = [apcs2024, apcs2025, ...CLC_2025_SEEDS];

/** Reviewed decisions for courses printed differently across curricula. */
export const CATALOG_DECISIONS: CatalogDecision[] = [...apcsCatalogDecisions];

/** The curricula step of `npm run db:seed` (insert-only). */
export async function seed(dataSource: DataSource): Promise<string[]> {
  const report = await seedCurricula(dataSource, CURRICULUM_SEEDS, CATALOG_DECISIONS);
  return [`Inserted: ${JSON.stringify(report.inserted)}`, `Already present, left untouched: ${JSON.stringify(report.skipped)}`];
}
