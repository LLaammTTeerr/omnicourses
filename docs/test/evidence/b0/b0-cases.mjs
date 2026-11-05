// Runs the API cases of docs/test/test-cases-b0.md (AUTH-01, SESS-01, DB-01b/d/e)
// against a running B0 API. Synthetic example.com accounts only.
// Usage: node b0-cases.mjs <results.json>   env: PSQL (required), PGPASSWORD, PGPORT, API
// The B0 run used the version in commit baa4e30. This one differs only in comments,
// SESS-01l's label and the SUMMARY line, after review of #52; every check is the same.
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const API = process.env.API ?? 'http://localhost:3000/api';
const PW = 'correct horse battery';
const NAME = 'Test Student';
const UA = 'B0 manual run (Node 22 fetch)';
const out = process.argv[2] ?? 'results.json';
const results = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// Keep each password route under its 10-a-minute limit, except where a case means to exceed it.
const windows = { 'sign-up': { start: 0, count: 0 }, 'sign-in': { start: 0, count: 0 } };
async function budget(route) {
  const w = windows[route];
  if (!w) return;
  if (w.start && Date.now() - w.start > 63_000) Object.assign(w, { start: 0, count: 0 });
  if (w.count >= 10) {
    const wait = w.start + 63_000 - Date.now();
    log(`  (waiting ${Math.ceil(wait / 1000)} s for the ${route} limit)`);
    await sleep(wait);
    Object.assign(w, { start: 0, count: 0 });
  }
  if (!w.start) w.start = Date.now();
  w.count++;
}
async function waitMinute(route) {
  log(`  (waiting 63 s: "wait a minute"${route ? ` before ${route}` : ''})`);
  await sleep(63_000);
  for (const w of Object.values(windows)) Object.assign(w, { start: 0, count: 0 });
}

async function call(method, path, { body, token, route } = {}) {
  if (route) await budget(route);
  const headers = { 'user-agent': UA };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(API + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text, type: res.headers.get('content-type') };
}
const signUp = (email, extra = {}) =>
  call('POST', '/auth/sign-up', { route: 'sign-up', body: { email, password: PW, displayName: NAME, acceptedTerms: true, ...extra } });
const signIn = (email, password = PW) => call('POST', '/auth/sign-in', { route: 'sign-in', body: { email, password } });
const me = (token) => call('GET', '/users/me', { token });
const sessions = (token) => call('GET', '/auth/sessions', { token });

function accounts(email) {
  const sql = `SELECT count(*) FROM users WHERE email = '${email.replace(/'/g, "''")}'`;
  return Number(execFileSync(process.env.PSQL, ['-h', 'localhost', '-p', process.env.PGPORT ?? '5432', '-U', 'omnicourse', '-d', 'omnicourse', '-tAc', sql], { encoding: 'utf8' }).trim());
}
const msg = (r) => (Array.isArray(r.json?.message) ? r.json.message.join('; ') : r.json?.message ?? '');
const aboutDays = (iso, days = 7) => {
  const diff = new Date(iso).getTime() - Date.now() - days * 86_400_000;
  return Math.abs(diff) < 10 * 60_000;
};
const noPassword = (r) => !/password/i.test(r.text);

let current;
// inSummary: false keeps a block that is not a case run out of the SUMMARY line.
function begin(id, { inSummary = true } = {}) { current = { id, inSummary, checks: [] }; results.push(current); log(id); }
function check(what, ok, actual) {
  current.checks.push({ what, ok: !!ok, actual });
  log(`  ${ok ? 'ok  ' : 'FAIL'} ${what} -> ${actual}`);
}
const st = (r) => `${r.status}${msg(r) ? ` "${msg(r)}"` : ''}`;

// ---- TC-B0-AUTH-01 ----
begin('AUTH-01a');
const a = await signUp('b0-01@example.com');
check('201', a.status === 201, st(a));
check('token present', typeof a.json?.token === 'string' && a.json.token.length > 20, `token length ${a.json?.token?.length}`);
check('expiresAt about 7 days ahead', aboutDays(a.json?.expiresAt), a.json?.expiresAt);
check('user email and display name', a.json?.user?.email === 'b0-01@example.com' && a.json?.user?.displayName === NAME, JSON.stringify(a.json?.user));
check('accountRestored false', a.json?.accountRestored === false, String(a.json?.accountRestored));
check('no password field anywhere', noPassword(a), `keys: ${Object.keys(a.json ?? {}).join(', ')}; user keys: ${Object.keys(a.json?.user ?? {}).join(', ')}`);
const tokenA = a.json?.token;

