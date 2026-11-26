import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';

export interface Account {
  token: string;
  userId: string;
}

export const runSuffix = (): string => randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();

export function authed(app: () => INestApplication) {
  const http = () => request(app().getHttpServer());
  return (caller: string | { token: string }) => {
    const token = typeof caller === 'string' ? caller : caller.token;
    const auth = (test: request.Test) => test.set('Authorization', `Bearer ${token}`);
    return {
      get: (path: string) => auth(http().get(path)),
      post: (path: string, body: object | string = {}) => auth(http().post(path)).set('Content-Type', 'application/json').send(body),
      put: (path: string, body: object = {}) => auth(http().put(path)).send(body),
      patch: (path: string, body: object = {}) => auth(http().patch(path)).send(body),
      delete: (path: string) => auth(http().delete(path)),
    };
  };
}

export async function grantProgram(db: DataSource, userId: string, programId: string): Promise<void> {
  await db.query('INSERT INTO program_admin_grants (user_id, program_id) VALUES ($1, $2)', [userId, programId]);
}

export async function grantGlobal(db: DataSource, userId: string, ...permissions: ('access_manager' | 'catalog_maintainer')[]): Promise<void> {
  for (const permission of permissions) await db.query('INSERT INTO global_admin_grants (user_id, permission) VALUES ($1, $2)', [userId, permission]);
}
