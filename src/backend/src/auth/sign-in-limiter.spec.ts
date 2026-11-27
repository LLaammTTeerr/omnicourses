import { HttpException, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { hash } from '@node-rs/argon2';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Clock } from '../config/clock.js';
import { MINUTE_MS } from '../config/time.js';
import { User } from '../users/user.entity.js';
import { UsersService } from '../users/users.service.js';
import { ARGON2_OPTIONS, AuthService, signInAttemptKey } from './auth.service.js';
import { SignInAttempt } from './sign-in-attempt.entity.js';
import { SignInLimiter } from './sign-in-limiter.js';

function makeSignInAttemptRepo() {
  const rows: { attemptKey: string; attemptedAt: Date }[] = [];
  const locks = new Map<string, Promise<void>>();
  const queries: [string, unknown[]][] = [];

  return {
    rows,
    queries,
    query: vi.fn(async (sql: string, params: unknown[]) => {
      queries.push([sql, params]);
      const [cutoff, limit] = params as [Date, number];
      let purged = 0;
      for (let i = rows.length - 1; i >= 0 && purged < limit; i--) {
        if (rows[i]!.attemptedAt.getTime() <= cutoff.getTime()) {
          rows.splice(i, 1);
          purged++;
        }
      }
      return [];
    }),
    delete: vi.fn(async ({ attemptKey }: { attemptKey?: string }) => {
      for (let i = rows.length - 1; i >= 0; i--) {
        if (rows[i]!.attemptKey === attemptKey) rows.splice(i, 1);
      }
      return { affected: 1 };
    }),
    manager: {
      transaction: vi.fn(async <T>(work: (em: unknown) => Promise<T>): Promise<T> => {
        let lockedKey: string | null = null;
        let releaseLock = null as (() => void) | null;
        const em = {
          query: vi.fn(async (sql: string, params: unknown[]) => {
            queries.push([sql, params]);
            if (sql.includes('pg_advisory_xact_lock') && typeof params[1] === 'string' && !lockedKey) {
              lockedKey = params[1];
              const prev = locks.get(lockedKey) ?? Promise.resolve();
              const gate = new Promise<void>((resolve) => {
                releaseLock = resolve;
              });
              const tail = prev.then(() => gate);
              locks.set(lockedKey, tail);
              await prev;
            }
            return [];
          }),
          delete: vi.fn(async (_entity: unknown, criteria: { attemptKey: string; attemptedAt: { _value: Date } }) => {
            const cutoff = criteria.attemptedAt._value;
            for (let i = rows.length - 1; i >= 0; i--) {
              const row = rows[i]!;
              if (row.attemptKey === criteria.attemptKey && row.attemptedAt.getTime() <= cutoff.getTime()) rows.splice(i, 1);
            }
            return { affected: 1 };
          }),
          count: vi.fn(async (_entity: unknown, options: { where: { attemptKey: string; attemptedAt: { _value: Date } } }) => {
            const { attemptKey, attemptedAt } = options.where;
            return rows.filter(
              (r) => r.attemptKey === attemptKey && r.attemptedAt.getTime() > attemptedAt._value.getTime(),
            ).length;
          }),
          insert: vi.fn(async (_entity: unknown, row: { attemptKey: string; attemptedAt: Date }) => {
            rows.push({ attemptKey: row.attemptKey, attemptedAt: new Date(row.attemptedAt) });
            return { identifiers: [{ id: '1' }] };
          }),
        };
        try {
          return await work(em);
        } finally {
          releaseLock?.();
        }
      }),
    },
  };
}

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    email: 'student@example.com',
    passwordHash: null,
    displayName: 'Test Student',
    emailVerifiedAt: null,
    deletionRequestedAt: null,
    purgeAfter: null,
    createdAt: new Date(),
    ...overrides,
  } as User;
}

