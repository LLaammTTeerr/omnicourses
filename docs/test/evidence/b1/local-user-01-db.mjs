// The database cases of TC-B1-USER-01 (test-cases-b1.md §2) on a local disposable database:
// USER-01n, q, r, s, t, v, y, z and the API and database parts of w and x. The screen parts are not covered.
// Synthetic example.com accounts only (the case's own names; they exist only in the disposable database).
// Usage: node local-user-01-db.mjs
//   env: API (default http://localhost:3055/api), DB_CONTAINER (podman container with psql and pg_dump),
//        API_LOG (the backend's log file), RESTART (a shell command that restarts the backend and appends to API_LOG)
// Never prints a token, a password hash or a token hash.
import { execFileSync, execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const API = process.env.API ?? 'http://localhost:3055/api';
const DB = process.env.DB_CONTAINER;
const PW = 'correct horse battery';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const psql = (sql) => execFileSync('podman', ['exec', '-i', DB, 'psql', '-U', 'omnicourse', '-d', 'omnicourse', '-tAc', sql], { encoding: 'utf8' }).trim();
const results = [];
let current;
function begin(id) { current = { id, ok: true }; results.push(current); log(id); }
function check(what, ok, actual) { if (!ok) current.ok = false; log(`  ${ok ? 'ok  ' : 'FAIL'} ${what} -> ${actual}`); }

async function call(method, path, { body, token } = {}) {
  const headers = { 'user-agent': 'B1 run, USER-01 database cases (Node 22 fetch)' };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(API + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text, headers: res.headers };
}
const signUp = (email) => call('POST', '/auth/sign-up', { body: { email, password: PW, displayName: 'Test Student', acceptedTerms: true } });
const signIn = (email) => call('POST', '/auth/sign-in', { body: { email, password: PW } });
const idOf = (email) => psql(`SELECT id FROM users WHERE email = '${email}'`);

// The user-table query of §1: every table whose single-column key user_id references users.
const USER_TABLES = `SELECT cl.relname FROM pg_constraint c JOIN pg_class cl ON cl.oid = c.conrelid
  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
  WHERE c.contype = 'f' AND c.confrelid = 'users'::regclass AND c.conrelid <> 'users'::regclass
    AND c.conparentid = 0 AND cardinality(c.conkey) = 1 AND a.attname = 'user_id' ORDER BY cl.relname`;
function userTableCounts(id) {
  const out = {};
  for (const t of psql(USER_TABLES).split('\n').filter(Boolean)) out[t] = Number(psql(`SELECT count(*) FROM "${t}" WHERE user_id = '${id}'`));
  return out;
}
const SHARED = `SELECT (SELECT count(*) FROM programs) || ' programs, ' || (SELECT count(*) FROM curriculums) || ' curriculums, ' ||
  (SELECT count(*) FROM requirement_groups) || ' groups, ' || (SELECT count(*) FROM courses) || ' courses, ' || (SELECT count(*) FROM requirement_group_courses) || ' links'`;

const S1_ROWS = { rows: [
  { courseCode: 'ZZ101', courseName: 'Synthetic Course One', credits: 4, result: 'graded', grade: 8.5, term: { year: 2024, number: 1 } },
  { courseCode: 'ZZ102', courseName: 'Synthetic Course Two', credits: 2, result: 'pass', grade: null, term: { year: 2024, number: 3 } },
  { courseCode: 'ZZ103', courseName: 'Synthetic Course Three', credits: 3, result: 'in_progress', grade: null, term: { year: 2025, number: 1 } },
] };
const S2_ROWS = { rows: [
  { courseCode: 'ZZ201', courseName: 'Synthetic Course Other', credits: 4, result: 'graded', grade: 7.0, term: { year: 2025, number: 1 } },
] };
const GOALS = { program: 'APCS', cohort: 2024, targetGraduationTerm: { year: 2027, number: 2 }, creditsPerTerm: 18, internshipTerm: { year: 2027, number: 1 }, finished: true };
const NO_GOALS = { program: 'APCS', cohort: 2024, targetGraduationTerm: null, creditsPerTerm: null, internshipTerm: null, finished: true };

// ---- USER-01n ----
begin('USER-01n');
const s1 = await signUp('b1-s1@example.com');
check('S1 sign-up 201', s1.status === 201, s1.status);
const A = s1.json?.token;
const s1Id = s1.json?.user?.id;
const hashPrefix = psql(`SELECT left(password_hash, 10) FROM users WHERE email = 'b1-s1@example.com'`);
check('password_hash starts with $argon2id$ (only its first 10 characters are read)', hashPrefix === '$argon2id$', hashPrefix);
const dump = execSync(`podman exec -i ${DB} pg_dump -U omnicourse --data-only omnicourse | grep -c "${PW}" || true`, { encoding: 'utf8' }).trim();
check(`pg_dump --data-only | grep -c "${PW}" is 0`, dump === '0', dump);
const logHits = () => readFileSync(process.env.API_LOG, 'utf8').split(PW).length - 1;
check(`the backend log does not contain the password (${readFileSync(process.env.API_LOG, 'utf8').split('\n').length} lines searched)`, logHits() === 0, `${logHits()} matches`);

// ---- USER-01q ----
begin('USER-01q');
const before = Date.now();
const q = await signUp('b1-05@example.com');
check('sign-up 201', q.status === 201, q.status);
const consent = psql(`SELECT to_char(consent_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') FROM users WHERE email = 'b1-05@example.com'`);
check('consent_at within a minute of the sign-up', Math.abs(new Date(consent).getTime() - before) < 60_000, `consent_at ${consent}, sign-up sent ${new Date(before).toISOString()}`);

// ---- Prepare (Export) ----
log('prepare: S1 onboarding with all three goals, the S1 transcript, a second session, one plan; S2 onboarding and the S2 transcript');
const prep = [];
prep.push(['S1 PUT onboarding', (await call('PUT', '/users/me/onboarding', { token: A, body: GOALS })).status]);
prep.push(['S1 PUT transcript', (await call('PUT', '/users/me/transcript', { token: A, body: S1_ROWS })).status]);
const s1b = await signIn('b1-s1@example.com');
const B = s1b.json?.token;
prep.push(['S1 second sign-in', s1b.status]);
prep.push(['S1 POST plan', (await call('POST', '/plans', { token: A, body: { name: 'Standard 4-Year', programCode: 'APCS', cohortYear: 2024 } })).status]);
const s2 = await signUp('b1-s2@example.com');
const T2 = s2.json?.token;
const s2Id = s2.json?.user?.id;
prep.push(['S2 sign-up', s2.status]);
prep.push(['S2 PUT onboarding', (await call('PUT', '/users/me/onboarding', { token: T2, body: NO_GOALS })).status]);
prep.push(['S2 PUT transcript', (await call('PUT', '/users/me/transcript', { token: T2, body: S2_ROWS })).status]);
log('  ' + prep.map(([w, s]) => `${w} ${s}`).join(' | '));

// ---- USER-01r ----
begin('USER-01r');
const ex = await call('GET', '/users/me/export', { token: A });
const E1 = ex.json;
check('200', ex.status === 200, ex.status);
check('sent as a download named omnicourse-account.json', /attachment; filename="omnicourse-account.json"/.test(ex.headers.get('content-disposition') ?? ''), ex.headers.get('content-disposition'));
check("user holds S1's id, email, display name and consent time", E1?.user?.id === s1Id && E1?.user?.email === 'b1-s1@example.com' && Object.values(E1?.user ?? {}).includes('Test Student') && Object.keys(E1?.user ?? {}).some((k) => /consent/i.test(k)), `user keys: ${Object.keys(E1?.user ?? {}).join(', ')}`);
const counts = userTableCounts(s1Id);
const exported = Object.fromEntries(Object.entries(E1?.tables ?? {}).map(([k, v]) => [k, v.length]));
check('tables has a key for each table the query lists, with as many rows', JSON.stringify(Object.keys(counts).sort()) === JSON.stringify(Object.keys(exported).sort()) && Object.keys(counts).every((t) => counts[t] === exported[t]), `query ${JSON.stringify(counts)} | export ${JSON.stringify(exported)}`);
const ob = E1?.tables?.onboarding_answers?.[0];
check('the onboarding answers appear with the values from Prepare', !!ob && /2027/.test(JSON.stringify(ob)) && Object.values(ob).includes(18), JSON.stringify(ob && Object.fromEntries(Object.entries(ob).filter(([k]) => !/^(id|user_id|created_at|updated_at)$/.test(k)))));
check('3 transcript rows and at least 2 sessions', exported.transcript_rows === 3 && exported.sessions >= 2, `transcript_rows ${exported.transcript_rows}, sessions ${exported.sessions}`);

// ---- USER-01s ----
begin('USER-01s');
const SECRET_KEY = /(_hash|_token|_secret|_key|_password|_sub|Hash|Token|Secret|Key|Password|Sub)$/;
const badKeys = [];
(function walk(v, path) {
  if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { if (SECRET_KEY.test(k)) badKeys.push(`${path}.${k}`); walk(x, `${path}.${k}`); }
})(E1, '');
check('no key at any depth ends in _hash, _token, _secret, _key, _password or _sub (or camelCase)', badKeys.length === 0, badKeys.join(', ') || 'none');
const secrets = [psql(`SELECT password_hash FROM users WHERE id = '${s1Id}'`), ...psql(`SELECT token_hash FROM sessions WHERE user_id = '${s1Id}'`).split('\n').filter(Boolean), A];
check(`the file holds none of S1's password_hash, ${secrets.length - 2} session token_hash values, or the bearer token used`, secrets.every((s) => s && !ex.text.includes(s)), `${secrets.filter((s) => ex.text.includes(s)).length} found`);

// ---- USER-01t ----
begin('USER-01t');
check("S2's id, email and ZZ201 appear nowhere in S1's file", ![s2Id, 'b1-s2@example.com', 'ZZ201'].some((s) => ex.text.includes(s)), `${[s2Id, 'b1-s2@example.com', 'ZZ201'].filter((s) => ex.text.includes(s)).length} found`);

// ---- USER-01v ----
begin('USER-01v');
const v = await call('DELETE', '/users/me', { token: A, body: { password: 'not the password' } });
check('403 "Wrong password"', v.status === 403 && v.json?.message === 'Wrong password', `${v.status} "${v.json?.message}"`);
check('S1 still signed in (200)', (await call('GET', '/users/me', { token: A })).status === 200, 'GET /users/me 200');
check('deletion_requested_at still null', psql(`SELECT deletion_requested_at IS NULL FROM users WHERE id = '${s1Id}'`) === 't', psql(`SELECT coalesce(deletion_requested_at::text, 'null') FROM users WHERE id = '${s1Id}'`));

// ---- USER-01w (API and database parts) ----
begin('USER-01w (API and database parts)');
const w = await call('DELETE', '/users/me', { token: A, body: { password: PW } });
check('202', w.status === 202, `${w.status} keys: ${Object.keys(w.json ?? {}).join(', ')}`);
const row = psql(`SELECT to_char(deletion_requested_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') || ' ' || to_char(purge_after AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') || ' ' || (purge_after - deletion_requested_at) FROM users WHERE id = '${s1Id}'`).split(' ');
check('purgeAfter is 30 days after the request, to the minute', Math.abs(new Date(w.json?.purgeAfter).getTime() - new Date(row[0]).getTime() - 30 * 86_400_000) < 60_000, `purgeAfter ${w.json?.purgeAfter}; deletion_requested_at ${row[0]}; difference in the database ${row.slice(2).join(' ')}`);
check('purge_after in the database is the same time', new Date(w.json?.purgeAfter).getTime() === new Date(row[1]).getTime(), `purge_after ${row[1]}`);
check("the deleting session (A) gets 401", (await call('GET', '/users/me', { token: A })).status === 401, '401');
check("the other session (B) gets 401 on its next request", (await call('GET', '/users/me', { token: B })).status === 401, '401');
const again = await signUp('b1-s1@example.com');
check('sign-up again with the same email: 409', again.status === 409, `${again.status} "${again.json?.message}"`);
check('S2 still 200', (await call('GET', '/users/me', { token: T2 })).status === 200, '200');

// ---- USER-01x (API and database parts) ----
begin('USER-01x (API and database parts)');
const x = await signIn('b1-s1@example.com');
check('200 with accountRestored: true', x.status === 200 && x.json?.accountRestored === true, `${x.status} accountRestored ${x.json?.accountRestored}`);
check('deletion_requested_at and purge_after are null', psql(`SELECT (deletion_requested_at IS NULL AND purge_after IS NULL) FROM users WHERE id = '${s1Id}'`) === 't', psql(`SELECT coalesce(deletion_requested_at::text, 'null') || ', ' || coalesce(purge_after::text, 'null') FROM users WHERE id = '${s1Id}'`));
const E2 = (await call('GET', '/users/me/export', { token: x.json?.token })).json;
const strip = (e) => { const c = structuredClone(e); delete c.exportedAt; delete c.user.updated_at; delete c.user.updatedAt; delete c.tables.sessions; return c; };
const diff = [];
(function cmp(a, b, path) {
  if (a && b && typeof a === 'object' && typeof b === 'object') { for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) cmp(a[k], b[k], `${path}.${k}`); }
  else if (a !== b) diff.push(path);
})(strip(E1), strip(E2), '');
check('E2 matches E1 except exportedAt, user.updated_at and the sessions rows', diff.length === 0, diff.join(', ') || `no difference; tables compared: ${Object.keys(strip(E1).tables).join(', ')}`);
check('sessions differ as expected (the old ones were revoked)', true, `E1 ${E1.tables.sessions.length} sessions, E2 ${E2.tables.sessions.length}`);

