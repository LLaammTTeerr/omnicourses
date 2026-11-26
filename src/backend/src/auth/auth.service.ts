import { createHash, randomBytes } from 'node:crypto';
import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { hash, verify } from '@node-rs/argon2';
import { EntityManager, IsNull, MoreThan, Repository } from 'typeorm';
import { isRefusal, SQLSTATE } from '../common/failure-kind.js';
import { Clock } from '../config/clock.js';
import { sessionTtlDays } from '../config/env.js';
import { DAY_MS } from '../config/time.js';
import { UserDto } from '../users/user.dto.js';
import { User } from '../users/user.entity.js';
import { UsersService } from '../users/users.service.js';
import { AuthResultDto, SessionDto, SignInDto, SignUpDto } from './auth.dto.js';
import { Session } from './session.entity.js';

export const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

@Injectable()
export class AuthService {
  // Verified against when the email is unknown, so a wrong email and a wrong
  // password take the same time and the response does not reveal which.
  private readonly dummyHash = hash('omnicourse-timing-equalizer');

  constructor(
    @InjectRepository(Session) private readonly sessions: Repository<Session>,
    private readonly users: UsersService,
    private readonly clock: Clock,
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
        consentAt: this.clock.now(),
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
    const accountRestored = user.deletionRequestedAt !== null;
    if (accountRestored && !(await this.users.cancelDeletion(user.id, this.clock.now()))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return { ...(await this.issue(user, userAgent)), accountRestored };
  }

  /** Re-checks the password of a signed-in user before a destructive action. */
  async verifyPassword(user: User, password: string): Promise<boolean> {
    return user.passwordHash ? verify(user.passwordHash, password) : false;
  }

  async revokeAllWithin(manager: EntityManager, userId: string): Promise<void> {
    await manager.update(Session, { userId, revokedAt: IsNull() }, { revokedAt: this.clock.now() });
  }

  async authenticate(token: string): Promise<{ user: User; session: Session } | null> {
    const session = await this.sessions.findOne({
      where: { tokenHash: hashToken(token) },
      relations: { user: true },
    });
    if (!session || session.revokedAt || session.expiresAt.getTime() <= this.clock.now().getTime()) return null;
    // Sessions are revoked when deletion is requested; this covers a race with that.
    if (session.user.deletionRequestedAt) return null;
    return { user: session.user, session };
  }

  async authenticateHeader(authorization: string | string[] | undefined): Promise<{ user: User; session: Session } | null> {
    const token = bearerToken(authorization);
    return token ? this.authenticate(token) : null;
  }

  /** Rotates the token: the old one stops working at once, the expiry restarts. */
  async refresh(session: Session): Promise<AuthResultDto> {
    const token = newToken();
    const now = this.clock.now();
    const expiresAt = sessionExpiry(now);
    await this.sessions.update(session.id, { tokenHash: hashToken(token), rotatedAt: now, expiresAt });
    return { token, expiresAt, user: UserDto.from(session.user), accountRestored: false };
  }

  async signOut(session: Session): Promise<void> {
    await this.sessions.update(session.id, { revokedAt: this.clock.now() });
  }

  async listSessions(userId: string, currentId: string): Promise<SessionDto[]> {
    const live = await this.sessions.find({
      where: { userId, revokedAt: IsNull(), expiresAt: MoreThan(this.clock.now()) },
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
    const result = await this.sessions.update({ id: sessionId, userId, revokedAt: IsNull() }, { revokedAt: this.clock.now() });
    if (!result.affected) throw new NotFoundException('Session not found');
  }

  private async issue(user: User, userAgent?: string): Promise<Omit<AuthResultDto, 'accountRestored'>> {
    const token = newToken();
    const expiresAt = sessionExpiry(this.clock.now());
    await this.sessions.save(
      this.sessions.create({
        userId: user.id,
        tokenHash: hashToken(token),
        userAgent: userAgent?.slice(0, 512) ?? null,
        expiresAt,
      }),
    );
    return { token, expiresAt, user: UserDto.from(user) };
  }
}

// PostgreSQL's unique_violation. Only email is unique on a row signUp inserts.
const isUniqueViolation = (error: unknown): boolean =>
  isRefusal(error, [SQLSTATE.uniqueViolation]);

/** The token of an `Authorization: Bearer <token>` header, or null. */
function bearerToken(header: string | string[] | undefined): string | null {
  if (typeof header !== 'string') return null;
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}

function sessionExpiry(issuedAt: Date): Date {
  return new Date(issuedAt.getTime() + sessionTtlDays() * DAY_MS);
}

function newToken(): string {
  return randomBytes(32).toString('base64url');
}
