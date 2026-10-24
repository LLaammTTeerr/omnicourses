import { createHash, randomBytes } from 'node:crypto';
import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { hash, verify } from '@node-rs/argon2';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { UserDto } from '../users/user.dto.js';
import { User } from '../users/user.entity.js';
import { UsersService } from '../users/users.service.js';
import { AuthResultDto, SessionDto, SignInDto, SignUpDto } from './auth.dto.js';
import { Session } from './session.entity.js';

const DAY_MS = 86_400_000;

export const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

@Injectable()
export class AuthService {
  private readonly ttlMs = Number(process.env.SESSION_TTL_DAYS ?? 7) * DAY_MS;
  // Verified against when the email is unknown, so a wrong email and a wrong
  // password take the same time and the response does not reveal which.
  private readonly dummyHash = hash('omnicourse-timing-equalizer');

  constructor(
    @InjectRepository(Session) private readonly sessions: Repository<Session>,
    private readonly users: UsersService,
  ) {}

  async signUp(dto: SignUpDto, userAgent?: string): Promise<AuthResultDto> {
    if (await this.users.findByEmail(dto.email)) {
      throw new ConflictException('An account with this email already exists');
    }
    const user = await this.users.create({
      email: dto.email,
      passwordHash: await hash(dto.password),
      displayName: dto.displayName,
      consentAt: new Date(),
    });
    return this.issue(user, userAgent);
  }

  async signIn(dto: SignInDto, userAgent?: string): Promise<AuthResultDto> {
    const user = await this.users.findByEmail(dto.email);
    const valid = user?.passwordHash
      ? await verify(user.passwordHash, dto.password)
      : (await verify(await this.dummyHash, dto.password), false);
    if (!user || !valid) throw new UnauthorizedException('Invalid email or password');
    // Signing in during the grace period is how a student undoes a deletion (ADR 0004).
    const accountRestored = user.deletionRequestedAt !== null;
    if (accountRestored) await this.users.cancelDeletion(user.id);
    return { ...(await this.issue(user, userAgent)), accountRestored };
  }

  /** Re-checks the password of a signed-in user before a destructive action. */
  async verifyPassword(user: User, password: string): Promise<boolean> {
    return user.passwordHash ? verify(user.passwordHash, password) : false;
  }

  async revokeAll(userId: string): Promise<void> {
    await this.sessions.update({ userId, revokedAt: IsNull() }, { revokedAt: new Date() });
  }

  /** Resolves a bearer token to its live session, or null if unknown, expired or revoked. */
  async authenticate(token: string): Promise<{ user: User; session: Session } | null> {
    const session = await this.sessions.findOne({
      where: { tokenHash: hashToken(token) },
      relations: { user: true },
    });
    if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) return null;
    // Sessions are revoked when deletion is requested; this covers a race with that.
    if (session.user.deletionRequestedAt) return null;
    return { user: session.user, session };
  }

  /** Rotates the token: the old one stops working at once, the expiry restarts. */
  async refresh(session: Session): Promise<AuthResultDto> {
    const token = newToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.ttlMs);
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
    // Scoped by userId: a user can only revoke their own sessions.
    const result = await this.sessions.update({ id: sessionId, userId, revokedAt: IsNull() }, { revokedAt: new Date() });
    if (!result.affected) throw new NotFoundException('Session not found');
  }

  private async issue(user: User, userAgent?: string): Promise<AuthResultDto> {
    const token = newToken();
    const expiresAt = new Date(Date.now() + this.ttlMs);
    await this.sessions.save(
      this.sessions.create({
        userId: user.id,
        tokenHash: hashToken(token),
        userAgent: userAgent?.slice(0, 512) ?? null,
        expiresAt,
      }),
    );
    return { token, expiresAt, user: UserDto.from(user), accountRestored: false };
  }
}

function newToken(): string {
  return randomBytes(32).toString('base64url');
}
