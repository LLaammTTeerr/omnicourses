import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { LlmService } from '../src/ai/llm.service.js';
import { ModelClient, type ModelStreamEvent, type StreamRequest } from '../src/ai/model-client.js';
import { AI_CONFIG, type AiConfig } from '../src/config/env.js';
import { UsersService } from '../src/users/users.service.js';
import { bootApp } from './support/app.js';
import { signedInUser } from './support/users.js';

const STUDENT_ID = '24120000';
const CLASS_NAME = '24CTT0';

class RecordingModel extends ModelClient {
  readonly requests: unknown[] = [];

  async complete(req: Parameters<ModelClient['complete']>[0]) {
    this.requests.push(req);
    return { content: '{"answer":"ok"}', usage: { inputTokens: 1, outputTokens: 1 } };
  }

  async *stream(req: StreamRequest): AsyncIterable<ModelStreamEvent> {
    this.requests.push(req);
    yield { type: 'text', delta: 'ok' };
    yield { type: 'end', content: 'ok', toolCalls: [], usage: { inputTokens: 1, outputTokens: 1 } };
  }
}

describe('Student ID and class name on the account (e2e)', () => {
  let app: INestApplication;
  let db: DataSource;
  const model = new RecordingModel();
  const config: AiConfig = { apiKey: 'test-key', structuredModel: 'any-model', chatModel: 'any-model', timeoutMs: 1000, dailyCallsPerUser: 50 };
  const http = () => request(app.getHttpServer());
  const patch = (token: string, body: unknown) => http().patch('/api/users/me').set('Authorization', `Bearer ${token}`).send(body as object);
  const stored = async (userId: string) => (await db.query('SELECT student_id, class_name FROM users WHERE id = $1', [userId]))[0];

  beforeAll(async () => {
    app = await bootApp((builder) => builder.overrideProvider(AI_CONFIG).useValue(config).overrideProvider(ModelClient).useValue(model));
    db = app.get(DataSource);
  });

  afterAll(async () => {
    await app?.close();
  });

  afterEach(() => vi.restoreAllMocks());

  it('starts empty, saves both, returns them on GET /api/users/me and keeps a field left out', async () => {
    const { token, userId } = await signedInUser(app);
    expect((await http().get('/api/users/me').set('Authorization', `Bearer ${token}`).expect(200)).body).toMatchObject({ studentId: null, className: null });
    expect((await patch(token, { studentId: STUDENT_ID, className: ` ${CLASS_NAME} ` }).expect(200)).body).toMatchObject({ id: userId, studentId: STUDENT_ID, className: CLASS_NAME });
    expect((await http().get('/api/users/me').set('Authorization', `Bearer ${token}`).expect(200)).body).toMatchObject({ studentId: STUDENT_ID, className: CLASS_NAME });
    await patch(token, { className: null }).expect(200);
    expect(await stored(userId)).toEqual({ student_id: STUDENT_ID, class_name: null });
    await patch(token, { studentId: '  ' }).expect(200);
    expect(await stored(userId)).toEqual({ student_id: null, class_name: null });
  });

  it('refuses a bad value with 400 and saves nothing, nor echoes or logs the value', async () => {
    const { token, userId } = await signedInUser(app);
    await patch(token, { studentId: STUDENT_ID, className: CLASS_NAME }).expect(200);
    const written: string[] = [];
    const keep = (chunk: unknown) => void written.push(String(chunk));
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => (keep(chunk), true));
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => (keep(chunk), true));
    for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) vi.spyOn(console, method).mockImplementation((...args) => keep(args.join(' ')));
    const refusals = [
      { studentId: '2412000X' },
      { studentId: '24120000', className: `24CTT0\u0000` },
      { className: 'x'.repeat(33) },
      { displayName: 'Someone else' },
      { studentId: '24120001', email: 'zz-other@example.com' },
    ];
    for (const body of refusals) {
      const answer = await patch(token, body).expect(400);
      expect(JSON.stringify(answer.body)).not.toMatch(/2412000X|24120001|24CTT0/);
    }
    expect(await stored(userId)).toEqual({ student_id: STUDENT_ID, class_name: CLASS_NAME });
    expect(written.join('\n')).not.toMatch(/2412000|24CTT0/);
  });

  it('needs a signed-in student', async () => {
    await http().patch('/api/users/me').send({ studentId: STUDENT_ID }).expect(401);
  });

  it('the database refuses a student ID that is not 8 digits, whatever writes it', async () => {
    const { userId } = await signedInUser(app);
    await expect(db.query(`UPDATE users SET student_id = '2412000' WHERE id = $1`, [userId])).rejects.toThrow(/ck_users_student_id/);
  });

  it('exports both with the account (ADR 0004)', async () => {
    const { token } = await signedInUser(app);
    await patch(token, { studentId: STUDENT_ID, className: CLASS_NAME }).expect(200);
    const exported = await http().get('/api/users/me/export').set('Authorization', `Bearer ${token}`).expect(200);
    expect(exported.body.user).toMatchObject({ student_id: STUDENT_ID, class_name: CLASS_NAME });
  });

  it('purges both with the account (ADR 0004)', async () => {
    const { token, userId } = await signedInUser(app);
    await patch(token, { studentId: STUDENT_ID, className: CLASS_NAME }).expect(200);
    await db.query(`UPDATE users SET deletion_requested_at = now() - interval '31 days', purge_after = now() - interval '1 day' WHERE id = $1`, [userId]);
    expect(await app.get(UsersService).purgeIfDue(userId, new Date())).toBe(true);
    expect(await db.query('SELECT 1 FROM users WHERE id = $1', [userId])).toEqual([]);
  });

  it('never sends them to the model: the gateway gets a user id, not the account (ADR 0003, AGENTS.md rule 3)', async () => {
    const { token, userId } = await signedInUser(app);
    await patch(token, { studentId: STUDENT_ID, className: CLASS_NAME }).expect(200);
    model.requests.length = 0;
    const llm = app.get(LlmService);
    await llm.structured({ context: { userId, feature: 'goal-box' }, instructions: 'Read the goal.', input: 'Graduate in 2028.', schema: z.object({ answer: z.string() }) });
    for await (const _event of llm.chat({ context: { userId, feature: 'advisor' }, instructions: 'Advise.', messages: [{ role: 'user', content: 'What can I take next term?' }] }));
    expect(model.requests).toHaveLength(2);
    const sent = JSON.stringify(model.requests);
    expect(sent).not.toContain(STUDENT_ID);
    expect(sent).not.toContain(CLASS_NAME);
    expect(sent).not.toContain(userId);
  });
});
