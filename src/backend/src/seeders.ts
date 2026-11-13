import type { DataSource } from 'typeorm';
import { seed as seedCurricula } from './curriculum/seeds/index.js';
import { seed as seedGuides } from './guides/seed-guides.js';

export interface SeedOptions {
  /** Also load the synthetic zz-* guides of TC-B1-GUIDE-01 (test databases only). */
  guideFixtures: boolean;
}

/** One feature's step of `npm run db:seed`: loads its data in its own transaction and reports what it did. */
export type Seeder = (dataSource: DataSource, options: SeedOptions) => Promise<string[]>;

// Every feature that ships seed data, in run order. Guides first, so a refused
// --guide-fixtures run stops before anything is written.
export const SEEDERS: Seeder[] = [seedGuides, seedCurricula];
