// TC-B2-TRN-02 API steps on staging (docs/test/test-cases-b2.md §5), one case per run, so the screen
// checks can follow each save: node docs/test/evidence/b2/a-trn-02.mjs <a|c|d|e|g|h|setup>
// Node 22, no dependencies. Prints statuses and bodies, never a token. Checks each expected result (OK / MISMATCH).
// `setup` signs up (or signs in) S2–S5 and onboards them to APCS 2024 with the goal fields unset.
// `e` only saves T-A: the rest of TRN-02e is on the screen.
import { isDeepStrictEqual } from 'node:util';

const API = 'https://stag-omnicourses.lamter.cc/api';
const PASSWORD = 'correct horse battery';
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

const row = (courseCode, courseName, credits, result, grade, year, number) => ({ courseCode, courseName, credits, result, grade, term: { year, number } });
const TA = { rows: [row('CS160', 'Nhập môn Tin học', 4, 'graded', 8.5, 2024, 1), row('CM102', 'Tư duy độc lập', 4, 'graded', 7.5, 2024, 1), row('MTH251', 'Vi tích phân I', 4, 'graded', 7.0, 2024, 1)] };
const TB = { rows: [row('PH211', 'Vật lý đại cương I', 4, 'graded', 6.5, 2024, 1), row('CS163', 'Cấu trúc dữ liệu', 4, 'graded', 8.0, 2024, 2)] };
const TR = { rows: [row('CS160', 'Nhập môn Tin học', 4, 'graded', 3.0, 2024, 1), row('CS160', 'Nhập môn Tin học', 4, 'graded', 8.0, 2024, 2)] };
const TZ = { rows: [row('CS160', 'Nhập môn Tin học', 4, 'graded', 8.5, 2024, 1), row('ZZ901', 'Synthetic Outside Course', 3, 'graded', 8.0, 2024, 2)] };
const TK = { rows: [
  row('CS160', 'Nhập môn Tin học', 4, 'graded', 8.5, 2024, 1),
  row('BAA00030', 'Giáo dục quốc phòng - An ninh', 4, 'pass', null, 2024, 1),
  row('MTH252', 'Vi tích phân II', 4, 'exempt', null, 2024, 2),
  row('PH212', 'Vật lý đại cương II', 4, 'fail', null, 2024, 2),
  row('CS202', 'Các hệ thống lập trình', 4, 'graded', 9.0, 2024, 3),
  row('CS201', 'Lập trình hệ thống', 4, 'in_progress', null, 2025, 1),
] };
// The stored rows, without any id or timestamp the API adds, to compare with what was sent.
const fields = (r) => ({ courseCode: r.courseCode, courseName: r.courseName, credits: r.credits, result: r.result, grade: r.grade, term: { year: r.term.year, number: r.term.number } });
const rowsOf = (body) => (body?.rows ?? []).map(fields);
// The API lists rows oldest term first and orders the rows of one term by code; the cases ask only for the term order.
// Compare as sets within a term (a stable sort keeps two attempts of one course in their term order), and check the term order apart.
const termKey = (r) => r.term.year * 10 + r.term.number;
const sorted = (rows) => [...rows].sort((x, y) => termKey(x) - termKey(y) || x.courseCode.localeCompare(y.courseCode));
const same = (body, t) => isDeepStrictEqual(sorted(rowsOf(body)), sorted(t.rows));
const oldestFirst = (body) => rowsOf(body).every((r, i, a) => i === 0 || termKey(a[i - 1]) <= termKey(r));

const which = process.argv[2];
console.log(`TRN-02${which} run at ${new Date().toISOString()}`);

