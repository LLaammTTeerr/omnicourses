import pg from 'pg';
import { describe, expect, it } from 'vitest';
import './data-source.js';

// Issue #174: a date column must reach the app as the day it holds, never as an instant.
describe('data source', () => {
  it('reads a PostgreSQL date as its YYYY-MM-DD text', () => {
    expect(pg.types.getTypeParser(pg.types.builtins.DATE)('2026-11-25')).toBe('2026-11-25');
  });
});