// ---- USER-01y ----
begin('USER-01y');
const s3 = await signUp('b1-s3@example.com');
const s3Id = s3.json?.user?.id;
const T3 = s3.json?.token;
const y0 = [s3.status, (await call('PUT', '/users/me/onboarding', { token: T3, body: NO_GOALS })).status, (await call('PUT', '/users/me/transcript', { token: T3, body: S1_ROWS })).status];
const yd = await call('DELETE', '/users/me', { token: T3, body: { password: PW } });
check('S3 signed up, onboarded, transcript saved, deleted with the password', y0.join() === '201,200,200' && yd.status === 202, `${y0.join(', ')}, delete ${yd.status}`);
log('  S3 rows before the purge: ' + JSON.stringify(userTableCounts(s3Id)));
check('UPDATE purge_after to a minute ago changes 1 row', psql(`UPDATE users SET purge_after = now() - interval '1 minute' WHERE email = 'b1-s3@example.com'`) === 'UPDATE 1', 'UPDATE 1');
const y1 = await signIn('b1-s3@example.com');
const y2 = await signIn('nobody-b1@example.com');
check('S3 sign-in after the deadline: 401 "Invalid email or password"', y1.status === 401 && y1.json?.message === 'Invalid email or password', `${y1.status} ${y1.text}`);
check('never-registered sign-in: 401 with an identical body', y2.status === 401 && y2.text === y1.text, `${y2.status} ${y2.text}`);
check("S3's users row still exists (the purge has not run)", psql(`SELECT count(*) FROM users WHERE id = '${s3Id}'`) === '1', `${psql(`SELECT count(*) FROM users WHERE id = '${s3Id}'`)} row`);

