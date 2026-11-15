import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { accountDeletionGraceDays, aiConfig, apiDocs, loadEnvFiles, port } from './env.js';

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

  it('defaults the AI provider to OpenRouter and accepts only allowlisted base URLs', () => {
    expect(aiConfig()).toMatchObject({ provider: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1', maxOutputTokens: 8192 });
    vi.stubEnv('AI_BASE_URL', ' https://api.anthropic.com/v1/ ');
    expect(aiConfig()).toMatchObject({ provider: 'anthropic', baseUrl: 'https://api.anthropic.com/v1/' });
    // No SSRF: any other host, scheme or path refuses to boot instead of sending the key there.
    for (const url of ['https://evil.example/v1', 'http://api.anthropic.com/v1/', 'https://api.anthropic.com/v1/../x', 'http://169.254.169.254/']) {
      vi.stubEnv('AI_BASE_URL', url);
      expect(() => aiConfig()).toThrow(/AI_BASE_URL must be one of/);
    }
  });

  it('reads the key from AI_API_KEY, falling back to OPENROUTER_API_KEY', () => {
    vi.stubEnv('AI_API_KEY', '');
    vi.stubEnv('OPENROUTER_API_KEY', 'old-name');
    expect(aiConfig().apiKey).toBe('old-name');
    vi.stubEnv('AI_API_KEY', 'new-name');
    expect(aiConfig().apiKey).toBe('new-name');
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

  it.each([
    [undefined, undefined, true],
    ['test', '', true],
    ['production', undefined, false],
    ['production', ' ', false],
    ['production', 'true', true],
    ['production', 'TRUE', true],
    ['development', 'false', false],
  ])('API docs with NODE_ENV=%j and API_DOCS=%j: %s', (env, flag, expected) => {
    vi.stubEnv('NODE_ENV', env);
    vi.stubEnv('API_DOCS', flag);
    expect(apiDocs()).toBe(expected);
  });
});
