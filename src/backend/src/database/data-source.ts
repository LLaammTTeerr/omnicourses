import { DataSourceOptions } from 'typeorm';
import { AiUsage } from '../ai/ai-usage.entity.js';
import { Session } from '../auth/session.entity.js';
import { User } from '../users/user.entity.js';
import { CreateUsersAndSessions1761696000000 } from './migrations/1761696000000-create-users-and-sessions.js';
import { CreateAiUsage1792800000000 } from './migrations/1792800000000-create-ai-usage.js';
import { AddUsersDeletionRequestedAt1792886400000 } from './migrations/1792886400000-add-users-deletion-requested-at.js';

// Entities and migrations are listed as imported classes, not globs: globs break
// between ts (tests) and compiled js (dist), and a missing import fails typecheck.
// Add each new entity and migration here.
export const dataSourceOptions = {
  type: 'postgres',
  entities: [User, Session, AiUsage],
  migrations: [
    CreateUsersAndSessions1761696000000,
    CreateAiUsage1792800000000,
    AddUsersDeletionRequestedAt1792886400000,
  ],
  synchronize: false,
} satisfies DataSourceOptions;
