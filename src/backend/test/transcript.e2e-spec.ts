import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/bootstrap.js';
import { TranscriptRowDto } from '../src/transcript/transcript.dto.js';
import { TranscriptService } from '../src/transcript/transcript.service.js';

// Synthetic transcripts only (AGENTS.md hard rule 3).
const password = 'correct horse battery';
// Oldest term first, as the API returns it: a failed course, its retake in summer, one in progress.
const first: TranscriptRowDto[] = [
  { courseCode: 'CSC10001', courseName: 'Introduction to Programming', credits: 4, grade: 4.5, term: { year: 2025, number: 1 } },
  { courseCode: 'MTH00003', courseName: 'Calculus 1B', credits: 3, grade: 7.3, term: { year: 2025, number: 1 } },
  { courseCode: 'CSC10001', courseName: 'Introduction to Programming', credits: 4, grade: 8, term: { year: 2025, number: 3 } },
  { courseCode: 'CSC10002', courseName: 'Programming Techniques', credits: 4, grade: null, term: { year: 2026, number: 1 } },
];

describe('Transcript against PostgreSQL (e2e)', () => {
  let app: INestApplication;
  let db: DataSource;
  const http = () => request(app.getHttpServer());

  async function signUp(): Promise<{ token: string; userId: string }> {
    const res = await http()
      .post('/api/auth/sign-up')
      .send({ email: `transcript-${randomUUID()}@example.com`, password, displayName: 'Test Student', acceptedTerms: true })
      .expect(201);
    return { token: res.body.token, userId: res.body.user.id };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    db = app.get(DataSource);
    await db.runMigrations({ transaction: 'each' });
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('starts empty, saves the reviewed rows and returns them oldest term first', async () => {
    const { token } = await signUp();
    const auth = { Authorization: `Bearer ${token}` };
    expect((await http().get('/api/users/me/transcript').set(auth).expect(200)).body).toEqual({ rows: [] });

    const saved = await http().put('/api/users/me/transcript').set(auth).send({ rows: [...first].reverse() }).expect(200);
    expect(saved.body.rows).toEqual(first);
    expect((await http().get('/api/users/me/transcript').set(auth).expect(200)).body).toEqual(saved.body);
  });

  it('replaces the whole transcript on the next save (UC-02 A5)', async () => {
    const { token } = await signUp();
    const auth = { Authorization: `Bearer ${token}` };
    await http().put('/api/users/me/transcript').set(auth).send({ rows: first }).expect(200);
    const second = [{ ...first[1], grade: 9 }];
    expect((await http().put('/api/users/me/transcript').set(auth).send({ rows: second }).expect(200)).body).toEqual({ rows: second });
    expect((await http().put('/api/users/me/transcript').set(auth).send({ rows: [] }).expect(200)).body).toEqual({ rows: [] });
  });

  it('keeps the saved transcript when a save is refused', async () => {
    const { token } = await signUp();
    const auth = { Authorization: `Bearer ${token}` };
    await http().put('/api/users/me/transcript').set(auth).send({ rows: first }).expect(200);

    const { grade: _missing, ...incomplete } = first[1];
    await http().put('/api/users/me/transcript').set(auth).send({ rows: [first[0], incomplete] }).expect(400);
    await http().put('/api/users/me/transcript').set(auth).send({ rows: [{ ...first[0], term: { year: 2025, number: 4 } }] }).expect(400);
    await http().put('/api/users/me/transcript').set(auth).send({ rows: [{ ...first[0], studentId: 'x' }] }).expect(200 /* unknown field stripped */);
    expect((await http().get('/api/users/me/transcript').set(auth).expect(200)).body.rows).toEqual([first[0]]);
  });

  it('waits for a save in progress instead of merging with it', async () => {
    const { token, userId } = await signUp();
    await http().put('/api/users/me/transcript').set('Authorization', `Bearer ${token}`).send({ rows: first }).expect(200);

    // Another save, paused halfway: it holds the user lock and has replaced the rows, uncommitted.
    const other = db.createQueryRunner();
    await other.connect();
    await other.startTransaction();
    await other.query('SELECT 1 FROM users WHERE id = $1 FOR UPDATE', [userId]);
    await other.query('DELETE FROM transcript_rows WHERE user_id = $1', [userId]);
    await other.query(
      `INSERT INTO transcript_rows (user_id, course_code, course_name, credits, grade, term_year, term_number) VALUES ($1, 'BAA00101', 'Marxist-Leninist Philosophy', 3, 7, 2025, 1)`,
      [userId],
    );

    const second = [first[3]];
    const saving = app.get(TranscriptService).replace(userId, { rows: second });
    await new Promise((resolve) => setTimeout(resolve, 300));
    await other.commitTransaction();
    await other.release();

    expect((await saving).rows).toEqual(second);
  });

  it("shows each student only their own transcript and serves it to other modules", async () => {
    const a = await signUp();
    const b = await signUp();
    await http().put('/api/users/me/transcript').set('Authorization', `Bearer ${a.token}`).send({ rows: first }).expect(200);
    expect((await http().get('/api/users/me/transcript').set('Authorization', `Bearer ${b.token}`).expect(200)).body).toEqual({ rows: [] });

    expect(await app.get(TranscriptService).rowsFor(a.userId)).toEqual(first);
  });

  it('requires a signed-in user', async () => {
    await http().get('/api/users/me/transcript').expect(401);
    await http().put('/api/users/me/transcript').send({ rows: [] }).expect(401);
  });

  it('is included in the account export and removed with the account (ADR 0004)', async () => {
    const { token, userId } = await signUp();
    const auth = { Authorization: `Bearer ${token}` };
    await http().put('/api/users/me/transcript').set(auth).send({ rows: first }).expect(200);
    const exported = await http().get('/api/users/me/export').set(auth).expect(200);
    expect(exported.body.tables.transcript_rows).toHaveLength(first.length);

    await db.query('DELETE FROM users WHERE id = $1', [userId]);
    expect(await db.query('SELECT 1 FROM transcript_rows WHERE user_id = $1', [userId])).toEqual([]);
  });
});
