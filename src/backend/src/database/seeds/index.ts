import { apcs2024 } from './apcs-2024.js';
import { apcs2025 } from './apcs-2025.js';
import { apcsCatalogDecisions } from './apcs-catalog-decisions.js';
import type { CatalogDecision, CurriculumSeed } from './seed-types.js';

/** Every curriculum `npm run db:seed` loads, in load order. */
export const CURRICULUM_SEEDS: CurriculumSeed[] = [apcs2024, apcs2025];

/** Reviewed decisions for courses printed differently across curricula. */
export const CATALOG_DECISIONS: CatalogDecision[] = [...apcsCatalogDecisions];
