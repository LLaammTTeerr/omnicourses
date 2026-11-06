import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { accountDeletionGraceDays, aiConfig, loadEnvFiles, port } from './env.js';

describe('loadEnvFiles', () => {
  const cwd = process.cwd();
  afterEach(() => {
    process.chdir(cwd);
    vi.unstubAllEnvs();
  });

  it('loads both files, without overriding a variable already set or the first file', () => {
    const root = mkdtempSync(join(tmpdir(), 'env-'));
    const backend = join(root, 'src', 'backend');
    mkdirSync(backend, { recursive: true });
    writeFileSync(join(backend, '.env'), 'ENV_SPEC_A=backend\n');
    writeFileSync(join(root, '.env'), 'ENV_SPEC_A=root\nENV_SPEC_B=root\nENV_SPEC_C=root\n');
    vi.stubEnv('ENV_SPEC_A', undefined);
    vi.stubEnv('ENV_SPEC_B', undefined);
    vi.stubEnv('ENV_SPEC_C', 'shell');
    process.chdir(backend);
    loadEnvFiles();
    expect([process.env.ENV_SPEC_A, process.env.ENV_SPEC_B, process.env.ENV_SPEC_C]).toEqual(['backend', 'root', 'shell']);
  });

  it('skips a missing file', () => {
    process.chdir(mkdtempSync(join(tmpdir(), 'env-')));
    expect(() => loadEnvFiles()).not.toThrow();
  });
});

describe('settings', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('reads positive whole numbers from the environment', () => {
    vi.stubEnv('AI_TIMEOUT_MS', '5000');
    vi.stubEnv('AI_DAILY_CALLS_PER_USER', '3');
    vi.stubEnv('ACCOUNT_DELETION_GRACE_DAYS', '7');
    vi.stubEnv('PORT', '4000');
    expect(aiConfig()).toMatchObject({ timeoutMs: 5000, dailyCallsPerUser: 3 });
    expect(accountDeletionGraceDays()).toBe(7);
    expect(port()).toBe(4000);
  });

  // '' would read as 0 (a 0 ms timeout, purge at once, a random port) and a typo as NaN (a cap that never triggers).
  it.each(['', ' ', 'abc', '0', '-1', '1.5'])('falls back to the defaults when a number is %j', (value) => {
    vi.stubEnv('AI_TIMEOUT_MS', value);
    vi.stubEnv('AI_DAILY_CALLS_PER_USER', value);
    vi.stubEnv('ACCOUNT_DELETION_GRACE_DAYS', value);
    vi.stubEnv('PORT', value);
    expect(aiConfig()).toMatchObject({ timeoutMs: 30_000, dailyCallsPerUser: 20 });
    expect(accountDeletionGraceDays()).toBe(30);
    expect(port()).toBe(3000);
  });
});
