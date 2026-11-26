// The API-only cases of TC-B1-USER-01 that need no database access, run against staging:
// USER-01m, o, s, t, v, and the API side of USER-01r (the psql comparison is not possible here).
// Usage: RUN=<id> TOKEN_CACHE=<file outside the repo> LEDGER=<file> node b1-user-api-cases.mjs
import { createHash } from 'node:crypto';
import { account, begin, call, check, email, eq, note, PW, signInAgain, summary } from './lib.mjs';

const sha256 = (t) => createHash('sha256').update(t).digest('hex'); // sessions.token_hash (auth.service.ts hashToken)
const S1_ROWS = [
  { courseCode: 'ZZ101', courseName: 'Synthetic Course One', credits: 4, result: 'graded', grade: 8.5, term: { year: 2024, number: 1 } },
  { courseCode: 'ZZ102', courseName: 'Synthetic Course Two', credits: 2, result: 'pass', grade: null, term: { year: 2024, number: 3 } },
  { courseCode: 'ZZ103', courseName: 'Synthetic Course Three', credits: 3, result: 'in_progress', grade: null, term: { year: 2025, number: 1 } },
];
const S2_ROWS = [{ courseCode: 'ZZ201', courseName: 'Synthetic Course Other', credits: 4, result: 'graded', grade: 7.0, term: { year: 2025, number: 1 } }];
const S1_GOALS = { program: 'APCS', cohort: 2024, targetGraduationTerm: { year: 2027, number: 2 }, creditsPerTerm: 18, internshipTerm: { year: 2027, number: 1 }, finished: true };
const S2_GOALS = { program: 'APCS', cohort: 2025, targetGraduationTerm: null, creditsPerTerm: 15, internshipTerm: 'none', finished: true };

// Prepare (test-cases-b1.md §2 Export): S1 onboarded with the three goals, the S1 transcript, two
// sessions and a plan; S2 onboarded with the S2 transcript.
const bodies = {}; // response texts for USER-01o
const s1 = await account('us1');
const s2 = await account('us2');
bodies['PUT /users/me/onboarding'] = (await call('PUT', '/users/me/onboarding', { token: s1.token, body: S1_GOALS })).text;
await call('PUT', '/users/me/onboarding', { token: s2.token, body: S2_GOALS });
await call('PUT', '/users/me/transcript', { token: s1.token, body: { rows: S1_ROWS } });
await call('PUT', '/users/me/transcript', { token: s2.token, body: { rows: S2_ROWS } });
const second = await signInAgain('us1');
bodies['POST /auth/sign-in'] = second.text;
const tokens = [s1.token, second.json.token];
const plans = (await call('GET', '/plans', { token: s1.token })).json.plans;
if (plans.length === 0) await call('POST', '/plans', { token: s1.token, body: { name: 'Standard 4-Year', programCode: 'APCS', cohortYear: 2024 } });

begin('USER-01m');
for (const [method, body] of [['GET'], ['PUT', S1_GOALS]]) {
  const r = await call(method, '/users/me/onboarding', { body });
  check(`${method} /api/users/me/onboarding without a token: 401`, r.status === 401, r.status);
}
let r = await call('GET', '/users/me/onboarding', { token: s2.token });
check('with S2’s token: only S2’s own answers', r.status === 200 && eq(r.json, S2_GOALS), r.json);
note('neither onboarding route takes a user id in its path or body (OpenAPI: /api/users/me/onboarding, OnboardingDto); the next call sends S1’s id as extra fields');
r = await call('PUT', '/users/me/onboarding', { token: s2.token, body: { ...S2_GOALS, creditsPerTerm: 16, userId: s1.id, user_id: s1.id, id: s1.id } });
note(`PUT with S2’s token and S1’s id as userId, user_id and id: ${r.status} ${r.status === 200 ? JSON.stringify(r.json) : r.text}`);
const s1After = await call('GET', '/users/me/onboarding', { token: s1.token });
check('S1’s answers are unchanged when read with S1’s token', eq(s1After.json, S1_GOALS), s1After.json);
const s2After = await call('GET', '/users/me/onboarding', { token: s2.token });
check('the call was refused, or changed only S2’s own answers', r.status === 400 || s2After.json.creditsPerTerm === 16, `S2 creditsPerTerm now ${s2After.json.creditsPerTerm}`);
bodies['GET /users/me/onboarding'] = s1After.text;