begin('AUTH-01b');
const b = await signUp(' B0-02@Example.COM ');
check('201', b.status === 201, st(b));
check('stored email lowercased and trimmed', b.json?.user?.email === 'b0-02@example.com', b.json?.user?.email);
const b2 = await signIn('b0-02@example.com');
check('sign-in 200', b2.status === 200, st(b2));

begin('AUTH-01c');
const c = await signUp('b0-03@example.com', { acceptedTerms: false });
check('400 "acceptedTerms must be true"', c.status === 400 && msg(c).includes('acceptedTerms must be true'), st(c));
const c2 = await signIn('b0-03@example.com');
check('sign-in 401', c2.status === 401, st(c2));
check('no account in users', accounts('b0-03@example.com') === 0, `${accounts('b0-03@example.com')} rows`);

begin('AUTH-01d');
const d = await signUp('b0-05@example.com', { password: 'abcdefghi' });
check('400, password too short', d.status === 400 && /password.*10/.test(msg(d)), st(d));
check('no account in users', accounts('b0-05@example.com') === 0, `${accounts('b0-05@example.com')} rows`);

begin('AUTH-01e');
const e = await signUp('b0-06@example.com', { password: 'abcdefghij' });
check('201 with 10 characters', e.status === 201, st(e));

begin('AUTH-01f');
const f1 = await signUp('b0-07@example.com', { password: 'a'.repeat(129) });
check('129 characters: 400', f1.status === 400, st(f1));
check('129: no account', accounts('b0-07@example.com') === 0, `${accounts('b0-07@example.com')} rows`);
const f2 = await signUp('b0-08@example.com', { password: 'a'.repeat(128) });
check('128 characters: 201', f2.status === 201, st(f2));

begin('AUTH-01g');
const g1 = await signUp('b0-09@example.com', { displayName: '' });
check('empty name: 400', g1.status === 400, st(g1));
const g2 = await signUp('b0-10@example.com', { displayName: '   ' });
check('spaces-only name: 400', g2.status === 400, st(g2));
check('no account for either', accounts('b0-09@example.com') + accounts('b0-10@example.com') === 0, `${accounts('b0-09@example.com') + accounts('b0-10@example.com')} rows`);

begin('AUTH-01h');
const h1 = await signUp('b0-11@example.com', { displayName: 'x'.repeat(101) });
check('101 characters: 400', h1.status === 400, st(h1));
const h2 = await signUp('b0-12@example.com', { displayName: 'x'.repeat(100) });
check('100 characters: 201', h2.status === 201, st(h2));

begin('AUTH-01i');
const i = await signUp('not-an-email');
check('400, email invalid', i.status === 400 && /email must be an email/.test(msg(i)), st(i));

begin('AUTH-01j');
const j = await signUp('B0-01@example.com');
check('409 "An account with this email already exists"', j.status === 409 && msg(j) === 'An account with this email already exists', st(j));
check('still exactly one account', accounts('b0-01@example.com') === 1, `${accounts('b0-01@example.com')} rows`);

begin('AUTH-01k');
const k = await signIn('b0-01@example.com');
check('200', k.status === 200, st(k));
check('new token', k.json?.token && k.json.token !== tokenA, k.json?.token !== tokenA ? 'differs from AUTH-01a token' : 'same token');
check('accountRestored false', k.json?.accountRestored === false, String(k.json?.accountRestored));

begin('AUTH-01l');
const l = await signIn('B0-01@EXAMPLE.COM');
check('200', l.status === 200, st(l));

begin('AUTH-01m');
const m = await signIn('b0-01@example.com', 'wrong password 123');
check('401 "Invalid email or password"', m.status === 401 && msg(m) === 'Invalid email or password', st(m));

begin('AUTH-01n');
const n = await signIn('nobody-b0@example.com');
check('401', n.status === 401, st(n));
check('body identical to AUTH-01m', n.text === m.text, n.text);

