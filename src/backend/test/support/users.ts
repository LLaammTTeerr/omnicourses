import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { AuthService } from '../../src/auth/auth.service.js';
import { UsersService } from '../../src/users/users.service.js';

export const PASSWORD = 'correct horse battery';
const newEmail = () => `e2e-${randomUUID()}@example.com`;

export async function storedUser(app: INestApplication): Promise<string> {
  const user = await app.get(UsersService).create({ email: newEmail(), passwordHash: 'not-a-real-hash', displayName: 'Test Student', consentAt: new Date() });
  return user.id;
}

export async function signedInUser(app: INestApplication): Promise<{ token: string; userId: string; email: string }> {
  const email = newEmail();
  const { token, user } = await app.get(AuthService).signUp({ email, password: PASSWORD, displayName: 'Test Student', acceptedTerms: true });
  return { token, userId: user.id, email };
}
