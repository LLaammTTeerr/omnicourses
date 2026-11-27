import { createHash, randomBytes } from 'node:crypto';
import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Algorithm, hash, verify } from '@node-rs/argon2';
import { EntityManager, IsNull, LessThanOrEqual, MoreThan, Repository } from 'typeorm';
import { NAMESPACED_LOCKS } from '../common/advisory-locks.js';
import { isRefusal, SQLSTATE } from '../common/failure-kind.js';
import { Clock } from '../config/clock.js';
import { sessionTtlDays } from '../config/env.js';
import { DAY_MS, MINUTE_MS } from '../config/time.js';
import { isWaitingForDeletion } from '../users/account-state.js';
import { UserDto } from '../users/user.dto.js';
import { User } from '../users/user.entity.js';
import { UsersService } from '../users/users.service.js';
import { AuthResultDto, SessionDto, SignInDto, SignUpDto } from './auth.dto.js';
import { Session, USER_AGENT_MAX_LENGTH } from './session.entity.js';
import { SignInAttempt } from './sign-in-attempt.entity.js';

const SESSION_TOKEN_BYTES = 32;
export const MAX_SESSION_LIFETIME_DAYS = 30;
const MAX_FAILED_SIGN_INS = 10;
const FAILED_SIGN_IN_WINDOW_MS = MINUTE_MS;
const SIGN_IN_ATTEMPT_PURGE_BATCH = 100;

export const ARGON2_OPTIONS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

const hashPassword = (password: string): Promise<string> => hash(password, ARGON2_OPTIONS);

export const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

export const signInAttemptKey = (clientIp: string | undefined, email: string): string =>
  hashToken(`${clientIp?.trim() || 'unknown'}\u0000${email.trim().toLowerCase()}`);

@Injectable()
export class AuthService {
  private readonly dummyHash = hashPassword('omnicourse-timing-equalizer');

  constructor(
    @InjectRepository(Session) private readonly sessions: Repository<Session>,
    @InjectRepository(SignInAttempt) private readonly signInAttempts: Repository<SignInAttempt>,
    private readonly users: UsersService,
    private readonly clock: Clock,
  ) {}

  async signUp(dto: SignUpDto, userAgent?: string): Promise<AuthResultDto> {
    const taken = () => new ConflictException('An account with this email already exists');
    const passwordHash = await hashPassword(dto.password);
    if (await this.users.findByEmail(dto.email)) throw taken();
    const now = this.clock.now();
    const user = await this.users
      .create({
        email: dto.email,
        passwordHash,
        displayName: dto.displayName,
        consentAt: now,
      })
      .catch((error: unknown) => {
        throw isEmailTaken(error) ? taken() : error;
      });
    return { ...(await this.issue(user, userAgent, now)), accountRestored: false };
  }