describe('SignInLimiter', () => {
  let sessions: {
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let signInAttempts: ReturnType<typeof makeSignInAttemptRepo>;
  let users: {
    findByEmailForAuth: ReturnType<typeof vi.fn>;
    cancelDeletion: ReturnType<typeof vi.fn>;
  };
  let currentNow: Date;
  let clock: Clock;
  let service: AuthService;

  beforeEach(() => {
    currentNow = new Date('2026-11-27T08:00:00Z');
    clock = { now: () => new Date(currentNow) };
    sessions = {
      create: vi.fn((fields: Record<string, unknown>) => fields),
      save: vi.fn(async (s: Record<string, unknown>) => s),
      delete: vi.fn(async () => ({ affected: 0 })),
    };
    signInAttempts = makeSignInAttemptRepo();
    users = {
      findByEmailForAuth: vi.fn(async () => null),
      cancelDeletion: vi.fn(async () => true),
    };
    service = new AuthService(
      sessions as never,
      new SignInLimiter(signInAttempts as unknown as never),
      users as unknown as UsersService,
      clock,
    );
  });

  it('throttles after 10 attempts per (clientIp, normalized email) before running Argon2, keeps other IPs unaffected, and resets on success or window expiry', async () => {
    const passwordHash = await hash('correct horse battery', ARGON2_OPTIONS);
    users.findByEmailForAuth.mockResolvedValue(makeUser({ passwordHash }));

    const parallel = await Promise.allSettled(
      Array.from({ length: 11 }, () =>
        service.signIn({ email: ' Student@Example.com ', password: 'wrong password!' }, 'vitest', '203.0.113.10'),
      ),
    );
    const statuses = parallel.map((outcome) =>
      outcome.status === 'rejected' && outcome.reason instanceof HttpException ? outcome.reason.getStatus() : 200,
    );
    expect(statuses.filter((code) => code === HttpStatus.UNAUTHORIZED)).toHaveLength(10);
    expect(statuses.filter((code) => code === HttpStatus.TOO_MANY_REQUESTS)).toHaveLength(1);
    expect(users.findByEmailForAuth).toHaveBeenCalledTimes(10);

    users.findByEmailForAuth.mockClear();
    const throttled = await service
      .signIn({ email: 'STUDENT@example.com', password: 'correct horse battery' }, 'vitest', '203.0.113.10')
      .catch((caught: unknown) => caught);
    expect(throttled).toBeInstanceOf(HttpException);
    expect((throttled as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect((throttled as HttpException).message).toBe(
      'Too many sign-in attempts for this account; try again in a minute',
    );
    expect(users.findByEmailForAuth).not.toHaveBeenCalled();

    users.findByEmailForAuth.mockResolvedValueOnce(makeUser({ passwordHash }));
    await expect(
      service.signIn({ email: 'student@example.com', password: 'correct horse battery' }, 'vitest', '198.51.100.42'),
    ).resolves.toMatchObject({ accountRestored: false });

    users.findByEmailForAuth.mockResolvedValueOnce(makeUser({ email: 'other@example.com', passwordHash }));
    await expect(
      service.signIn({ email: 'other@example.com', password: 'correct horse battery' }, 'vitest', '203.0.113.10'),
    ).resolves.toMatchObject({ accountRestored: false });

    currentNow = new Date(currentNow.getTime() + MINUTE_MS);
    users.findByEmailForAuth.mockResolvedValue(makeUser({ passwordHash }));
    await expect(
      service.signIn({ email: 'student@example.com', password: 'correct horse battery' }, 'vitest', '203.0.113.10'),
    ).resolves.toMatchObject({ accountRestored: false });

    for (let i = 0; i < 9; i++) {
      await expect(
        service.signIn({ email: 'student@example.com', password: 'wrong password!' }, 'vitest', '203.0.113.10'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    }
    await expect(
      service.signIn({ email: 'student@example.com', password: 'correct horse battery' }, 'vitest', '203.0.113.10'),
    ).resolves.toMatchObject({ accountRestored: false });
    for (let i = 0; i < 9; i++) {
      await expect(
        service.signIn({ email: 'student@example.com', password: 'wrong password!' }, 'vitest', '203.0.113.10'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    }
  });

  it('shares attempt counts across server instances via PostgreSQL without any 10,000-key global lockout', async () => {
    const passwordHash = await hash('correct horse battery', ARGON2_OPTIONS);
    users.findByEmailForAuth.mockResolvedValue(makeUser({ passwordHash }));
    const secondInstance = new AuthService(
      sessions as never,
      new SignInLimiter(signInAttempts as unknown as never),
      users as unknown as UsersService,
      clock,
    );

    for (let i = 0; i < 12_000; i++) {
      signInAttempts.rows.push({
        attemptKey: signInAttemptKey('198.51.100.99', `spray-${i}@example.com`),
        attemptedAt: new Date(currentNow),
      });
    }
    expect(signInAttempts.rows[0]!.attemptKey).not.toContain('@');
    expect(signInAttempts.rows[0]!.attemptKey).toHaveLength(64);

    await expect(
      service.signIn({ email: 'student@example.com', password: 'correct horse battery' }, 'vitest', '203.0.113.10'),
    ).resolves.toMatchObject({ accountRestored: false });

    for (let i = 0; i < 6; i++) {
      await expect(
        service.signIn({ email: 'student@example.com', password: 'wrong password!' }, 'vitest', '203.0.113.10'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    }
    for (let i = 0; i < 4; i++) {
      await expect(
        secondInstance.signIn({ email: 'student@example.com', password: 'wrong password!' }, 'vitest', '203.0.113.10'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    }
    await expect(
      secondInstance.signIn({ email: 'student@example.com', password: 'correct horse battery' }, 'vitest', '203.0.113.10'),
    ).rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS });
    expect(SignInAttempt.name).toBe('SignInAttempt');
  });

  it('prunes only its own key under the advisory lock and purges other expired keys in small SKIP LOCKED batches outside it', async () => {
    const passwordHash = await hash('correct horse battery', ARGON2_OPTIONS);
    users.findByEmailForAuth.mockResolvedValue(makeUser({ passwordHash }));
    const expired = new Date(currentNow.getTime() - 2 * MINUTE_MS);
    for (let i = 0; i < 150; i++) {
      signInAttempts.rows.push({ attemptKey: signInAttemptKey('198.51.100.7', `old-${i}@example.com`), attemptedAt: expired });
    }

    await expect(
      service.signIn({ email: 'student@example.com', password: 'wrong password!' }, 'vitest', '203.0.113.10'),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    const purge = signInAttempts.queries.find(([sql]) => sql.includes('SKIP LOCKED'));
    expect(purge?.[0]).toContain('LIMIT $2');
    expect(purge?.[1]).toEqual([new Date(currentNow.getTime() - MINUTE_MS), 100]);
    expect(signInAttempts.rows.filter((row) => row.attemptedAt.getTime() === expired.getTime())).toHaveLength(50);
  });
});