if (which === 'setup') {
  for (const n of [2, 3, 4, 5]) {
    const email = `b2-s${n}@example.com`;
    let token = await signIn(email);
    if (!token) {
      const up = await call('POST', '/auth/sign-up', null, { email, password: PASSWORD, displayName: 'Test Student', acceptedTerms: true }, { quiet: true });
      token = up.body.token ?? (await signIn(email));
    }
    const me = await call('GET', '/users/me', token, undefined, { quiet: true });
    console.log(`  ${email} id ${me.body.id}`);
    const ob = await call('PUT', '/users/me/onboarding', token, { program: 'APCS', cohort: 2024, targetGraduationTerm: null, creditsPerTerm: null, internshipTerm: null, finished: true });
    check(`${email} onboarded to APCS 2024`, ob.status === 200);
  }
} else {
  const s1 = await signIn('b2-s1@example.com');
  const get = () => call('GET', '/users/me/transcript', s1);
  if (which === 'a') {
    const a = await call('PUT', '/users/me/transcript', s1, TA);
    check('T-A save 200', a.status === 200);
    const b = await call('PUT', '/users/me/transcript', s1, TB);
    check('T-B save 200, answer holds T-B only', b.status === 200 && same(b.body, TB));
    const g = await get();
    check('GET returns exactly T-B (PH211, CS163)', same(g.body, TB));
  } else if (which === 'c') {
    const r = await call('PUT', '/users/me/transcript', s1, TR);
    check('T-R save 200', r.status === 200);
    const g = await get();
    check('GET: 2 CS160 rows, 2024/1 grade 3.0 first, then 2024/2 grade 8.0', isDeepStrictEqual(rowsOf(g.body), TR.rows));
  } else if (which === 'd') {
    const z = await call('PUT', '/users/me/transcript', s1, TZ);
    check('T-Z save 200', z.status === 200);
    const g = await get();
    check('GET keeps ZZ901', rowsOf(g.body).some((r) => r.courseCode === 'ZZ901'));
    const audit = await call('GET', '/users/me/audit', s1);
    const unmatched = JSON.stringify(audit.body.unmatchedCourses ?? null);
    check('audit unmatchedCourses lists ZZ901', unmatched.includes('ZZ901'));
    check('audit unmatchedCourses does not list CS160', !unmatched.includes('CS160'));
    check('audit warnings: not_in_curriculum for ZZ901', (audit.body.warnings ?? []).some((w) => JSON.stringify(w).includes('not_in_curriculum') && JSON.stringify(w).includes('ZZ901')));
  } else if (which === 'e') {
    const a = await call('PUT', '/users/me/transcript', s1, TA);
    check('T-A save 200', a.status === 200 && same(a.body, TA));
  } else if (which === 'g') {
    const a = await call('PUT', '/users/me/transcript', s1, TA);
    check('T-A save 200', a.status === 200);
    const bad = { rows: [...TB.rows, { ...TB.rows[1], credits: 31 }] };
    const b = await call('PUT', '/users/me/transcript', s1, bad);
    check('T-B + 31-credit row: 400 with "rows.2.credits must not be greater than 30"', b.status === 400 && JSON.stringify(b.body.message).includes('rows.2.credits must not be greater than 30'));
    const g = await get();
    check('GET returns exactly T-A', same(g.body, TA));
  } else if (which === 'h') {
    const k = await call('PUT', '/users/me/transcript', s1, TK);
    check('T-K save 200', k.status === 200);
    const g = await get();
    check('GET returns T-K as sent, oldest term first (CS202 in 2024/3, grade null unless graded)', same(g.body, TK) && oldestFirst(g.body));
    for (const i of TK.rows.keys()) {
      if (TK.rows[i].result === 'graded') continue;
      const crafted = { rows: TK.rows.map((r, j) => (j === i ? { ...r, grade: 7.0 } : r)) };
      const res = await call('PUT', '/users/me/transcript', s1, crafted);
      check(`${TK.rows[i].courseCode} (${TK.rows[i].result}) with grade 7.0: 400 "grade must be null unless result is graded"`, res.status === 400 && JSON.stringify(res.body.message).includes('grade must be null unless result is graded'));
      const after = await get();
      check('  GET still returns T-K unchanged', same(after.body, TK));
    }
  } else {
    console.log('Unknown case. Use setup, a, c, d, e, g or h.');
    process.exit(2);
  }
}
console.log(`\nDone: ${mismatches} mismatch(es).`);