  async signIn(dto: SignInDto, userAgent?: string, clientIp?: string): Promise<AuthResultDto> {
    const now = this.clock.now();
    const attemptKey = signInAttemptKey(clientIp, dto.email);
    await this.reserveSignInAttempt(attemptKey, now);

    const user = await this.users.findByEmailForAuth(dto.email);
    const valid = user?.passwordHash
      ? await verify(user.passwordHash, dto.password)
      : (await verify(await this.dummyHash, dto.password), false);
    if (!user || !valid) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const accountRestored = isWaitingForDeletion(user);
    if (accountRestored && !(await this.users.cancelDeletion(user.id, now))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    await this.signInAttempts.delete({ attemptKey });
    return { ...(await this.issue(user, userAgent, now)), accountRestored };
  }

  async verifyPassword(user: User, password: string): Promise<boolean> {
    const passwordHash = user.passwordHash ?? (await this.users.findPasswordHash(user.id));
    return passwordHash ? verify(passwordHash, password) : false;
  }

  async revokeAllWithin(manager: EntityManager, userId: string): Promise<void> {
    await manager.update(Session, { userId, revokedAt: IsNull() }, { revokedAt: this.clock.now() });
  }

  async authenticate(token: string): Promise<{ user: User; session: Session } | null> {
    const session = await this.sessions.findOne({
      where: { tokenHash: hashToken(token) },
      relations: { user: true },
    });
    const now = this.clock.now();
    if (!session || session.revokedAt || session.expiresAt.getTime() <= now.getTime()) return null;
    if (session.createdAt && session.createdAt.getTime() + maxSessionLifetimeMs() <= now.getTime()) return null;
    if (isWaitingForDeletion(session.user)) return null;
    return { user: session.user, session };
  }

  async authenticateHeader(authorization: string | string[] | undefined): Promise<{ user: User; session: Session } | null> {
    const token = bearerToken(authorization);
    return token ? this.authenticate(token) : null;
  }

  async refresh(session: Session): Promise<AuthResultDto> {
    const now = this.clock.now();
    const maxExpiresAt = session.createdAt ? session.createdAt.getTime() + maxSessionLifetimeMs() : Infinity;
    const expiresAt = new Date(Math.min(sessionExpiry(now).getTime(), maxExpiresAt));
    if (expiresAt.getTime() <= now.getTime()) throw new UnauthorizedException('Session expired');
    const token = newToken();
    await this.sessions.update(session.id, { tokenHash: hashToken(token), rotatedAt: now, expiresAt });
    return { token, expiresAt, user: UserDto.from(session.user), accountRestored: false };
  }

  async signOut(session: Session): Promise<void> {
    await this.sessions.update(session.id, { revokedAt: this.clock.now() });
  }

  async listSessions(userId: string, currentId: string): Promise<SessionDto[]> {
    const now = this.clock.now();
    const maxLifetimeMs = maxSessionLifetimeMs();
    const live = await this.sessions.find({
      where: { userId, revokedAt: IsNull(), expiresAt: MoreThan(now) },
      order: { createdAt: 'DESC' },
    });
    return live
      .filter((session) => !session.createdAt || session.createdAt.getTime() + maxLifetimeMs > now.getTime())
      .map((session) => ({
        id: session.id,
        userAgent: session.userAgent,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        current: session.id === currentId,
      }));
  }

  async revoke(userId: string, sessionId: string): Promise<void> {
    const result = await this.sessions.update({ id: sessionId, userId, revokedAt: IsNull() }, { revokedAt: this.clock.now() });
    if (!result.affected) throw new NotFoundException('Session not found');
  }

  private async issue(user: User, userAgent?: string, now = this.clock.now()): Promise<Omit<AuthResultDto, 'accountRestored'>> {
    await this.sessions.delete({ userId: user.id, expiresAt: LessThanOrEqual(now) });
    const token = newToken();
    const expiresAt = sessionExpiry(now);
    await this.sessions.save(
      this.sessions.create({
        userId: user.id,
        tokenHash: hashToken(token),
        userAgent: userAgent?.slice(0, USER_AGENT_MAX_LENGTH) ?? null,
        createdAt: now,
        expiresAt,
      }),
    );
    return { token, expiresAt, user: UserDto.from(user) };
  }

  private async reserveSignInAttempt(attemptKey: string, now: Date): Promise<void> {
    const cutoff = new Date(now.getTime() - FAILED_SIGN_IN_WINDOW_MS);
    await this.signInAttempts.manager.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock($1, hashtext($2))', [
        NAMESPACED_LOCKS.signInAttempt,
        attemptKey,
      ]);
      await manager.delete(SignInAttempt, { attemptKey, attemptedAt: LessThanOrEqual(cutoff) });
      const activeCount = await manager.count(SignInAttempt, {
        where: { attemptKey, attemptedAt: MoreThan(cutoff) },
      });
      if (activeCount >= MAX_FAILED_SIGN_INS) {
        throw new HttpException(
          'Too many sign-in attempts for this account; try again in a minute',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      await manager.insert(SignInAttempt, { attemptKey, attemptedAt: now });
    });
    await this.purgeExpiredSignInAttempts(cutoff);
  }

  private async purgeExpiredSignInAttempts(cutoff: Date): Promise<void> {
    await this.signInAttempts.query(
      `DELETE FROM "sign_in_attempts" WHERE "id" IN (
        SELECT "id" FROM "sign_in_attempts" WHERE "attempted_at" <= $1
        LIMIT $2 FOR UPDATE SKIP LOCKED
      )`,
      [cutoff, SIGN_IN_ATTEMPT_PURGE_BATCH],
    );
  }
}

const isEmailTaken = (error: unknown): boolean =>
  isRefusal(error, [SQLSTATE.uniqueViolation]);

function bearerToken(header: string | string[] | undefined): string | null {
  if (typeof header !== 'string') return null;
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}

function maxSessionLifetimeMs(): number {
  return Math.max(MAX_SESSION_LIFETIME_DAYS, sessionTtlDays()) * DAY_MS;
}

function sessionExpiry(issuedAt: Date): Date {
  return new Date(issuedAt.getTime() + sessionTtlDays() * DAY_MS);
}

function newToken(): string {
  return randomBytes(SESSION_TOKEN_BYTES).toString('base64url');
}
