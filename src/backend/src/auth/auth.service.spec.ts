import { ConflictException, HttpException, HttpStatus, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Algorithm, hash, parseOptions, verify } from '@node-rs/argon2';
import { QueryFailedError } from 'typeorm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Clock } from '../config/clock.js';
import { DAY_MS, MINUTE_MS } from '../config/time.js';
import { User } from '../users/user.entity.js';
import { UsersService } from '../users/users.service.js';
import { ARGON2_OPTIONS, AuthService, hashToken, MAX_SESSION_LIFETIME_DAYS } from './auth.service.js';
import { Session } from './session.entity.js';


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

function makeSession(overrides: Partial<Session> = {}): Session {
  const user = makeUser();
  return {
    id: '00000000-0000-4000-8000-0000000000aa',
    userId: user.id,
    user,
    tokenHash: hashToken('token'),
    expiresAt: new Date(Date.now() + DAY_MS),
    revokedAt: null,
    ...overrides,
  } as Session;
}

describe('AuthService', () => {
  let sessions: {
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    find: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let users: {
    findByEmail: ReturnType<typeof vi.fn>;
    findByEmailForAuth: ReturnType<typeof vi.fn>;
    findPasswordHash: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    cancelDeletion: ReturnType<typeof vi.fn>;
  };
  let currentNow: Date;
  let clock: Clock;
  let service: AuthService;

  beforeEach(() => {
    currentNow = new Date('2026-11-27T08:00:00Z');
    clock = { now: () => new Date(currentNow) };
    sessions = {
      create: vi.fn((fields: Partial<Session>) => fields),
      save: vi.fn(async (s: Partial<Session>) => s),
      findOne: vi.fn(),
      update: vi.fn(async () => ({ affected: 1 })),
      find: vi.fn(async () => []),
      delete: vi.fn(async () => ({ affected: 0 })),
    };
    users = {
      findByEmail: vi.fn(async () => null),
      findByEmailForAuth: vi.fn(async () => null),
      findPasswordHash: vi.fn(async () => null),
      create: vi.fn(async (f: Partial<User>) => makeUser(f)),
      cancelDeletion: vi.fn(async () => true),
    };
    service = new AuthService(sessions as never, users as unknown as UsersService, clock);
  });

  describe('signUp', () => {
    it('stores an explicit argon2id hash (m=19456, t=2, p=1), never the password, and records consent', async () => {
      const result = await service.signUp(
        { email: 'student@example.com', password: 'correct horse battery', displayName: 'Test Student', acceptedTerms: true },
        'vitest',
      );
      const stored = users.create.mock.calls[0]![0] as User;
      expect(stored.passwordHash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
      expect(parseOptions(stored.passwordHash!)).toMatchObject({
        algorithm: Algorithm.Argon2id,
        memoryCost: ARGON2_OPTIONS.memoryCost,
        timeCost: ARGON2_OPTIONS.timeCost,
        parallelism: ARGON2_OPTIONS.parallelism,
      });
      expect(await verify(stored.passwordHash!, 'correct horse battery')).toBe(true);
      expect(stored.consentAt).toBeInstanceOf(Date);
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('stores only the SHA-256 of the issued token, sets createdAt from Clock, and cleans up expired sessions', async () => {
      const result = await service.signUp(
        { email: 'student@example.com', password: 'correct horse battery', displayName: 'Test Student', acceptedTerms: true },
      );
      const saved = sessions.save.mock.calls[0]![0] as Session;
      expect(saved.tokenHash).toBe(hashToken(result.token));
      expect(saved.createdAt).toEqual(currentNow);
      expect(sessions.delete).toHaveBeenCalledOnce();
    });

    it('rejects an email that is already registered', async () => {
      users.findByEmail.mockResolvedValue(makeUser());
      await expect(
        service.signUp({ email: 'student@example.com', password: 'correct horse battery', displayName: 'X', acceptedTerms: true }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('answers 409, not 500, when a concurrent sign-up took the email first', async () => {
      const duplicate = Object.assign(new Error('duplicate key'), { code: '23505', constraint: 'uq_users_email' });
      users.create.mockRejectedValueOnce(new QueryFailedError('INSERT INTO "users"', [], duplicate));
      await expect(
        service.signUp({ email: 'student@example.com', password: 'correct horse battery', displayName: 'X', acceptedTerms: true }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(sessions.save).not.toHaveBeenCalled();
    });

    it('lets any other database error through', async () => {
      const failure = new QueryFailedError('INSERT INTO "users"', [], Object.assign(new Error('check'), { code: '23514' }));
      users.create.mockRejectedValueOnce(failure);
      await expect(
        service.signUp({ email: 'student@example.com', password: 'correct horse battery', displayName: 'X', acceptedTerms: true }),
      ).rejects.toBe(failure);
    });
  });

  describe('session lifetime', () => {
    afterEach(() => vi.unstubAllEnvs());

    const issuedFor = async (ttlDays: string): Promise<number> => {
      vi.stubEnv('SESSION_TTL_DAYS', ttlDays);
      const issuedAt = new Date('2026-11-26T03:00:00Z');
      const { expiresAt } = await new AuthService(sessions as never, users as unknown as UsersService, { now: () => new Date(issuedAt) } as Clock).signUp(
        { email: 'student@example.com', password: 'correct horse battery', displayName: 'Test Student', acceptedTerms: true },
      );
      return expiresAt.getTime() - issuedAt.getTime();
    };

    it('lasts SESSION_TTL_DAYS days, including multi-semester values above 30 days', async () => {
      expect(await issuedFor('3')).toBe(3 * DAY_MS);
      expect(await issuedFor('1000')).toBe(1000 * DAY_MS);
    });

    it.each(['', ' ', 'abc', '0'])('lasts 7 days when SESSION_TTL_DAYS is %j', async (value) => {
      expect(await issuedFor(value)).toBe(7 * DAY_MS);
    });
  });

  describe('signIn', () => {
    it('rejects a wrong password and an unknown email with the same error', async () => {
      const passwordHash = (await service.signUp(
        { email: 'student@example.com', password: 'correct horse battery', displayName: 'X', acceptedTerms: true },
      ), (users.create.mock.calls[0]![0] as User).passwordHash);
      users.findByEmailForAuth.mockResolvedValueOnce(makeUser({ passwordHash }));
      const wrongPassword = service.signIn({ email: 'student@example.com', password: 'wrong password!' });
      await expect(wrongPassword).rejects.toThrow(new UnauthorizedException('Invalid email or password'));

      users.findByEmailForAuth.mockResolvedValueOnce(null);
      const unknownEmail = service.signIn({ email: 'nobody@example.com', password: 'whatever123' });
      await expect(unknownEmail).rejects.toThrow(new UnauthorizedException('Invalid email or password'));
    });

    it('cancels a pending deletion and says so', async () => {
      const passwordHash = await hash('correct horse battery');
      users.findByEmailForAuth.mockResolvedValueOnce(makeUser({ passwordHash, deletionRequestedAt: new Date() }));
      const result = await service.signIn({ email: 'student@example.com', password: 'correct horse battery' });
      expect(result.accountRestored).toBe(true);
      expect(users.cancelDeletion).toHaveBeenCalledWith(makeUser().id, expect.any(Date));
    });

    it('refuses, without issuing a session, when the deletion can no longer be cancelled', async () => {
      const passwordHash = await hash('correct horse battery');
      users.findByEmailForAuth.mockResolvedValueOnce(
        makeUser({ passwordHash, deletionRequestedAt: new Date(currentNow.getTime() - 31 * DAY_MS), purgeAfter: new Date(currentNow.getTime() - DAY_MS) }),
      );
      users.cancelDeletion.mockResolvedValueOnce(false);
      await expect(service.signIn({ email: 'student@example.com', password: 'correct horse battery' })).rejects.toThrow(
        new UnauthorizedException('Invalid email or password'),
      );
      expect(sessions.save).not.toHaveBeenCalled();
    });

    it('does not touch deletion state on a normal sign-in', async () => {
      users.findByEmailForAuth.mockResolvedValueOnce(makeUser({ passwordHash: await hash('correct horse battery') }));
      const result = await service.signIn({ email: 'student@example.com', password: 'correct horse battery' });
      expect(result.accountRestored).toBe(false);
      expect(users.cancelDeletion).not.toHaveBeenCalled();
    });

    it('throttles after 10 failed sign-in attempts per normalized email within 60s without running Argon2, and resets after success or window expiry', async () => {
      const passwordHash = await hash('correct horse battery', ARGON2_OPTIONS);
      users.findByEmailForAuth.mockResolvedValue(makeUser({ passwordHash }));

      for (let i = 0; i < 10; i++) {
        await expect(
          service.signIn({ email: ' Student@Example.com ', password: 'wrong password!' }),
        ).rejects.toBeInstanceOf(UnauthorizedException);
      }

      users.findByEmailForAuth.mockClear();
      const throttled = await service
        .signIn({ email: 'STUDENT@example.com', password: 'correct horse battery' })
        .catch((caught: unknown) => caught);
      expect(throttled).toBeInstanceOf(HttpException);
      expect((throttled as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect((throttled as HttpException).message).toBe(
        'Too many sign-in attempts for this account; try again in a minute',
      );
      expect(users.findByEmailForAuth).not.toHaveBeenCalled();

      users.findByEmailForAuth.mockResolvedValueOnce(makeUser({ email: 'other@example.com', passwordHash }));
      await expect(
        service.signIn({ email: 'other@example.com', password: 'correct horse battery' }),
      ).resolves.toMatchObject({ accountRestored: false });

      currentNow = new Date(currentNow.getTime() + MINUTE_MS);
      users.findByEmailForAuth.mockResolvedValue(makeUser({ passwordHash }));
      await expect(
        service.signIn({ email: 'student@example.com', password: 'correct horse battery' }),
      ).resolves.toMatchObject({ accountRestored: false });

      for (let i = 0; i < 9; i++) {
        await expect(
          service.signIn({ email: 'student@example.com', password: 'wrong password!' }),
        ).rejects.toBeInstanceOf(UnauthorizedException);
      }
      await expect(
        service.signIn({ email: 'student@example.com', password: 'correct horse battery' }),
      ).resolves.toMatchObject({ accountRestored: false });
      for (let i = 0; i < 9; i++) {
        await expect(
          service.signIn({ email: 'student@example.com', password: 'wrong password!' }),
        ).rejects.toBeInstanceOf(UnauthorizedException);
      }
    });
  });

  describe('verifyPassword', () => {
    it('accepts the right password and rejects a wrong one or a password-less account', async () => {
      const user = makeUser({ passwordHash: await hash('correct horse battery') });
      await expect(service.verifyPassword(user, 'correct horse battery')).resolves.toBe(true);
      await expect(service.verifyPassword(user, 'wrong password!')).resolves.toBe(false);
      await expect(service.verifyPassword(makeUser({ passwordHash: null }), 'anything')).resolves.toBe(false);
    });

    it('loads passwordHash via UsersService.findPasswordHash when omitted on request.user', async () => {
      const storedHash = await hash('correct horse battery', ARGON2_OPTIONS);
      const userWithoutHash = makeUser({ passwordHash: undefined as unknown as null });
      users.findPasswordHash.mockResolvedValueOnce(storedHash);
      await expect(service.verifyPassword(userWithoutHash, 'correct horse battery')).resolves.toBe(true);
      expect(users.findPasswordHash).toHaveBeenCalledWith(userWithoutHash.id);

      users.findPasswordHash.mockResolvedValueOnce(storedHash);
      await expect(service.verifyPassword(userWithoutHash, 'wrong password!')).resolves.toBe(false);
    });
  });

  describe('authenticate', () => {
    it('returns the user for a live session', async () => {
      const session = makeSession({ createdAt: new Date(currentNow.getTime() - DAY_MS), expiresAt: new Date(currentNow.getTime() + DAY_MS) });
      sessions.findOne.mockResolvedValue(session);
      await expect(service.authenticate('token')).resolves.toEqual({ user: session.user, session });
    });

    it.each([
      ['unknown', () => null],
      ['expired', (now: Date) => makeSession({ expiresAt: new Date(now.getTime() - 1) })],
      ['revoked', (now: Date) => makeSession({ expiresAt: new Date(now.getTime() + DAY_MS), revokedAt: new Date(now) })],
      ['pending-deletion', (now: Date) => makeSession({ expiresAt: new Date(now.getTime() + DAY_MS), user: makeUser({ deletionRequestedAt: new Date(now) }) })],
      [
        'beyond 30-day max lifetime',
        (now: Date) =>
          makeSession({
            createdAt: new Date(now.getTime() - MAX_SESSION_LIFETIME_DAYS * DAY_MS),
            expiresAt: new Date(now.getTime() + DAY_MS),
          }),
      ],
    ])('returns null for an %s session', async (_, build) => {
      sessions.findOne.mockResolvedValue(build(currentNow));
      await expect(service.authenticate('token')).resolves.toBeNull();
    });
  });

  describe('refresh', () => {
    it('retires the old token at once and gives a new one a full lifetime', async () => {
      const session = makeSession({
        createdAt: new Date(currentNow.getTime() - DAY_MS),
        expiresAt: new Date(currentNow.getTime() + 1000),
      });
      sessions.findOne.mockImplementation(async ({ where }: { where: { tokenHash: string } }) => (where.tokenHash === session.tokenHash ? session : null));
      sessions.update.mockImplementation(async (_id: string, changes: Partial<Session>) => Object.assign(session, changes));

      const result = await service.refresh(session);
      await expect(service.authenticate('token')).resolves.toBeNull();
      await expect(service.authenticate(result.token)).resolves.toMatchObject({ session: { id: session.id } });
      expect(session.expiresAt.getTime()).toBeGreaterThan(currentNow.getTime() + 6 * DAY_MS);
    });

    it('caps refreshed expiry at 30 days from session.createdAt and rejects once 30 days have elapsed', async () => {
      const createdAt = new Date(currentNow.getTime() - 26 * DAY_MS);
      const session = makeSession({
        createdAt,
        expiresAt: new Date(currentNow.getTime() + DAY_MS),
      });

      const capped = await service.refresh(session);
      expect(capped.expiresAt.getTime()).toBe(createdAt.getTime() + MAX_SESSION_LIFETIME_DAYS * DAY_MS);
      expect(sessions.update).toHaveBeenCalledWith(
        session.id,
        expect.objectContaining({ expiresAt: new Date(createdAt.getTime() + MAX_SESSION_LIFETIME_DAYS * DAY_MS) }),
      );

      sessions.update.mockClear();
      currentNow = new Date(createdAt.getTime() + MAX_SESSION_LIFETIME_DAYS * DAY_MS);
      await expect(service.refresh(session)).rejects.toThrow(new UnauthorizedException('Session expired'));
      expect(sessions.update).not.toHaveBeenCalled();
    });
  });

  describe('revoke', () => {
    it('only touches sessions owned by the caller', async () => {
      await service.revoke('user-1', 'session-1');
      expect(sessions.update.mock.calls[0]![0]).toMatchObject({ id: 'session-1', userId: 'user-1' });
    });

    it('404s when nothing matched', async () => {
      sessions.update.mockResolvedValue({ affected: 0 });
      await expect(service.revoke('user-1', 'session-1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
