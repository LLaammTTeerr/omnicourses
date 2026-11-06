import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { AuthService } from '../../src/auth/auth.service.js';
import { UsersService } from '../../src/users/users.service.js';

// Synthetic accounts only (AGENTS.md hard rule 3), unique per run, so reruns
// against the same database never collide.
export const PASSWORD = 'correct horse battery';
const newEmail = () => `e2e-${randomUUID()}@example.com`;

/** A stored account nobody can sign in to. */
export async function storedUser(app: INestApplication): Promise<string> {
  const user = await app.get(UsersService).create({ email: newEmail(), passwordHash: 'not-a-real-hash', displayName: 'Test Student', consentAt: new Date() });
  return user.id;
}

/**
 * A new account with PASSWORD and a session. Signs up through the service, not
 * the route, so it spends none of the route's password rate limit.
 */
export async function signedInUser(app: INestApplication): Promise<{ token: string; userId: string; email: string }> {
  const email = newEmail();
  const { token, user } = await app.get(AuthService).signUp({ email, password: PASSWORD, displayName: 'Test Student', acceptedTerms: true });
  return { token, userId: user.id, email };
}
