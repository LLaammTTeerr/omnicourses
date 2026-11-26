import { DataSource, QueryRunner } from 'typeorm';
import { expect, vi } from 'vitest';

export const STILL_WAITING = 'still waiting';

export async function backendPid(runner: QueryRunner): Promise<number> {
  const [{ pid }] = await runner.query('SELECT pg_backend_pid() AS pid');
  return pid;
}

export async function waitUntilBlockedBy(db: DataSource, pid: number): Promise<void> {
  await vi.waitFor(async () => {
    const [{ waiting }] = await db.query('SELECT count(*)::int AS waiting FROM pg_stat_activity WHERE $1 = ANY(pg_blocking_pids(pid))', [pid]);
    expect(waiting).toBeGreaterThan(0);
  });
}

export async function within<T>(work: Promise<T>, limitMs: number): Promise<T | typeof STILL_WAITING> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limit = new Promise<typeof STILL_WAITING>((resolve) => {
    timer = setTimeout(() => resolve(STILL_WAITING), limitMs);
  });
  try {
    return await Promise.race([work, limit]);
  } finally {
    clearTimeout(timer);
  }
}
