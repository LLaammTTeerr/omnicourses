import { DataSourceOptions } from 'typeorm';
import { Session } from '../auth/session.entity.js';
import { User } from '../users/user.entity.js';
import { CreateUsersAndSessions1761696000000 } from './migrations/1761696000000-create-users-and-sessions.js';

// Entities and migrations are listed as imported classes, not globs: globs break
// between ts (tests) and compiled js (dist), and a missing import fails typecheck.
// Add each new entity and migration here.
export const dataSourceOptions = {
  type: 'postgres',
  entities: [User, Session],
  migrations: [CreateUsersAndSessions1761696000000],
  synchronize: false,
} satisfies DataSourceOptions;
