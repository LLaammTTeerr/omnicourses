import { createHash, randomBytes } from 'node:crypto';
import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { hash, verify } from '@node-rs/argon2';
import { EntityManager, IsNull, MoreThan, QueryFailedError, Repository } from 'typeorm';
import { sessionTtlDays } from '../config/env.js';
import { DAY_MS } from '../config/time.js';
import { UserDto } from '../users/user.dto.js';
import { isPendingDeletion, User } from '../users/user.entity.js';
import { UsersService } from '../users/users.service.js';
import { AuthResultDto, SessionDto, SignInDto, SignUpDto } from './auth.dto.js';
import { Session, SESSION_USER_AGENT_MAX } from './session.entity.js';

export const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

@Injectable()
export class AuthService {
  // Verified against when the email is unknown, so a wrong email and a wrong
  // password take the same time and the response does not reveal which.
  private readonly dummyHash = hash('omnicourse-timing-equalizer');

  constructor(
    @InjectRepository(Session) private readonly sessions: Repository<Session>,
    private readonly users: UsersService,
  ) {}

  async signUp(dto: SignUpDto, userAgent?: string): Promise<AuthResultDto> {
    const taken = () => new ConflictException('An account with this email already exists');
    if (await this.users.findByEmail(dto.email)) throw taken();
    // Two sign-ups can both pass the lookup; the unique email decides, and the
    // loser gets the same 409 (a 500 would also log the row, hash included).
    const user = await this.users
      .create({
        email: dto.email,
        passwordHash: await hash(dto.password),
        displayName: dto.displayName,
        consentAt: new Date(),
      })
      .catch((error: unknown) => {
        throw isUniqueViolation(error) ? taken() : error;
      });
    return { ...(await this.issue(user, userAgent)), accountRestored: false };
  }

  async signIn(dto: SignInDto, userAgent?: string): Promise<AuthResultDto> {
    const user = await this.users.findByEmail(dto.email);
    const valid = user?.passwordHash
      ? await verify(user.passwordHash, dto.password)
      : (await verify(await this.dummyHash, dto.password), false);
    if (!user || !valid) throw new UnauthorizedException('Invalid email or password');
    // Signing in before the stored deadline is how a student undoes a deletion (ADR 0004).
    // After it, or if the purge got there first, the account is gone: same answer as
    // an unknown email, and no session (it would fail the foreign key anyway).
    const accountRestored = isPendingDeletion(user);
    if (accountRestored && !(await this.users.cancelDeletion(user.id, new Date()))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return { ...(await this.issue(user, userAgent)), accountRestored };
  }

  /** Re-checks the password of a signed-in user before a destructive action. */
  async verifyPassword(user: User, password: string): Promise<boolean> {
    return user.passwordHash ? verify(user.passwordHash, password) : false;
  }

  async revokeAllWithin(manager: EntityManager, userId: string): Promise<void> {
    await manager.update(Session, { userId, revokedAt: IsNull() }, { revokedAt: new Date() });
  }

  async authenticate(token: string): Promise<{ user: User; session: Session } | null> {
    const session = await this.sessions.findOne({
      where: { tokenHash: hashToken(token) },
      relations: { user: true },
    });
    if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) return null;
    // Sessions are revoked when deletion is requested; this covers a race with that.
    if (isPendingDeletion(session.user)) return null;
    return { user: session.user, session };
  }

  /** Rotates the token: the old one stops working at once, the expiry restarts. */
  async refresh(session: Session): Promise<AuthResultDto> {
    const token = newToken();
    const now = new Date();
    const expiresAt = sessionExpiry(now);
    await this.sessions.update(session.id, { tokenHash: hashToken(token), rotatedAt: now, expiresAt });
    return { token, expiresAt, user: UserDto.from(session.user), accountRestored: false };
  }

  async signOut(session: Session): Promise<void> {
    await this.sessions.update(session.id, { revokedAt: new Date() });
  }

  async listSessions(userId: string, currentId: string): Promise<SessionDto[]> {
    const live = await this.sessions.find({
      where: { userId, revokedAt: IsNull(), expiresAt: MoreThan(new Date()) },
      order: { createdAt: 'DESC' },
    });
    return live.map((s) => ({
      id: s.id,
      userAgent: s.userAgent,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
      current: s.id === currentId,
    }));
  }

  async revoke(userId: string, sessionId: string): Promise<void> {
    const result = await this.sessions.update({ id: sessionId, userId, revokedAt: IsNull() }, { revokedAt: new Date() });
    if (!result.affected) throw new NotFoundException('Session not found');
  }

  private async issue(user: User, userAgent?: string): Promise<Omit<AuthResultDto, 'accountRestored'>> {
    const token = newToken();
    const expiresAt = sessionExpiry(new Date());
    await this.sessions.save(
      this.sessions.create({
        userId: user.id,
        tokenHash: hashToken(token),
        userAgent: userAgent?.slice(0, SESSION_USER_AGENT_MAX) ?? null,
        expiresAt,
      }),
    );
    return { token, expiresAt, user: UserDto.from(user) };
  }
}

// PostgreSQL's unique_violation. Only email is unique on a row signUp inserts.
const isUniqueViolation = (error: unknown): boolean =>
  error instanceof QueryFailedError && (error.driverError as { code?: unknown }).code === '23505';

/** A new or refreshed session lasts SESSION_TTL_DAYS from now. */
const sessionExpiry = (now: Date): Date => new Date(now.getTime() + sessionTtlDays() * DAY_MS);

function newToken(): string {
  return randomBytes(32).toString('base64url');
}
