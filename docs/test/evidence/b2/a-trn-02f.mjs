// TC-B2-TRN-02f on staging (docs/test/test-cases-b2.md §5): export, deletion and purge of S2's transcript.
// Node 22, no dependencies, run from the repository root. Prints statuses and bodies, never a token.
//   node docs/test/evidence/b2/a-trn-02f.mjs before   S2 saves the completion fixture, reads it, exports, then deletes the account.
//                                                     Also notes S1's transcript, to compare after the purge.
//   node docs/test/evidence/b2/a-trn-02f.mjs after    After the bot's purge: S2 can no longer sign in, and S1's transcript is unchanged.
// The database steps (user-table query, purge_after in the past) are the bot's, in the #130 thread.
import { readFileSync, writeFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';

const API = 'https://stag-omnicourses.lamter.cc/api';
const PASSWORD = 'correct horse battery';
const S1_NOTE = 'docs/test/evidence/b2/a-trn-02f-s1-before.json';
const call = async (method, path, token, body, { quiet = false } = {}) => {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = text; }
  console.log(`${method} ${path} → ${res.status}${quiet ? '' : ` ${JSON.stringify(parsed)}`}`);
  return { status: res.status, body: parsed };
};
let mismatches = 0;
const check = (label, ok) => {
  if (!ok) mismatches++;
  console.log(`  ${ok ? 'OK' : 'MISMATCH'}  ${label}`);
};
const signIn = async (email) => {
  const res = await fetch(`${API}/auth/sign-in`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: PASSWORD }) });
  console.log(`POST /auth/sign-in (${email}) → ${res.status}`);
  return res.ok ? (await res.json()).token : null;
};
// One row as a comparable string, from the API (camelCase) or from the export (whatever column names it uses).
const pick = (r, ...names) => names.map((n) => r[n]).find((v) => v !== undefined);
const key = (r) => {
  const term = r.term ?? { year: pick(r, 'term_year', 'termYear'), number: pick(r, 'term_number', 'termNumber') };
  return [pick(r, 'courseCode', 'course_code'), pick(r, 'courseName', 'course_name'), Number(r.credits), r.result, r.grade === null ? null : Number(r.grade), term.year, term.number].join('|');
};
const keys = (rows) => rows.map(key).sort();

const phase = process.argv[2];
console.log(`TRN-02f ${phase} run at ${new Date().toISOString()}`);

if (phase === 'before') {
  const fixture = JSON.parse(readFileSync('src/backend/test/fixtures/apcs-2024-completion.json', 'utf8'));
  const s2 = await signIn('b2-s2@example.com');
  const me = await call('GET', '/users/me', s2, undefined, { quiet: true });
  console.log(`  S2 id ${me.body.id}`);
  const ob = await call('GET', '/users/me/onboarding', s2);
  check('S2 onboarded to APCS 2024', ob.body.program === 'APCS' && ob.body.cohort === 2024 && ob.body.finished === true);
  const saved = await call('PUT', '/users/me/transcript', s2, fixture, { quiet: true });
  check(`fixture save 200 with ${fixture.rows.length} rows`, saved.status === 200 && saved.body.rows?.length === fixture.rows.length);
  const got = await call('GET', '/users/me/transcript', s2, undefined, { quiet: true });
  check(`GET returns ${got.body.rows?.length} rows, the fixture's rows`, isDeepStrictEqual(keys(got.body.rows), keys(fixture.rows)));
  const exp = await call('GET', '/users/me/export', s2, undefined, { quiet: true });
  check('export 200', exp.status === 200);
  console.log(`  export tables: ${Object.keys(exp.body.tables ?? {}).map((t) => `${t}(${exp.body.tables[t]?.length})`).join(', ')}`);
  const exported = exp.body.tables?.transcript_rows ?? [];
  console.log(`  first exported transcript row: ${JSON.stringify(exported[0])}`);
  check(`tables.transcript_rows holds ${exported.length} rows, as many as the GET`, exported.length === 45 && exported.length === got.body.rows.length);
  check('each exported row has the same code, name, credits, result, grade and term as the GET', isDeepStrictEqual(keys(exported), keys(got.body.rows)));

  const s1 = await signIn('b2-s1@example.com');
  const s1t = await call('GET', '/users/me/transcript', s1);
  writeFileSync(S1_NOTE, JSON.stringify(s1t.body, null, 2) + '\n');
  console.log(`  S1's transcript noted in ${S1_NOTE} (${s1t.body.rows.length} rows)`);

  if (mismatches > 0) {
    console.log('\nStopped before the deletion: fix or record the mismatches first, then run again.');
    process.exit(1);
  }
  const del = await call('DELETE', '/users/me', s2, { password: PASSWORD });
  check('DELETE /users/me answers 202', del.status === 202);
} else if (phase === 'after') {
  const s2 = await signIn('b2-s2@example.com');
  check('S2 can no longer sign in', s2 === null);
  const s1 = await signIn('b2-s1@example.com');
  const s1t = await call('GET', '/users/me/transcript', s1);
  check("S1's transcript is unchanged", isDeepStrictEqual(s1t.body, JSON.parse(readFileSync(S1_NOTE, 'utf8'))));
} else {
  console.log('Use before or after.');
  process.exit(2);
}
console.log(`\nDone: ${mismatches} mismatch(es).`);
