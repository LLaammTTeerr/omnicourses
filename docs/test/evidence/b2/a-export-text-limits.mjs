// Retests of #174/#175 (export date columns) and #163/#179 (null character, length in code points) on staging, 28 Nov 2026.
//   node docs/test/evidence/b2/a-export-text-limits.mjs
// RETEST-175: N2's export against N2's own notifications. RETEST-179a: a null character in a plan name (create, rename),
// a transcript course name, a sign-up display name and a profile class name. RETEST-179b: Vietnamese (decomposed) and
// emoji text at a field's limit, counted in code points. Account C (b2-s14) for 179; its transcript is put back to T-A
// and its test plans are deleted. The sign-ups use a new address that the refusals never create. Synthetic data only.
import { isDeepStrictEqual } from 'node:util';
import { call, check, failureCount, log, signInApi, T_A } from './c-lib.mjs';
import { PASSWORD } from './b-lib.mjs';

const N2 = 'b2-s10@example.com';
const C = 'b2-s14@example.com';
const NEVER_CREATED = 'b2-lim1@example.com';
const PLAN_NAME_MAX = 100;
const COURSE_NAME_MAX = 255;
const DISPLAY_NAME_MAX = 100;
const NUL = '\u0000';
const quiet = { quiet: true };
const cp = (s) => [...s].length;
const u16 = (s) => s.length;
const bytes = (s) => Buffer.byteLength(s, 'utf8');
const sizes = (s) => `${cp(s)} code points, ${u16(s)} UTF-16 units, ${bytes(s)} UTF-8 bytes`;

const VI_DECOMPOSED = 'Kế hoạch học tập'.normalize('NFD');
const EMOJI = '📚🎓';
const VS = '✏️';
const fill = (unit, n) => { let s = ''; while (cp(s + unit) <= n) s += unit; while (cp(s) < n) s += 'a'; return s.replace(/\s$/u, 'a'); };
const atMax = (n) => fill(`${VI_DECOMPOSED} ${EMOJI}${VS} `, n);

log('--- RETEST-175: export date columns (N2)');
{
  const n2 = (await signInApi(N2)).token;
  const api = [];
  let before = null;
  for (let i = 0; i < 20; i++) {
    const r = await call('GET', `/notifications${before ? `?before=${before}` : ''}`, { token: n2, show: (j) => `{${j?.notifications?.length} notifications}` });
    api.push(...r.json.notifications);
    if (!r.json.nextBefore) break;
    before = r.json.nextBefore;
  }
  const ex = await call('GET', '/users/me/export', { token: n2, ...quiet });
  const rows = ex.json?.tables?.notifications ?? [];
  const pairs = api.filter((n) => n.event).map((n) => {
    const row = rows.find((x) => x.id === n.id);
    return { kind: n.kind, api: [n.event.startsOn, n.event.endsOn], export: row ? [row.starts_on, row.ends_on] : null };
  });
  console.log(`  export 200? ${ex.status}; ${rows.length} notification rows; ${api.length} in the API, ${pairs.length} with a date`);
  for (const p of pairs) console.log(`  ${p.kind}: API ${JSON.stringify(p.api)} · export ${JSON.stringify(p.export)}`);
  const dateShaped = rows.every((r) => [r.starts_on, r.ends_on].every((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v)));
  check('RETEST-175', 'export 200; every dated notification has export starts_on/ends_on equal to the API\'s startsOn/endsOn, as YYYY-MM-DD',
    ex.status === 200 && pairs.length > 0 && pairs.every((p) => p.export && isDeepStrictEqual(p.api, p.export)) && dateShaped, { rows: rows.length, pairs: pairs.length, dateShaped });
}