begin('USER-01o');
// Sign-up body: a new account made only for this response.
const fresh = email('uo1');
const { appendFileSync } = await import('node:fs');
await new Promise((res) => setTimeout(res, 21_000));
const up = await call('POST', '/auth/sign-up', { body: { email: fresh, password: PW, displayName: 'Test Student', acceptedTerms: true } });
if (up.status === 201) appendFileSync(process.env.LEDGER, fresh + '\n');
bodies['POST /auth/sign-up'] = up.text;
const refreshed = await call('POST', '/auth/refresh', { token: up.json.token });
bodies['POST /auth/refresh'] = refreshed.text;
bodies['GET /users/me'] = (await call('GET', '/users/me', { token: s1.token })).text;
bodies['GET /auth/sessions'] = (await call('GET', '/auth/sessions', { token: s1.token })).text;
const exportRes = await call('GET', '/users/me/export', { token: s1.token });
bodies['GET /users/me/export'] = exportRes.text;
note(`sign-up ${up.status}, refresh ${refreshed.status}`);
const keysOf = (v, out = new Set()) => {
  if (Array.isArray(v)) v.forEach((x) => keysOf(x, out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { out.add(k); keysOf(x, out); }
  return out;
};
for (const [route, text] of Object.entries(bodies)) {
  const keys = [...keysOf(JSON.parse(text))];
  const bad = keys.filter((k) => /^(password|passwordHash|password_hash)$/.test(k));
  check(`${route}: no key named password, passwordHash or password_hash; no argon2 hash, no test password`, bad.length === 0 && !text.includes('$argon2') && !text.includes(PW), `${keys.length} distinct keys${bad.length ? '; BAD: ' + bad.join(', ') : ''}`);
}
note('The hash itself (USER-01n) cannot be read on staging without database access. An argon2 hash always starts with "$argon2", so its absence from every body is what was checked.');

begin('USER-01r (API side only)');
const ex = exportRes.json;
const disp = exportRes.headers.get('content-disposition');
check('200, sent as a download named omnicourse-account.json', exportRes.status === 200 && /attachment/.test(disp ?? '') && /omnicourse-account\.json/.test(disp ?? ''), `${exportRes.status} ${disp}`);
note(`user keys: ${Object.keys(ex.user).join(', ')}`);
check('user holds S1’s id, email, display name and consent_at', ex.user.id === s1.id && ex.user.email === s1.email && (ex.user.display_name ?? ex.user.displayName) === 'Test Student' && !!ex.user.consent_at, { email: ex.user.email, display_name: ex.user.display_name ?? ex.user.displayName, consent_at: ex.user.consent_at });
note(`tables: ${Object.entries(ex.tables).map(([k, v]) => `${k} (${v.length})`).join(', ')}`);
const ob = ex.tables.onboarding_answers?.[0];
note(`onboarding_answers row: ${JSON.stringify(ob && Object.fromEntries(Object.entries(ob).filter(([k]) => !/^(id|user_id)$/.test(k))))}`);
check('the onboarding answers appear with the values from Prepare', !!ob && JSON.stringify(ob).includes('18') && /2027/.test(JSON.stringify(ob)), 'see the row above');
check('3 transcript rows and at least 2 sessions', ex.tables.transcript_rows.length === 3 && ex.tables.sessions.length >= 2, `${ex.tables.transcript_rows.length} transcript rows, ${ex.tables.sessions.length} sessions`);
check('at least one plan', ex.tables.plans.length >= 1, ex.tables.plans.length);
note('NOT DONE: the user-table query of §1 (psql) to compare the table list and row counts. It needs database access on staging.');

begin('USER-01s');
const text = exportRes.text;
const allKeys = [...keysOf(ex)];
const secretKey = /(_hash|_token|_secret|_key|_password|_sub|Hash|Token|Secret|Key|Password|Sub)$/;
const hits = allKeys.filter((k) => secretKey.test(k));
check('no key at any depth ends in _hash, _token, _secret, _key, _password, _sub or a camelCase form', hits.length === 0, `${allKeys.length} distinct keys: ${allKeys.join(', ')}`);
check('the file holds neither bearer token of S1’s two sessions', tokens.every((t) => !text.includes(t)), 'neither token found');
check('the file holds no session token hash (SHA-256 of each token, hashToken in auth.service.ts)', tokens.every((t) => !text.includes(sha256(t))), 'neither hash found');
check('the file holds no argon2 hash and not the test password', !text.includes('$argon2') && !text.includes(PW), 'no "$argon2", no password');

begin('USER-01t');
check('S2’s id, email and ZZ201 appear nowhere in S1’s file', !text.includes(s2.id) && !text.includes(s2.email) && !text.includes('ZZ201'), 'none of the three found');
check('control: the same search does find S1’s own id, email and ZZ101', text.includes(s1.id) && text.includes(s1.email) && text.includes('ZZ101'), 'all three found');

begin('USER-01v');
r = await call('DELETE', '/users/me', { token: s1.token, body: { password: 'not the password' } });
check('403 "Wrong password"', r.status === 403 && r.json?.message === 'Wrong password', `${r.status} ${r.text}`);
const meAfter = await call('GET', '/users/me', { token: s1.token });
check('S1 is still signed in: GET /api/users/me 200', meAfter.status === 200, meAfter.status);
const ex2 = (await call('GET', '/users/me/export', { token: s1.token })).json;
check('deletion_requested_at is still null (read from the export’s user row)', 'deletion_requested_at' in ex2.user && ex2.user.deletion_requested_at === null, { deletion_requested_at: ex2.user.deletion_requested_at, purge_after: ex2.user.purge_after });

summary();
