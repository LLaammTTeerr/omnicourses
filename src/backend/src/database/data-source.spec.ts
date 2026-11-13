import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runCli } from './data-source.js';

const env = vi.hoisted(() => ({ loaded: false }));
const events = vi.hoisted(() => [] as string[]);
const fake = vi.hoisted(() => ({ failInitialize: false, options: undefined as unknown }));

vi.mock('../config/env.js', () => ({
  loadEnvFiles: () => {
    env.loaded = true;
  },
  // Like the real getter: only what the env files set once they are loaded.
  databaseUrl: () => (env.loaded ? 'postgres://from-env-file' : undefined),
}));

vi.mock('typeorm', async (importOriginal) => ({
  ...(await importOriginal<typeof import('typeorm')>()),
  DataSource: class {
    constructor(options: unknown) {
      fake.options = options;
    }
    async initialize() {
      events.push('initialize');
      if (fake.failInitialize) throw new Error('connection refused');
    }
    async destroy() {
      events.push('destroy');
    }
  },
}));

describe('runCli', () => {
  let exit: ReturnType<typeof vi.spyOn>;
  let printed: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    env.loaded = false;
    events.length = 0;
    fake.failInitialize = false;
    exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    printed = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => vi.restoreAllMocks());

  it('loads the env files before reading DATABASE_URL', async () => {
    await runCli(async () => undefined);
    expect(fake.options).toMatchObject({ type: 'postgres', url: 'postgres://from-env-file', synchronize: false });
  });

  it('runs the work on a connected data source, then disconnects', async () => {
    await runCli(async () => {
      events.push('work');
    });
    expect(events).toEqual(['initialize', 'work', 'destroy']);
    expect(exit).not.toHaveBeenCalled();
  });

  it('disconnects, prints only the message and exits 1 when the work fails', async () => {
    await runCli(async () => {
      throw new Error('Course catalog conflict');
    });
    expect(events).toEqual(['initialize', 'destroy']);
    expect(printed).toHaveBeenCalledWith('Course catalog conflict');
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('exits 1 without running the work when it cannot connect', async () => {
    fake.failInitialize = true;
    const work = vi.fn(async () => undefined);
    await runCli(work);
    expect(work).not.toHaveBeenCalled();
    expect(printed).toHaveBeenCalledWith('connection refused');
    expect(exit).toHaveBeenCalledWith(1);
  });
});