begin('AUTH-01o');
await waitMinute('the 11 sign-ins');
const oStatus = [];
for (let x = 0; x < 11; x++) oStatus.push((await call('POST', '/auth/sign-in', { body: { email: 'b0-01@example.com', password: 'wrong password 123' } })).status);
check('requests 1-10: 401', oStatus.slice(0, 10).every((s) => s === 401), oStatus.slice(0, 10).join(','));
check('request 11: 429', oStatus[10] === 429, String(oStatus[10]));
await waitMinute('the correct sign-in');
const o2 = await signIn('b0-01@example.com');
check('after the minute: 200', o2.status === 200, st(o2));

begin('AUTH-01p');
await waitMinute('the 11 sign-ups');
const pStatus = [];
for (let x = 1; x <= 11; x++) pStatus.push((await call('POST', '/auth/sign-up', { body: { email: `b0-p${String(x).padStart(2, '0')}@example.com`, password: PW, displayName: NAME, acceptedTerms: true } })).status);
check('requests 1-10 answered normally (201)', pStatus.slice(0, 10).every((s) => s === 201), pStatus.slice(0, 10).join(','));
check('request 11: 429', pStatus[10] === 429, String(pStatus[10]));
windows['sign-up'] = { start: Date.now(), count: 10 };

// ---- TC-B0-SESS-01 ----
log('setup: sign up S2 b0-04@example.com');
const s2 = await signUp('b0-04@example.com');
if (s2.status !== 201) log('  S2 sign-up failed', st(s2));

begin('SESS-01a');
const sa = await call('GET', '/users/me');
check('401', sa.status === 401, st(sa));

begin('SESS-01b');
const sb = await me('not-a-real-token');
check('401', sb.status === 401, st(sb));

begin('SESS-01c');
const sc = await signIn('b0-01@example.com');
const T1 = sc.json?.token;
const expiries = [['SESS-01c sign-in', sc.json?.expiresAt]];
const sc2 = await me(T1);
check('200', sc2.status === 200, st(sc2));
check("S1's email and display name", sc2.json?.email === 'b0-01@example.com' && sc2.json?.displayName === NAME, JSON.stringify(sc2.json));
check('no password field', noPassword(sc2), `keys: ${Object.keys(sc2.json ?? {}).join(', ')}`);

begin('SESS-01d');
const sd = await signIn('b0-01@example.com');
const T2 = sd.json?.token;
expiries.push(['SESS-01d sign-in', sd.json?.expiresAt]);
const listT2 = await sessions(T2);
const listT1 = await sessions(T1);
const T2id = listT2.json?.find?.((s) => s.current)?.id;
const T1id = listT1.json?.find?.((s) => s.current)?.id;
check('200', listT2.status === 200, st(listT2));
check("lists T1's and T2's sessions", listT2.json?.some((s) => s.id === T1id) && listT2.json?.some((s) => s.id === T2id), `${listT2.json?.length} sessions`);
check("exactly one current: true, T2's", listT2.json?.filter((s) => s.current).length === 1 && T2id && T2id !== T1id, `current count ${listT2.json?.filter((s) => s.current).length}`);
check('each has a browser description and an expiry', listT2.json?.every((s) => s.userAgent && s.expiresAt), `userAgent "${listT2.json?.[0]?.userAgent}"`);

begin('SESS-01e');
const se = await call('POST', '/auth/refresh', { token: T1 });
const T1b = se.json?.token;
expiries.push(['SESS-01e refresh', se.json?.expiresAt]);
check('refresh 200', se.status === 200, st(se));
check('expiresAt about 7 days ahead', aboutDays(se.json?.expiresAt), se.json?.expiresAt);
const se2 = await me(T1);
check('old token T1: 401', se2.status === 401, st(se2));
const se3 = await me(T1b);
check('new token T1b: 200', se3.status === 200, st(se3));
const listT1b = await sessions(T1b);
check('same session id kept', listT1b.json?.find?.((s) => s.current)?.id === T1id, `current id ${listT1b.json?.find?.((s) => s.current)?.id === T1id ? 'unchanged' : 'changed'}`);

begin('SESS-01f');
const sf = await call('DELETE', `/auth/sessions/${T2id}`, { token: T1b });
check('delete 204', sf.status === 204, st(sf));
const sf2 = await me(T2);
check('T2: 401', sf2.status === 401, st(sf2));
const sf3 = await sessions(T1b);
check("T2's session gone from the list", !sf3.json?.some?.((s) => s.id === T2id), `${sf3.json?.length} sessions left`);