log('--- RETEST-179a: null character');
const c = (await signInApi(C)).token;
const me0 = (await call('GET', '/users/me', { token: c, ...quiet })).json;
const tr0 = (await call('GET', '/users/me/transcript', { token: c, ...quiet })).json;
const plans0 = (await call('GET', '/plans', { token: c, ...quiet })).json.plans;
console.log(`  C before: className ${JSON.stringify(me0.className)}, ${tr0.rows.length} transcript rows, ${plans0.length} plans`);
const planBody = (name) => ({ name, programCode: 'APCS', cohortYear: 2024, terms: [] });
const created = [];
const nulMsg = (r, field) => r.status === 400 && JSON.stringify(r.json).includes(`${field} must not contain a null character (U+0000)`);
{
  const r1 = await call('POST', '/plans', { token: c, body: planBody(`Plan${NUL}name`) });
  const after1 = (await call('GET', '/plans', { token: c, ...quiet })).json.plans;
  check('RETEST-179a', 'plan name with U+0000 (POST /plans): 400 naming the null character, no plan created', nulMsg(r1, 'name') && after1.length === plans0.length, { status: r1.status, plans: after1.length });

  const ok = await call('POST', '/plans', { token: c, body: planBody('RETEST-179 plan') });
  if (ok.status === 201) created.push(ok.json.id);
  const r2 = await call('PATCH', `/plans/${ok.json.id}`, { token: c, body: { name: `Re${NUL}named` } });
  const got2 = (await call('GET', `/plans/${ok.json.id}`, { token: c, ...quiet })).json;
  check('RETEST-179a', 'rename with U+0000 (PATCH /plans/{id}): 400, name unchanged', ok.status === 201 && nulMsg(r2, 'name') && got2.name === 'RETEST-179 plan', { status: r2.status, name: got2.name });

  const bad = { rows: [{ ...T_A.rows[0], courseName: `Nhập môn${NUL}Tin học` }, ...T_A.rows.slice(1)] };
  const r3 = await call('PUT', '/users/me/transcript', { token: c, body: bad });
  const tr3 = (await call('GET', '/users/me/transcript', { token: c, ...quiet })).json;
  check('RETEST-179a', 'transcript courseName with U+0000 (PUT /users/me/transcript): 400, transcript unchanged', r3.status === 400 && JSON.stringify(r3.json).includes('must not contain a null character') && isDeepStrictEqual(tr3.rows, tr0.rows), { status: r3.status, rows: tr3.rows.length });

  const r4 = await call('PATCH', '/users/me', { token: c, body: { className: `24CTT${NUL}` } });
  const me4 = (await call('GET', '/users/me', { token: c, ...quiet })).json;
  check('RETEST-179a', 'className with U+0000 (PATCH /users/me): 400, className unchanged', r4.status === 400 && me4.className === me0.className, { status: r4.status, className: me4.className });

  const r5 = await call('POST', '/auth/sign-up', { body: { email: NEVER_CREATED, password: PASSWORD, displayName: `Test${NUL}Student`, acceptedTerms: true } });
  check('RETEST-179a', 'sign-up displayName with U+0000: 400 naming the null character (no account: see the sign-in at the end)', nulMsg(r5, 'displayName'), { status: r5.status });
}

