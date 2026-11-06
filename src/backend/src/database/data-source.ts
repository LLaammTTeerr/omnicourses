import { DataSourceOptions } from 'typeorm';
import { MIGRATIONS } from './migrations/index.js';

// Entities are registered by their feature modules (TypeOrmModule.forFeature).
export const dataSourceOptions = {
  type: 'postgres',
  migrations: MIGRATIONS,
  synchronize: false,
} satisfies DataSourceOptions;
