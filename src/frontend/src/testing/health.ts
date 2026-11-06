import type { Health } from '../api.js';

export const HEALTHY: Health = { status: 'ok', database: 'up', postgresVersion: '18.6' };