log('--- RETEST-179b: length in code points');
{
  const exact = atMax(PLAN_NAME_MAX);
  const over = `${exact}a`;
  console.log(`  plan name at the limit: ${sizes(exact)}; one more: ${sizes(over)}`);
  const r1 = await call('POST', '/plans', { token: c, body: planBody(exact), ...quiet });
  if (r1.status === 201) created.push(r1.json.id);
  const got1 = r1.status === 201 ? (await call('GET', `/plans/${r1.json.id}`, { token: c, ...quiet })).json : null;
  check('RETEST-179b', `plan name of exactly ${PLAN_NAME_MAX} code points (more UTF-16 units and bytes): 201, stored unchanged`, r1.status === 201 && got1?.name === exact, { status: r1.status, storedSame: got1?.name === exact, stored: got1 && sizes(got1.name) });
  const r2 = await call('POST', '/plans', { token: c, body: planBody(over) });
  if (r2.status === 201) created.push(r2.json.id);
  check('RETEST-179b', `plan name of ${PLAN_NAME_MAX + 1} code points: 400 "name must be shorter than or equal to ${PLAN_NAME_MAX} characters"`, r2.status === 400 && JSON.stringify(r2.json).includes(`name must be shorter than or equal to ${PLAN_NAME_MAX} characters`), { status: r2.status });
  if (r1.status === 201) {
    const r3 = await call('PATCH', `/plans/${r1.json.id}`, { token: c, body: { name: over } });
    check('RETEST-179b', `rename to ${PLAN_NAME_MAX + 1} code points: 400`, r3.status === 400, { status: r3.status });
  }

  const cexact = atMax(COURSE_NAME_MAX);
  const cover = `${cexact}a`;
  console.log(`  course name at the limit: ${sizes(cexact)}; one more: ${sizes(cover)}`);
  const withName = (name) => ({ rows: [{ ...T_A.rows[0], courseName: name }, ...T_A.rows.slice(1)] });
  const r4 = await call('PUT', '/users/me/transcript', { token: c, body: withName(cover), ...quiet });
  const tr4 = (await call('GET', '/users/me/transcript', { token: c, ...quiet })).json;
  check('RETEST-179b', `courseName of ${COURSE_NAME_MAX + 1} code points: 400, transcript unchanged`, r4.status === 400 && isDeepStrictEqual(tr4.rows, tr0.rows), { status: r4.status, body: r4.json });
  const r5 = await call('PUT', '/users/me/transcript', { token: c, body: withName(cexact), ...quiet });
  const tr5 = (await call('GET', '/users/me/transcript', { token: c, ...quiet })).json;
  const stored = tr5.rows.find((r) => r.courseCode === 'CS160')?.courseName;
  check('RETEST-179b', `courseName of exactly ${COURSE_NAME_MAX} code points: 200, stored unchanged`, r5.status === 200 && stored === cexact, { status: r5.status, storedSame: stored === cexact });

  const dover = atMax(DISPLAY_NAME_MAX + 1);
  console.log(`  display name one over: ${sizes(dover)}`);
  const r6 = await call('POST', '/auth/sign-up', { body: { email: NEVER_CREATED, password: PASSWORD, displayName: dover, acceptedTerms: true }, quiet: true });
  check('RETEST-179b', `sign-up displayName of ${DISPLAY_NAME_MAX + 1} code points: 400`, r6.status === 400 && JSON.stringify(r6.json).includes(`shorter than or equal to ${DISPLAY_NAME_MAX} characters`), { status: r6.status, body: r6.json });
}

log('--- clean-up');
{
  const del = [];
  for (const id of created) del.push((await call('DELETE', `/plans/${id}`, { token: c })).status);
  const put = await call('PUT', '/users/me/transcript', { token: c, body: { rows: tr0.rows.map(({ courseCode, courseName, credits, result, grade, term }) => ({ courseCode, courseName, credits, result, grade, term })) }, ...quiet });
  const tr = (await call('GET', '/users/me/transcript', { token: c, ...quiet })).json;
  const plans = (await call('GET', '/plans', { token: c, ...quiet })).json.plans;
  const me = (await call('GET', '/users/me', { token: c, ...quiet })).json;
  check('clean-up', 'test plans deleted (204 each); C has its plans, transcript and className as before',
    del.every((s) => s === 204) && put.status === 200 && isDeepStrictEqual(tr.rows, tr0.rows) && plans.length === plans0.length && me.className === me0.className, { del, transcript: put.status, rows: tr.rows.length, plans: plans.length });
  const si = await call('POST', '/auth/sign-in', { body: { email: NEVER_CREATED, password: PASSWORD } });
  check('clean-up', `${NEVER_CREATED} was never created: sign-in 401`, si.status === 401, { status: si.status });
}
log(failureCount() ? `${failureCount()} FAIL(S)` : 'All checks ok');
