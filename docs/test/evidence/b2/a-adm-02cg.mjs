// TC-B2-ADM-02c to g on staging (docs/test/test-cases-b2.md §6), in order.
// Node 22, no dependencies: node docs/test/evidence/b2/a-adm-02cg.mjs. Prints statuses and bodies, never a token.
// Each check prints OK or MISMATCH against the case's expected result.
import { isDeepStrictEqual } from 'node:util';

const API = 'https://stag-omnicourses.lamter.cc/api';
const PASSWORD = 'correct horse battery';
const APCS = 'd3f524f8-e51b-42dd-91ac-013b15d5e033';

const call = async (method, path, { token, body } = {}) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(API + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, body: json };
};
const signIn = async (name) => (await call('POST', '/auth/sign-in', { body: { email: `b2-${name}@example.com`, password: PASSWORD } })).body.token;
let mismatches = 0;
const check = (label, ok, detail) => {
  if (!ok) mismatches++;
  console.log(`  ${ok ? 'OK' : 'MISMATCH'}  ${label}${detail === undefined ? '' : ` (${detail})`}`);
};
const show = (label, r) => console.log(`${label} → ${r.status} ${r.body === '' ? '(no body)' : JSON.stringify(r.body)}`);
const req = async (label, method, path, token, body) => {
  const r = await call(method, path, { token, body });
  show(`${label} ${method} ${path}`, r);
  return r;
};
const refused = (r, permission) => r.status === 403 && r.body.code === 'permission_required' && r.body.permission === permission;

console.log(`Run at ${new Date().toISOString()}`);
const t = Object.fromEntries(await Promise.all(['a1', 'a2', 'a3', 'a4', 's1'].map(async (n) => [n, await signIn(n)])));
const ids = {};
for (const n of Object.keys(t)) ids[n] = (await call('GET', '/users/me', { token: t[n] })).body.id;

const apcs24 = (await call('GET', '/programs/APCS/curricula/2024', { token: t.s1 })).body.id;
const a2List = (await call('GET', '/admin/programs', { token: t.a2 })).body;
const khmtProgram = a2List.programs.find((p) => p.code === 'CNTT-TCTA-KHMT');
const KHMT = khmtProgram.id;
const KHMT25 = khmtProgram.curricula.find((c) => c.cohortYear === 2025).id;
const khmtRead = () => call('GET', '/programs/CNTT-TCTA-KHMT/curricula/2025', { token: t.s1 });
const KG = (await khmtRead()).body.requirementGroups.find((g) => g.name === 'Kiến thức bắt buộc chuyên ngành').id;
console.log(`Values: {APCS}=${APCS} {APCS24}=${apcs24} {KHMT}=${KHMT} {KHMT25}=${KHMT25} {KG}=${KG}`);

const W_PATH = `/admin/programs/${APCS}/cohorts/${apcs24}/courses/CS420/offering-terms`;
const W_BODY = { terms: [1, 2] };
const C_BODY = { code: 'ZZADM02', nameVi: 'Học phần thử ADM-02', credits: 3 };
const G_PATH = `/admin/access/users/${ids.s1}/programs/${APCS}`;
const cs420 = async () => {
  const cur = await call('GET', '/programs/APCS/curricula/2024', { token: t.s1 });
  return cur.body.requirementGroups.flatMap((g) => g.courses).find((c) => c.code === 'CS420').offeringTerms;
};
const R = async () => {
  const terms = await cs420();
  const course = await call('GET', '/courses/ZZADM02', { token: t.s1 });
  const s1List = await call('GET', '/admin/programs', { token: t.s1 });
  console.log(`R: CS420 offeringTerms=${JSON.stringify(terms)}; GET /courses/ZZADM02 → ${course.status}; S1 list ${JSON.stringify(s1List.body)}`);
  check('R shows nothing changed', terms === null && course.status === 404 && isDeepStrictEqual(s1List.body, { programs: [] }));
};