begin('SESS-01g');
const sg = await signIn('b0-04@example.com');
const T3 = sg.json?.token;
const S2id = (await sessions(T3)).json?.find?.((s) => s.current)?.id;
const sg2 = await call('DELETE', `/auth/sessions/${S2id}`, { token: T1b });
check('delete 404 "Session not found"', sg2.status === 404 && msg(sg2) === 'Session not found', st(sg2));
const sg3 = await call('DELETE', `/auth/sessions/${randomUUID()}`, { token: T1b });
check('same answer as an id that does not exist', sg3.status === 404 && sg3.text === sg2.text, sg3.text);
const sg4 = await me(T3);
check('T3 still 200', sg4.status === 200, st(sg4));

begin('SESS-01h');
const sh = await call('DELETE', `/auth/sessions/${T2id}`, { token: T1b });
check('404, already revoked', sh.status === 404, st(sh));

begin('SESS-01i');
const si = await call('DELETE', '/auth/sessions/abc', { token: T1b });
check('400, not a UUID', si.status === 400, st(si));

begin('SESS-01j');
const sj = await call('POST', '/auth/sign-out', { token: T1b });
check('sign-out 204', sj.status === 204, st(sj));
const sj2 = await me(T1b);
check('T1b: 401', sj2.status === 401, st(sj2));
const sj3 = await me(T3);
check('T3 (S2): still 200', sj3.status === 200, st(sj3));

begin('SESS-01k');
const sk = await call('GET', '/health');
check('200 without sign-in', sk.status === 200, st(sk));

// SESS-01l is not run by hand (sessions last 7 days). This is only the expiry check in its place.
begin('SESS-01l (check in its place)', { inSummary: false });
for (const [where, iso] of expiries) check(`${where}: expiresAt about 7 days ahead`, aboutDays(iso), iso);

// ---- TC-B0-DB-01 (b, d, e) ----
begin('DB-01b');
const db = await call('GET', '/health');
check('body is {"status":"ok","database":"up","postgresVersion":"18.6"}', db.text === '{"status":"ok","database":"up","postgresVersion":"18.6"}', db.text);

begin('DB-01d');
const docs = await call('GET', '/docs');
check('docs page loads (200, HTML, Swagger UI)', docs.status === 200 && /text\/html/.test(docs.type) && /swagger/i.test(docs.text), `${docs.status} ${docs.type}`);
const dj = await call('GET', '/docs-json');
const tags = new Set(Object.values(dj.json?.paths ?? {}).flatMap((p) => Object.values(p).flatMap((op) => op.tags ?? [])));
check('groups health, auth and users listed', ['health', 'auth', 'users'].every((t) => tags.has(t)), [...tags].join(', '));
check('bearer scheme defined (Authorize button)', !!Object.values(dj.json?.components?.securitySchemes ?? {}).find((s) => s.scheme === 'bearer'), JSON.stringify(dj.json?.components?.securitySchemes));
check('JSON starts with "openapi": "3.2.0"', /^\{\s*"openapi"\s*:\s*"3\.2\.0"/.test(dj.text), dj.text.slice(0, 22));

begin('DB-01e');
const open = new Set(['GET /api/health', 'POST /api/auth/sign-up', 'POST /api/auth/sign-in']);
const answers = [];
for (const [path, ops] of Object.entries(dj.json?.paths ?? {})) {
  for (const method of Object.keys(ops)) {
    const full = path.startsWith('/api') ? path : `/api${path}`;
    const key = `${method.toUpperCase()} ${full}`;
    if (open.has(key)) continue;
    const url = full.replace(/^\/api/, '').replace(/\{[^}]+\}/g, randomUUID());
    const r = await call(method.toUpperCase(), url, { body: ['post', 'put', 'patch'].includes(method) ? {} : undefined });
    answers.push(`${key} ${r.status}`);
  }
}
check(`every other documented route answers 401 (${answers.length} routes)`, answers.length > 0 && answers.every((x) => x.endsWith(' 401')), answers.join(' | '));

for (const r of results) r.result = r.checks.every((x) => x.ok) ? 'passed' : 'failed';
writeFileSync(out, JSON.stringify(results, null, 2));
log('SUMMARY', results.filter((r) => r.inSummary).map((r) => `${r.id}:${r.result}`).join(' '));
