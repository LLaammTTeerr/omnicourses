import * as listed from '../migration-list.js';

const TIMESTAMP_LENGTH = 13;
const timestampOf = (migration: { name: string }) => Number(migration.name.slice(-TIMESTAMP_LENGTH));

export const MIGRATIONS = Object.values(listed).sort((a, b) => timestampOf(a) - timestampOf(b));