// ---- USER-01z ----
begin('USER-01z');
const s2Before = JSON.stringify(userTableCounts(s2Id));
const sharedBefore = psql(SHARED);
log(`  before: S2 ${s2Before} | shared ${sharedBefore}`);
const linesBefore = readFileSync(process.env.API_LOG, 'utf8').split('\n').length;
execSync(process.env.RESTART, { stdio: 'ignore' });
for (let i = 0; i < 40; i++) { try { if ((await fetch(`${API}/health`)).ok) break; } catch {} await sleep(500); }
await sleep(2000);
const purgeLines = readFileSync(process.env.API_LOG, 'utf8').replace(/\x1b\[[0-9;]*m/g, '').split('\n').slice(linesBefore - 1).filter((l) => /Purged/.test(l));
check('after the restart the backend log says "Purged 1 account(s) after the deletion grace period"', purgeLines.length === 1 && /Purged 1 account\(s\) after the deletion grace period/.test(purgeLines[0]), purgeLines.map((l) => l.replace(/\s+/g, ' ').trim()).join(' / ') || 'no such line');
check('S3 has no users row', psql(`SELECT count(*) FROM users WHERE id = '${s3Id}'`) === '0', `${psql(`SELECT count(*) FROM users WHERE id = '${s3Id}'`)} rows`);
const s3After = userTableCounts(s3Id);
check('S3 has 0 rows in every user table', Object.values(s3After).every((n) => n === 0), JSON.stringify(s3After));
check("S2's counts are as before", JSON.stringify(userTableCounts(s2Id)) === s2Before, JSON.stringify(userTableCounts(s2Id)));
check('the shared counts are as before', psql(SHARED) === sharedBefore, psql(SHARED));
const z = await signUp('b1-s3@example.com');
check('the new sign-up answers 201, with a new id', z.status === 201 && z.json?.user?.id !== s3Id, `${z.status}, id ${z.json?.user?.id === s3Id ? 'same' : 'differs'}`);
const zx = await call('GET', '/users/me/export', { token: z.json?.token });
const zCounts = Object.fromEntries(Object.entries(zx.json?.tables ?? {}).map(([k, v]) => [k, v.length]));
check('its export holds nothing from the old account', !zx.text.includes(s3Id) && !/ZZ10[123]/.test(zx.text) && Object.entries(zCounts).every(([k, n]) => (k === 'sessions' ? n === 1 : n === 0)), JSON.stringify(zCounts));
check('the log still does not contain the password (USER-01n, after every request of this run)', logHits() === 0, `${logHits()} matches`);

log('SUMMARY ' + results.map((r) => `${r.id}:${r.ok ? 'passed' : 'FAILED'}`).join(' | '));