// ---------------------------------------------------------------------------------------------
console.log('\n== TC-B2-ADM-02c: own program ==');
{
  const list = await req('A1', 'GET', '/admin/programs', t.a1);
  check(
    'list holds APCS only, with cohorts 2024 and 2025',
    list.body.programs.length === 1 && list.body.programs[0].code === 'APCS' && isDeepStrictEqual(list.body.programs[0].curricula.map((c) => c.cohortYear), [2024, 2025]),
  );
  const w = await req('A1 W', 'PUT', W_PATH, t.a1, W_BODY);
  check('W 200 { courseCode: CS420, terms: [1, 2] }', w.status === 200 && isDeepStrictEqual(w.body, { courseCode: 'CS420', terms: [1, 2] }));
  const after = await cs420();
  check('curriculum lists CS420 with offeringTerms [1, 2]', isDeepStrictEqual(after, [1, 2]), JSON.stringify(after));
  const clean = await req('A1 clean-up', 'DELETE', W_PATH, t.a1);
  check('clean-up 200 with terms null', clean.status === 200 && clean.body.terms === null);
  const back = await cs420();
  check('CS420 reads null again', back === null, JSON.stringify(back));
}

// ---------------------------------------------------------------------------------------------
console.log('\n== TC-B2-ADM-02d: other program ==');
{
  const K0 = (await khmtRead()).body;
  const s1 = await req('A1 (1)', 'PUT', `/admin/programs/${KHMT}/cohorts/${KHMT25}/courses/CSC14001/offering-terms`, t.a1, W_BODY);
  check('(1) 403 program_admin', refused(s1, 'program_admin'));
  const s2 = await req('A1 (2)', 'PUT', `/admin/programs/${APCS}/cohorts/${KHMT25}/courses/CSC14001/offering-terms`, t.a1, W_BODY);
  check('(2) 404 not_found "No such cohort in this program"', s2.status === 404 && s2.body.code === 'not_found' && s2.body.message === 'No such cohort in this program');
  const s3 = await req('A1 (3)', 'PUT', `/admin/programs/${APCS}/cohorts/${apcs24}/requirement-groups/${KG}/courses/CS420`, t.a1);
  check('(3) 404 not_found "No such requirement group in this cohort"', s3.status === 404 && s3.body.code === 'not_found' && s3.body.message === 'No such requirement group in this cohort');
  // Safety only: undo a write that should have been refused.
  if (s3.status === 204) await req('SAFETY unlink as A2', 'DELETE', `/admin/programs/${KHMT}/cohorts/${KHMT25}/requirement-groups/${KG}/courses/CS420`, t.a2);
  if (s1.status === 200 || s2.status === 200) await req('SAFETY clear as A2', 'DELETE', `/admin/programs/${KHMT}/cohorts/${KHMT25}/courses/CSC14001/offering-terms`, t.a2);
  const a2w = await req('A2 W', 'PUT', W_PATH, t.a2, W_BODY);
  check('A2 W 403 program_admin', refused(a2w, 'program_admin'));
  const K1 = (await khmtRead()).body;
  const csc14001 = K1.requirementGroups.flatMap((g) => g.courses).find((c) => c.code === 'CSC14001');
  const kg = K1.requirementGroups.find((g) => g.id === KG);
  console.log(`K1: CSC14001 offeringTerms=${JSON.stringify(csc14001.offeringTerms)}; KG has ${kg.courses.length} courses, CS420 in it: ${kg.courses.some((c) => c.code === 'CS420')}`);
  check('CLC equals K0 (whole curriculum read)', isDeepStrictEqual(K0, K1));
  await R();
}

// ---------------------------------------------------------------------------------------------
console.log('\n== TC-B2-ADM-02e: catalog only ==');
{
  const list = await req('A3', 'GET', '/admin/programs', t.a3);
  check('A3 list { programs: [] }', isDeepStrictEqual(list.body, { programs: [] }));
  const c = await req('A3 C', 'POST', '/admin/catalog/courses', t.a3, C_BODY);
  check('C 201', c.status === 201);
  try {
    const p = await req('A3', 'PATCH', '/admin/catalog/courses/ZZADM02', t.a3, { credits: 4 });
    check('PATCH 200 with credits 4', p.status === 200 && p.body.credits === 4);
    const g = await req('A3', 'GET', '/courses/ZZADM02', t.a3);
    check('GET shows 4 credits and no memberships', g.status === 200 && g.body.credits === 4 && isDeepStrictEqual(g.body.memberships, []));
    const w = await req('A3 W', 'PUT', W_PATH, t.a3, W_BODY);
    check('W 403 program_admin', refused(w, 'program_admin'));
    const terms = await cs420();
    check('CS420 still null', terms === null, JSON.stringify(terms));
  } finally {
    const d = await req('A3 clean-up', 'DELETE', '/admin/catalog/courses/ZZADM02', t.a3);
    check('clean-up 204', d.status === 204);
    const g = await req('A3', 'GET', '/courses/ZZADM02', t.a3);
    check('then 404', g.status === 404);
  }
}

