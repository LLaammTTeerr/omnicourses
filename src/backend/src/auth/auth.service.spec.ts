import { ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { verify } from '@node-rs/argon2';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { User } from '../users/user.entity.js';
import { UsersService } from '../users/users.service.js';
import { AuthService, hashToken } from './auth.service.js';
import { Session } from './session.entity.js';

const DAY = 86_400_000;

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    email: 'student@example.com',
    passwordHash: null,
    displayName: 'Test Student',
    googleSub: null,
    emailVerifiedAt: null,
    consentAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeSession(overrides: Partial<Session> = {}): Session {
  const user = makeUser();
  return {
    id: '00000000-0000-4000-8000-0000000000aa',
    userId: user.id,
    user,
    tokenHash: hashToken('token'),
    userAgent: null,
    createdAt: new Date(),
    rotatedAt: null,
    expiresAt: new Date(Date.now() + DAY),
    revokedAt: null,
    ...overrides,
  };
}

describe('AuthService', () => {
  let sessions: { create: ReturnType<typeof vi.fn>; save: ReturnType<typeof vi.fn>; findOne: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn>; find: ReturnType<typeof vi.fn> };
  let users: { findByEmail: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  let service: AuthService;

  beforeEach(() => {
    sessions = {
      create: vi.fn((fields: Partial<Session>) => fields),
      save: vi.fn(async (s: Partial<Session>) => s),
      findOne: vi.fn(),
      update: vi.fn(async () => ({ affected: 1 })),
      find: vi.fn(async () => []),
    };
    users = { findByEmail: vi.fn(async () => null), create: vi.fn(async (f: Partial<User>) => makeUser(f)) };
    service = new AuthService(sessions as never, users as unknown as UsersService);
  });

  describe('signUp', () => {
    it('stores an argon2id hash, never the password, and records consent', async () => {
      const result = await service.signUp(
        { email: 'student@example.com', password: 'correct horse battery', displayName: 'Test Student', acceptedTerms: true },
        'vitest',
      );
      const stored = users.create.mock.calls[0]![0] as User;
      expect(stored.passwordHash).toMatch(/^\$argon2id\$/);
      expect(await verify(stored.passwordHash!, 'correct horse battery')).toBe(true);
      expect(stored.consentAt).toBeInstanceOf(Date);
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('stores only the SHA-256 of the issued token', async () => {
      const result = await service.signUp(
        { email: 'student@example.com', password: 'correct horse battery', displayName: 'Test Student', acceptedTerms: true },
      );
      const saved = sessions.save.mock.calls[0]![0] as Session;
      expect(saved.tokenHash).toBe(hashToken(result.token));
      expect(saved.tokenHash).not.toContain(result.token);
    });

    it('rejects an email that is already registered', async () => {
      users.findByEmail.mockResolvedValue(makeUser());
      await expect(
        service.signUp({ email: 'student@example.com', password: 'correct horse battery', displayName: 'X', acceptedTerms: true }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('signIn', () => {
    it('rejects a wrong password and an unknown email with the same error', async () => {
      const passwordHash = (await service.signUp(
        { email: 'student@example.com', password: 'correct horse battery', displayName: 'X', acceptedTerms: true },
      ), (users.create.mock.calls[0]![0] as User).passwordHash);
      users.findByEmail.mockResolvedValueOnce(makeUser({ passwordHash }));
      const wrongPassword = service.signIn({ email: 'student@example.com', password: 'wrong password!' });
      await expect(wrongPassword).rejects.toThrow(new UnauthorizedException('Invalid email or password'));

      users.findByEmail.mockResolvedValueOnce(null);
      const unknownEmail = service.signIn({ email: 'nobody@example.com', password: 'whatever123' });
      await expect(unknownEmail).rejects.toThrow(new UnauthorizedException('Invalid email or password'));
    });
  });

  describe('authenticate', () => {
    it('returns the user for a live session', async () => {
      const session = makeSession();
      sessions.findOne.mockResolvedValue(session);
      await expect(service.authenticate('token')).resolves.toEqual({ user: session.user, session });
      expect(sessions.findOne.mock.calls[0]![0].where).toEqual({ tokenHash: hashToken('token') });
    });

    it.each([
      ['unknown', null],
      ['expired', makeSession({ expiresAt: new Date(Date.now() - 1) })],
      ['revoked', makeSession({ revokedAt: new Date() })],
    ])('returns null for an %s session', async (_, session) => {
      sessions.findOne.mockResolvedValue(session);
      await expect(service.authenticate('token')).resolves.toBeNull();
    });
  });

  describe('refresh', () => {
    it('replaces the token hash and pushes the expiry forward', async () => {
      const session = makeSession({ expiresAt: new Date(Date.now() + 1000) });
      const result = await service.refresh(session);
      const [id, changes] = sessions.update.mock.calls[0]!;
      expect(id).toBe(session.id);
      expect(changes.tokenHash).toBe(hashToken(result.token));
      expect(changes.tokenHash).not.toBe(session.tokenHash);
      expect(changes.expiresAt.getTime()).toBeGreaterThan(Date.now() + 6 * DAY);
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
