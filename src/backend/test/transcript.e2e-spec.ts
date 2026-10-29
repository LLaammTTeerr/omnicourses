import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/bootstrap.js';
import { TranscriptEntry } from '../src/transcript/transcript-entry.js';
import { TranscriptService } from '../src/transcript/transcript.service.js';

// Synthetic transcripts only (AGENTS.md hard rule 3).
const password = 'correct horse battery';
// Oldest term first, as the API returns it: a failed course, its retake in summer, one in progress.
const first: TranscriptEntry[] = [
  { courseCode: 'CSC10001', courseName: 'Introduction to Programming', credits: 4, grade: 4.5, term: { year: 2025, number: 1 } },
  { courseCode: 'MTH00003', courseName: 'Calculus 1B', credits: 3, grade: 7.3, term: { year: 2025, number: 1 } },
  { courseCode: 'CSC10001', courseName: 'Introduction to Programming', credits: 4, grade: 8, term: { year: 2025, number: 3 } },
  { courseCode: 'CSC10002', courseName: 'Programming Techniques', credits: 4, grade: null, term: { year: 2026, number: 1 } },
];

describe('Transcript against PostgreSQL (e2e)', () => {
  let app: INestApplication;
  let db: DataSource;
  const http = () => request(app.getHttpServer());

  async function signUp(): Promise<{ token: string; userId: string; email: string }> {
    const email = `transcript-${randomUUID()}@example.com`;
    const res = await http().post('/api/auth/sign-up').send({ email, password, displayName: 'Test Student', acceptedTerms: true }).expect(201);
    return { token: res.body.token, userId: res.body.user.id, email };
  }

  // Resolves once the backend with this pid is waiting on a lock another one holds.
  async function blockedBy(pid: number): Promise<void> {
    await vi.waitFor(async () => {
      const [{ n }] = await db.query('SELECT count(*)::int AS n FROM pg_stat_activity WHERE $1 = ANY(pg_blocking_pids(pid))', [pid]);
      expect(n).toBeGreaterThan(0);
    });
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

  it('returns the same course twice in one term in the same order on every read', async () => {
    const { token, userId } = await signUp();
    const auth = { Authorization: `Bearer ${token}` };
    const twice = [first[0], { ...first[0], grade: 6 }, first[1]];
    await http().put('/api/users/me/transcript').set(auth).send({ rows: twice }).expect(200);

    const byId: { grade: string }[] = await db.query(
      'SELECT grade FROM transcript_rows WHERE user_id = $1 ORDER BY term_year, term_number, course_code, id',
      [userId],
    );
    const reads = [
      (await http().get('/api/users/me/transcript').set(auth).expect(200)).body.rows,
      (await http().get('/api/users/me/transcript').set(auth).expect(200)).body.rows,
      await app.get(TranscriptService).rowsFor(userId),
    ];
    for (const rows of reads) expect(rows.map((r: TranscriptEntry) => r.grade)).toEqual(byId.map((r) => Number(r.grade)));
  });

  it('keeps the saved transcript when a save is refused', async () => {
    const { token } = await signUp();
    const auth = { Authorization: `Bearer ${token}` };
    await http().put('/api/users/me/transcript').set(auth).send({ rows: first }).expect(200);

    const { grade: _noGrade, ...gradeless } = first[1];
    const { term: _noTerm, ...termless } = first[1];
    await http().put('/api/users/me/transcript').set(auth).send({ rows: [first[0], gradeless] }).expect(400);
    await http().put('/api/users/me/transcript').set(auth).send({ rows: [first[0], termless] }).expect(400);
    await http().put('/api/users/me/transcript').set(auth).send({ rows: [{ ...first[0], term: { year: 2025, number: 4 } }] }).expect(400);
    expect((await http().get('/api/users/me/transcript').set(auth).expect(200)).body.rows).toEqual(first);
  });

  it('strips a field the row does not have', async () => {
    const { token } = await signUp();
    const auth = { Authorization: `Bearer ${token}` };
    const saved = await http().put('/api/users/me/transcript').set(auth).send({ rows: [{ ...first[0], studentId: 'x' }] }).expect(200);
    expect(saved.body.rows).toEqual([first[0]]);
  });

  it('waits for a save in progress instead of merging with it', async () => {
    const { token, userId } = await signUp();
    await http().put('/api/users/me/transcript').set('Authorization', `Bearer ${token}`).send({ rows: first }).expect(200);

    // Another save, paused halfway: it holds the user lock and has replaced the rows, uncommitted.
    const other = db.createQueryRunner();
    await other.connect();
    let saving!: Promise<{ rows: TranscriptEntry[] }>;
    try {
      await other.startTransaction();
      const [{ pid }] = await other.query('SELECT pg_backend_pid() AS pid');
      await other.query('SELECT 1 FROM users WHERE id = $1 FOR NO KEY UPDATE', [userId]);
      await other.query('DELETE FROM transcript_rows WHERE user_id = $1', [userId]);
      await other.query(
        `INSERT INTO transcript_rows (user_id, course_code, course_name, credits, grade, term_year, term_number) VALUES ($1, 'BAA00101', 'Marxist-Leninist Philosophy', 3, 7, 2025, 1)`,
        [userId],
      );

      saving = app.get(TranscriptService).replace(userId, { rows: [first[3]] });
      // Commit only once the save is actually waiting on this transaction.
      await blockedBy(pid);
      await other.commitTransaction();
    } finally {
      if (other.isTransactionActive) await other.rollbackTransaction();
      await other.release();
    }

    expect((await saving).rows).toEqual([first[3]]);
  });

  it('lets the student sign in while a save is in progress', async () => {
    const { token, userId, email } = await signUp();
    await http().put('/api/users/me/transcript').set('Authorization', `Bearer ${token}`).send({ rows: first }).expect(200);

    // Holds the saved rows so the next save stops after taking its user lock.
    const other = db.createQueryRunner();
    await other.connect();
    let saving!: Promise<unknown>;
    try {
      await other.startTransaction();
      const [{ pid }] = await other.query('SELECT pg_backend_pid() AS pid');
      await other.query('DELETE FROM transcript_rows WHERE user_id = $1', [userId]);
      saving = app.get(TranscriptService).replace(userId, { rows: [first[3]] });
      await blockedBy(pid);

      // Sign-in inserts a session, whose foreign-key check needs a KEY SHARE lock on the user.
      const signIn = http().post('/api/auth/sign-in').send({ email, password }).then((res) => res.status);
      const outcome = await Promise.race([signIn, new Promise((resolve) => setTimeout(() => resolve('still waiting'), 3000))]);
      expect(outcome).toBe(200);
    } finally {
      if (other.isTransactionActive) await other.rollbackTransaction();
      await other.release();
    }
    await saving;
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