// ---------------------------------------------------------------------------------------------
console.log('\n== TC-B2-ADM-02f: access manager only ==');
{
  const g = await req('A4 G', 'PUT', G_PATH, t.a4);
  try {
    check(
      'G 200: S1 holds APCS, grantedBy A4, no permissions',
      g.status === 200 && g.body.programs.length === 1 && g.body.programs[0].programId === APCS && g.body.programs[0].grantedBy === ids.a4 && isDeepStrictEqual(g.body.permissions, []),
    );
    const r1 = await req('A4', 'GET', `/admin/access/users/${ids.s1}/grants`, t.a4);
    check('grants read the same', isDeepStrictEqual(r1.body, g.body));
  } finally {
    const d = await req('A4', 'DELETE', G_PATH, t.a4);
    check('DELETE 200 with programs [] and permissions []', d.status === 200 && isDeepStrictEqual(d.body.programs, []) && isDeepStrictEqual(d.body.permissions, []));
  }
  const r2 = await req('A4', 'GET', `/admin/access/users/${ids.s1}/grants`, t.a4);
  check('grants read empty', isDeepStrictEqual(r2.body, { userId: ids.s1, programs: [], permissions: [] }));
  const list = await req('A4', 'GET', '/admin/programs', t.a4);
  check('A4 list { programs: [] }', isDeepStrictEqual(list.body, { programs: [] }));
  const w = await req('A4 W', 'PUT', W_PATH, t.a4, W_BODY);
  check('W 403 program_admin', refused(w, 'program_admin'));
  const c = await req('A4 C', 'POST', '/admin/catalog/courses', t.a4, C_BODY);
  check('C 403 catalog_maintainer', refused(c, 'catalog_maintainer'));
  if (c.status === 201) await req('SAFETY delete as A3', 'DELETE', '/admin/catalog/courses/ZZADM02', t.a3);
  if (w.status === 200) await req('SAFETY clear as A1', 'DELETE', W_PATH, t.a1);
  await R();
}

// ---------------------------------------------------------------------------------------------
console.log('\n== TC-B2-ADM-02g: revoked ==');
{
  const a1Token = t.a1; // signed in at the start of the run and kept
  let wroteAfterRevoke = false;
  try {
    const d = await req('A4', 'DELETE', `/admin/access/users/${ids.a1}/programs/${APCS}`, t.a4);
    check('DELETE 200 with programs []', d.status === 200 && isDeepStrictEqual(d.body.programs, []));
    const w = await req('A1 (same token) W', 'PUT', W_PATH, a1Token, W_BODY);
    check('W 403 program_admin', refused(w, 'program_admin'));
    wroteAfterRevoke = w.status === 200;
    const list = await req('A1', 'GET', '/admin/programs', a1Token);
    check('A1 list { programs: [] }', isDeepStrictEqual(list.body, { programs: [] }));
    const terms = await cs420();
    check('CS420 still null', terms === null, JSON.stringify(terms));
  } finally {
    const r = await req('A4 restore', 'PUT', `/admin/access/users/${ids.a1}/programs/${APCS}`, t.a4);
    check('restore 200 with APCS in programs', r.status === 200 && r.body.programs.some((p) => p.programId === APCS));
    if (wroteAfterRevoke) await req('SAFETY clear as A1', 'DELETE', W_PATH, t.a1);
  }
}

console.log(`\nDone: ${mismatches} mismatch(es).`);
