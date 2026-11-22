// TC-B2-ADM-01, ADM-05 and ADM-06 on staging (docs/test/test-cases-b2.md §6), API only.
//   node docs/test/evidence/b2/a-adm.mjs <pre|01|05a|05b|05c|05d|06a|06b|06c|06d|06e-before|06e-after|06f-before|06f-after>
// Node, no dependencies. Prints statuses and bodies, never a token. Checks each expected result (OK / MISMATCH).
// Never signs in as A5 after 06e-before or as A6 after 06f-before: signing in restores an account waiting for deletion.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';

const API = 'https://stag-omnicourses.lamter.cc/api';
const PASSWORD = 'correct horse battery';
const IDS_FILE = new URL('./a-adm-06-ids.json', import.meta.url);
const ID = {
  A1: '32addfef-209b-4eba-b728-dfacb9856ead',
  A2: '46054d9c-2960-42c7-a80c-53a520e0cb65',
  A3: 'b41c5d8d-83f7-42b2-ab4b-a83810bd520e',
  A4: '925cb9c8-86de-4427-a8c8-72cf442dd074',
  S1: '8ca00334-e8f3-4cfc-b285-944db1a971a4',
};

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
  return { status: res.status, body: parsed, text };
};
let mismatches = 0;
const check = (label, ok) => {
  if (!ok) mismatches++;
  console.log(`  ${ok ? 'OK' : 'MISMATCH'}  ${label}`);
};
// The sign-in and deletion routes take a password: 10 requests a minute from one address (ADR 0002,
// `rate-limits.ts`). A failed sign-in stops the run, so a case is never half sent with a missing token.
const signIn = async (email, { mayNotExist = false } = {}) => {
  const res = await fetch(`${API}/auth/sign-in`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: PASSWORD }) });
  console.log(`POST /auth/sign-in (${email}) → ${res.status}`);
  if (res.ok) return (await res.json()).token;
  if (mayNotExist && res.status === 401) return null;
  console.log(`STOPPED: sign-in as ${email} answered ${res.status}; nothing more was sent`);
  process.exit(2);
};
/** Signs the account up (or in, if it exists) and onboards it to APCS 2024 with the goal fields unset. */
const signUpOnboarded = async (email) => {
  let token = await signIn(email, { mayNotExist: true });
  if (!token) {
    const up = await call('POST', '/auth/sign-up', null, { email, password: PASSWORD, displayName: 'Test Student', acceptedTerms: true }, { quiet: true });
    check(`${email} sign-up 201`, up.status === 201);
    token = up.body.token ?? (await signIn(email));
  }
  const ob = await call('PUT', '/users/me/onboarding', token, { program: 'APCS', cohort: 2024, targetGraduationTerm: null, creditsPerTerm: null, internshipTerm: null, finished: true }, { quiet: true });
  check(`${email} onboarded to APCS 2024`, ob.status === 200);
  const me = await call('GET', '/users/me', token, undefined, { quiet: true });
  console.log(`  ${email} id ${me.body.id}`);
  return { token, id: me.body.id };
};
const messages = (body) => [].concat(body?.message ?? []);
const msgHas = (body, s) => messages(body).some((m) => String(m).includes(s));
const is = (res, status, code) => res.status === status && (code === undefined || res.body?.code === code);
const refused = (res, permission) => is(res, 403, 'permission_required') && res.body.permission === permission;

// ---- Values (ADM-02's table, plus {AC}) ------------------------------------------------------
const curriculum = async (token, program, year) => (await call('GET', `/programs/${program}/curricula/${year}`, token, undefined, { quiet: true })).body;
const groupsOf = (c) => c.requirementGroups ?? c.groups ?? [];
const groupNamed = (c, name) => groupsOf(c).find((g) => g.name === name);
const courseIn = (c, groupName, code) => groupNamed(c, groupName)?.courses.find((x) => x.code === code);
const values = async (a1, a2) => {
  const apcs = (await call('GET', '/admin/programs', a1, undefined, { quiet: true })).body.programs.find((p) => p.code === 'APCS');
  const khmt = (await call('GET', '/admin/programs', a2, undefined, { quiet: true })).body.programs.find((p) => p.code === 'CNTT-TCTA-KHMT');
  const v = {
    APCS: apcs.id,
    APCS24: apcs.curricula.find((c) => c.cohortYear === 2024).id,
    KHMT: khmt.id,
    KHMT25: khmt.curricula.find((c) => c.cohortYear === 2025).id,
    AC: groupNamed(await curriculum(a1, 'APCS', 2024), 'Tự chọn Computer Science (C)').id,
    KG: groupNamed(await curriculum(a1, 'CNTT-TCTA-KHMT', 2025), 'Kiến thức bắt buộc chuyên ngành').id,
  };
  console.log(`  values ${JSON.stringify(v)}`);
  return v;
};
const W = (v) => `/admin/programs/${v.APCS}/cohorts/${v.APCS24}/courses/CS420/offering-terms`;
const linkPath = (program, cohort, group, code) => `/admin/programs/${program}/cohorts/${cohort}/requirement-groups/${group}/courses/${code}`;

const which = process.argv[2];
console.log(`ADM ${which} run at ${new Date().toISOString()}`);

if (which === 'pre') {
  // ADM-02's "Accounts and grants": each grant as §1 says, none for S1.
  const a4 = await signIn('b2-a4@example.com');
  const g = async (id) => (await call('GET', `/admin/access/users/${id}/grants`, a4)).body;
  const a1 = await g(ID.A1), a2 = await g(ID.A2), a3 = await g(ID.A3), a4g = await g(ID.A4), s1 = await g(ID.S1);
  check('A1: APCS only', a1.programs.map((p) => p.programCode).join() === 'APCS' && a1.permissions.length === 0);
  check('A2: CNTT-TCTA-KHMT only', a2.programs.map((p) => p.programCode).join() === 'CNTT-TCTA-KHMT' && a2.permissions.length === 0);
  check('A3: catalog_maintainer only', a3.programs.length === 0 && a3.permissions.map((p) => p.permission).join() === 'catalog_maintainer');
  check('A4: access_manager only, grantedBy null', a4g.programs.length === 0 && a4g.permissions.map((p) => p.permission).join() === 'access_manager' && a4g.permissions[0].grantedBy === null);
  check('S1: no grant', s1.programs.length === 0 && s1.permissions.length === 0);
}

if (which === '01') {
  const N0 = 'History of Vietnamese Communist Party';
  const N1 = 'History of the Communist Party of Vietnam';
  const a1 = await signIn('b2-a1@example.com');
  const a3 = await signIn('b2-a3@example.com');
  const R1 = async () => {
    const course = (await call('GET', '/courses/BAA00104', a3, undefined, { quiet: true })).body;
    const apcs = courseIn(await curriculum(a3, 'APCS', 2024), 'Kiến thức Non Computer Science', 'BAA00104');
    const khmt = courseIn(await curriculum(a3, 'CNTT-TCTA-KHMT', 2025), 'Lý luận chính trị - Pháp luật', 'BAA00104');
    const r = { course: course.nameEn, apcs2024: apcs?.nameEn, khmt2025: khmt?.nameEn, credits: course.credits, memberships: course.memberships.map((m) => m.curriculumCode) };
    console.log(`  R1 ${JSON.stringify(r)}`);
    return r;
  };
  const reads = (r, n) => r.course === n && r.apcs2024 === n && r.khmt2025 === n;
  const path = '/admin/catalog/courses/BAA00104';

  console.log('--- ADM-01a');
  const r0 = await R1();
  check('R1 reads N0 in all three places, 11 memberships', reads(r0, N0) && r0.memberships.length === 11);
  const warn = await call('PATCH', path, a3, { nameEn: N1 });
  const affected = warn.body.affectedCurricula ?? [];
  check('first PATCH 409 impact_confirmation_required with a reviewVersion', is(warn, 409, 'impact_confirmation_required') && typeof warn.body.reviewVersion === 'string');
  check('11 affected curricula, each with curriculumId, curriculumCode, programCode, cohortYear', affected.length === 11 && affected.every((a) => a.curriculumId && a.curriculumCode && a.programCode && a.cohortYear));
  const codes = affected.map((a) => a.curriculumCode);
  check('APCS2024, APCS2025 first, then nine CNTT-TCTA-…-2025, CNTT-TCTA-KHMT-2025 among them', codes[0] === 'APCS2024' && codes[1] === 'APCS2025' && codes.slice(2).every((c) => /^CNTT-TCTA-.+-2025$/.test(c)) && codes.includes('CNTT-TCTA-KHMT-2025'));
  check('ordered by program code then cohort', isDeepStrictEqual(affected.map((a) => `${a.programCode}|${a.cohortYear}`), [...affected].sort((x, y) => (x.programCode < y.programCode ? -1 : x.programCode > y.programCode ? 1 : x.cohortYear - y.cohortYear)).map((a) => `${a.programCode}|${a.cohortYear}`)));
  check('the curricula are those of R1\'s memberships', isDeepStrictEqual([...codes].sort(), [...r0.memberships].sort()));
  check('nothing saved yet: R1 still N0', reads(await R1(), N0));
  const saved = await call('PATCH', path, a3, { nameEn: N1, confirmImpact: warn.body.reviewVersion });
  check('confirmed PATCH 200, code BAA00104, nameEn N1, 2 credits', saved.status === 200 && saved.body.code === 'BAA00104' && saved.body.nameEn === N1 && saved.body.credits === 2);
  check('R1 reads N1 in the course, APCS 2024 and CNTT-TCTA-KHMT 2025', reads(await R1(), N1));
  const back = await call('PATCH', path, a3, { nameEn: N0 });
  check('restore: 409 with another reviewVersion', is(back, 409, 'impact_confirmation_required') && back.body.reviewVersion !== warn.body.reviewVersion);
  const restored = await call('PATCH', path, a3, { nameEn: N0, confirmImpact: back.body.reviewVersion });
  check('restore confirmed 200', restored.status === 200 && restored.body.nameEn === N0);
  check('R1 reads N0 again', reads(await R1(), N0));

  console.log('--- ADM-01b');
  const b1 = await call('PATCH', path, a1, { nameEn: N1 });
  check('A1 PATCH 403 permission_required catalog_maintainer, no list or version', refused(b1, 'catalog_maintainer') && b1.body.affectedCurricula === undefined && b1.body.reviewVersion === undefined);
  const b2 = await call('PATCH', path, a1, { nameEn: N1, confirmImpact: warn.body.reviewVersion });
  check('A1 PATCH with confirmImpact 403 catalog_maintainer, no list or version', refused(b2, 'catalog_maintainer') && b2.body.affectedCurricula === undefined && b2.body.reviewVersion === undefined);
  check('R1 still N0', reads(await R1(), N0));

  console.log('--- ADM-01c');
  const apcs24 = (await call('GET', '/admin/programs', a1, undefined, { quiet: true })).body.programs.find((p) => p.code === 'APCS').curricula.find((c) => c.cohortYear === 2024).id;
  const c1 = await call('PATCH', path, a3, { nameEn: N1, curriculumId: apcs24 });
  check('curriculumId: 400 validation_failed, contains "property curriculumId should not exist"', is(c1, 400, 'validation_failed') && msgHas(c1.body, 'property curriculumId should not exist'));
  const c2 = await call('PATCH', path, a3, { nameEn: N1, cohortYear: 2024 });
  check('cohortYear: 400 validation_failed, contains "property cohortYear should not exist"', is(c2, 400, 'validation_failed') && msgHas(c2.body, 'property cohortYear should not exist'));
  check('R1 still N0', reads(await R1(), N0));
}

const ZZ5 = { nameVi: 'Học phần thử ADM-05', credits: 3 };
const course = async (token, code) => call('GET', `/courses/${code}`, token);

if (which === '05a') {
  const a1 = await signIn('b2-a1@example.com');
  const a3 = await signIn('b2-a3@example.com');
  const post = (body) => call('POST', '/admin/catalog/courses', a3, { ...ZZ5, ...body });
  const notCode = (code, field = 'code') => `${field}: "${code}" is not a course code (letters A-Z and digits, 2 to 20)`;
  for (const code of ['cs-1', 'Z', 'ZZADM05ZZADM05ZZADM05']) {
    const r = await post({ code });
    check(`(${code}) 400 validation_failed, "${notCode(code)}"`, is(r, 400, 'validation_failed') && msgHas(r.body, notCode(code)));
  }
  for (const credits of [0, -1]) {
    const r = await post({ code: 'ZZADM05', credits });
    check(`credits ${credits}: 400, "credits must not be less than 1"`, is(r, 400, 'validation_failed') && msgHas(r.body, 'credits must not be less than 1'));
  }
  const frac = await post({ code: 'ZZADM05', credits: 2.5 });
  check('credits 2.5: 400, "credits must be an integer number"', is(frac, 400, 'validation_failed') && msgHas(frac.body, 'credits must be an integer number'));
  check('GET ZZADM05 404: nothing saved', (await course(a3, 'ZZADM05')).status === 404);
  const made = await post({ code: ' zzadm05 ' });
  check('(7) " zzadm05 " 201 with code ZZADM05', made.status === 201 && made.body.code === 'ZZADM05');
  check('GET ZZADM05 200', (await course(a3, 'ZZADM05')).status === 200);
  for (const credits of [0, -1]) {
    const r = await call('PATCH', '/admin/catalog/courses/ZZADM05', a3, { credits });
    check(`PATCH credits ${credits}: 400, "credits must not be less than 1"`, is(r, 400, 'validation_failed') && msgHas(r.body, 'credits must not be less than 1'));
  }
  const p10 = await call('PATCH', '/admin/catalog/courses/cs-1', a3, { credits: 3 });
  check(`(10) 400, "${notCode('cs-1', 'courseCode')}"`, is(p10, 400, 'validation_failed') && msgHas(p10.body, notCode('cs-1', 'courseCode')));
  const p11 = await call('PATCH', '/admin/catalog/courses/BAA00104', a3, { credits: 0 });
  check('(11) BAA00104 credits 0: 400 validation_failed, not 409', is(p11, 400, 'validation_failed'));
  check('ZZADM05 still 3 credits', (await course(a3, 'ZZADM05')).body.credits === 3);
  check('BAA00104 still 2 credits', (await course(a3, 'BAA00104')).body.credits === 2);
  const dup = await post({ code: ' zzadm05 ' });
  check('(12) 409 duplicate_code, "The catalog already has ZZADM05"', is(dup, 409, 'duplicate_code') && msgHas(dup.body, 'The catalog already has ZZADM05'));
  const v = await values(a1, await signIn('b2-a2@example.com'));
  const before = groupNamed(await curriculum(a1, 'APCS', 2024), 'Tự chọn Computer Science (C)').courses.map((c) => c.code);
  const l13 = await call('PUT', linkPath(v.APCS, v.APCS24, v.AC, 'ZZADM99'), a1);
  check('(13) 404 not_found, "No catalog course has the code ZZADM99; a catalog maintainer adds it first"', is(l13, 404, 'not_found') && msgHas(l13.body, 'No catalog course has the code ZZADM99; a catalog maintainer adds it first'));
  const l14 = await call('PUT', linkPath(v.APCS, v.APCS24, v.AC, 'cs-1'), a1);
  check(`(14) 400 validation_failed, "${notCode('cs-1', 'courseCode')}"`, is(l14, 400, 'validation_failed') && msgHas(l14.body, notCode('cs-1', 'courseCode')));
  const after = groupNamed(await curriculum(a1, 'APCS', 2024), 'Tự chọn Computer Science (C)').courses.map((c) => c.code);
  check(`{AC} has the same ${before.length} courses, without ZZADM99`, isDeepStrictEqual(before, after) && !after.includes('ZZADM99'));
}

if (which === '05b') {
  const a1 = await signIn('b2-a1@example.com');
  const a2 = await signIn('b2-a2@example.com');
  const a3 = await signIn('b2-a3@example.com');
  const v = await values(a1, a2);
  const link1 = linkPath(v.APCS, v.APCS24, v.AC, 'ZZADM05');
  const link2 = linkPath(v.KHMT, v.KHMT25, v.KG, 'ZZADM05');
  const patch = (body) => call('PATCH', '/admin/catalog/courses/ZZADM05', a3, body);
  check('A1 link to {AC} 204', (await call('PUT', link1, a1)).status === 204);
  const w1 = await patch({ credits: 4 });
  check('first PATCH 409 impact_confirmation_required, APCS2024 only', is(w1, 409, 'impact_confirmation_required') && isDeepStrictEqual(w1.body.affectedCurricula.map((a) => a.curriculumCode), ['APCS2024']));
  check('A2 link to {KG} 204', (await call('PUT', link2, a2)).status === 204);
  const w2 = await patch({ credits: 4, confirmImpact: w1.body.reviewVersion });
  check('PATCH with V1 409 impact_changed, APCS2024 and CNTT-TCTA-KHMT-2025, V2 ≠ V1', is(w2, 409, 'impact_changed') && isDeepStrictEqual(w2.body.affectedCurricula.map((a) => a.curriculumCode), ['APCS2024', 'CNTT-TCTA-KHMT-2025']) && w2.body.reviewVersion !== w1.body.reviewVersion);
  const g1 = await course(a3, 'ZZADM05');
  check('GET still 3 credits, a membership in each group', g1.body.credits === 3 && g1.body.memberships.length === 2);
  const ok = await patch({ credits: 4, confirmImpact: w2.body.reviewVersion });
  check('PATCH with V2 200, 4 credits', ok.status === 200 && ok.body.credits === 4);
  check('GET 4 credits', (await course(a3, 'ZZADM05')).body.credits === 4);
  check('A1 unlink 204', (await call('DELETE', link1, a1)).status === 204);
  check('A2 unlink 204', (await call('DELETE', link2, a2)).status === 204);
  check('GET no membership', (await course(a3, 'ZZADM05')).body.memberships.length === 0);
}

const row = (courseCode, courseName, credits, result, grade, year, number) => ({ courseCode, courseName, credits, result, grade, term: { year, number } });
const TA = { rows: [row('CS160', 'Nhập môn Tin học', 4, 'graded', 8.5, 2024, 1), row('CM102', 'Tư duy độc lập', 4, 'graded', 7.5, 2024, 1), row('MTH251', 'Vi tích phân I', 4, 'graded', 7.0, 2024, 1)] };
const ZZROW = row('ZZADM05', 'Học phần thử ADM-05', 4, 'graded', 8.0, 2025, 1);

if (which === '05c') {
  const a3 = await signIn('b2-a3@example.com');
  const d1 = await call('DELETE', '/admin/catalog/courses/BAA00104', a3);
  check('BAA00104 DELETE 409 referenced_item, references include "linked in APCS2024" and "linked in CNTT-TCTA-KHMT-2025"', is(d1, 409, 'referenced_item') && d1.body.references.includes('linked in APCS2024') && d1.body.references.includes('linked in CNTT-TCTA-KHMT-2025'));
  const g = await course(a3, 'BAA00104');
  check('GET BAA00104 200, 11 memberships', g.status === 200 && g.body.memberships.length === 11);
  const s6 = await signUpOnboarded('b2-s6@example.com');
  const save = await call('PUT', '/users/me/transcript', s6.token, { rows: [...TA.rows, ZZROW] }, { quiet: true });
  check('T-A5 save 200', save.status === 200);
  const d2 = await call('DELETE', '/admin/catalog/courses/ZZADM05', a3);
  check('ZZADM05 DELETE 409 referenced_item, references exactly ["1 transcript rows name it"]', is(d2, 409, 'referenced_item') && isDeepStrictEqual(d2.body.references, ['1 transcript rows name it']));
  check('GET ZZADM05 200', (await course(a3, 'ZZADM05')).status === 200);
}

if (which === '05d') {
  const a3 = await signIn('b2-a3@example.com');
  const s6 = await signIn('b2-s6@example.com');
  const plan = await call('POST', '/plans', s6, { name: 'ADM-05 plan', programCode: 'APCS', cohortYear: 2024, terms: [{ term: { year: 2026, number: 1 }, placements: [{ kind: 'course', courseCode: 'ZZADM05' }] }] });
  check('plan 201', plan.status === 201);
  const t0 = await call('GET', '/users/me/transcript', s6);
  const p0 = await call('GET', `/plans/${plan.body.id}`, s6);
  const fix = await call('PATCH', '/admin/catalog/courses/ZZADM05', a3, { credits: 5, nameVi: 'Học phần thử ADM-05 (sửa)' });
  check('PATCH 200 at once, 5 credits, new name', fix.status === 200 && fix.body.credits === 5 && fix.body.nameVi === 'Học phần thử ADM-05 (sửa)');
  const t1 = await call('GET', '/users/me/transcript', s6);
  const p1 = await call('GET', `/plans/${plan.body.id}`, s6);
  const zz = t1.body.rows.find((r) => r.courseCode === 'ZZADM05');
  check('transcript unchanged: ZZADM05 row still "Học phần thử ADM-05", 4 credits', isDeepStrictEqual(t0.body, t1.body) && zz?.courseName === 'Học phần thử ADM-05' && zz?.credits === 4);
  check('plan terms unchanged: ZZADM05 alone in 2026 term 1, credits null; updatedAt unchanged', isDeepStrictEqual(p0.body.terms, p1.body.terms) && p1.body.updatedAt === p0.body.updatedAt && isDeepStrictEqual(p1.body.terms, [{ term: { year: 2026, number: 1 }, placements: [{ kind: 'course', courseCode: 'ZZADM05', requirementGroupId: null, credits: null }] }]));
  const d = await call('DELETE', '/admin/catalog/courses/ZZADM05', a3);
  check('DELETE 409 referenced_item, ["1 transcript rows name it", "1 saved plans place it"]', is(d, 409, 'referenced_item') && isDeepStrictEqual(d.body.references, ['1 transcript rows name it', '1 saved plans place it']));
  console.log('--- clean-up');
  check('S6 saves T-A 200', (await call('PUT', '/users/me/transcript', s6, TA, { quiet: true })).status === 200);
  check('plan DELETE 204', (await call('DELETE', `/plans/${plan.body.id}`, s6)).status === 204);
  check('ZZADM05 DELETE 204', (await call('DELETE', '/admin/catalog/courses/ZZADM05', a3)).status === 204);
  check('GET ZZADM05 404', (await course(a3, 'ZZADM05')).status === 404);
}

// ---- ADM-06 ---------------------------------------------------------------------------------
const ids = () => (existsSync(IDS_FILE) ? JSON.parse(readFileSync(IDS_FILE, 'utf8')) : {});
const saveId = (name, id) => writeFileSync(IDS_FILE, `${JSON.stringify({ ...ids(), [name]: id }, null, 2)}\n`);
const grantsOf = (a4, id) => call('GET', `/admin/access/users/${id}/grants`, a4);
const ZZ6 = { code: 'ZZADM06', nameVi: 'Học phần thử ADM-06', credits: 3 };
const CREDENTIAL = /(^|_)(hash|token|secret|key|password|sub|salt|seed)$/;
const snake = (k) => k.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/([A-Z])([A-Z][a-z])/g, '$1_$2').toLowerCase();
const credentialKeys = (value, path = '') => {
  if (Array.isArray(value)) return value.flatMap((v, i) => credentialKeys(v, `${path}[${i}]`));
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => [...(CREDENTIAL.test(snake(k)) ? [`${path}.${k}`] : []), ...credentialKeys(v, `${path}.${k}`)]);
  return [];
};

if (which === '06a') {
  const a5 = await signUpOnboarded('b2-a5@example.com');
  saveId('A5', a5.id);
  const list = await call('GET', '/admin/programs', a5.token);
  check('A5 admin programs { programs: [] }', list.status === 200 && isDeepStrictEqual(list.body, { programs: [] }));
  check('A5 access programs 403 access_manager', refused(await call('GET', '/admin/access/programs', a5.token), 'access_manager'));
  const exp = await call('GET', '/users/me/export', a5.token, undefined, { quiet: true });
  check('export: program_admin_grants and global_admin_grants []', exp.status === 200 && isDeepStrictEqual(exp.body.tables?.program_admin_grants, []) && isDeepStrictEqual(exp.body.tables?.global_admin_grants, []));
  const a4 = await signIn('b2-a4@example.com');
  const g = await grantsOf(a4, a5.id);
  check('A4 reads programs [] and permissions []', g.status === 200 && isDeepStrictEqual(g.body.programs, []) && isDeepStrictEqual(g.body.permissions, []));
}

if (which === '06b') {
  // After the bot's refused bootstrap: A5 still has no grant.
  const a4 = await signIn('b2-a4@example.com');
  const g = await grantsOf(a4, ids().A5);
  check('A5 still has no grant', g.status === 200 && g.body.programs.length === 0 && g.body.permissions.length === 0);
}

if (which === '06c') {
  const a3 = await signIn('b2-a3@example.com');
  const a4 = await signIn('b2-a4@example.com');
  const a5 = await signIn('b2-a5@example.com');
  const A5 = ids().A5;
  const v = await values(await signIn('b2-a1@example.com'), await signIn('b2-a2@example.com'));
  const holds = (res, kind) => res.status === 200 && res.body.permissions.some((p) => p.permission === kind && p.grantedBy === ID.A4);
  console.log('--- (1) catalog');
  check('A4 grants catalog_maintainer 200, grantedBy A4', holds(await call('PUT', `/admin/access/users/${A5}/global/catalog_maintainer`, a4), 'catalog_maintainer'));
  check('A5 creates ZZADM06 201', (await call('POST', '/admin/catalog/courses', a5, ZZ6)).status === 201);
  const r1 = await call('DELETE', `/admin/access/users/${A5}/global/catalog_maintainer`, a4);
  check('A4 removal 200, without it', r1.status === 200 && r1.body.permissions.length === 0);
  check('A5 DELETE ZZADM06 403 catalog_maintainer', refused(await call('DELETE', '/admin/catalog/courses/ZZADM06', a5), 'catalog_maintainer'));
  check('GET ZZADM06 still 200', (await course(a5, 'ZZADM06')).status === 200);
  console.log('--- (2) program');
  const g2 = await call('PUT', `/admin/access/users/${A5}/programs/${v.APCS}`, a4);
  check('A4 grants APCS 200, grantedBy A4', g2.status === 200 && g2.body.programs.some((p) => p.programCode === 'APCS' && p.grantedBy === ID.A4));
  const w = await call('PUT', W(v), a5, { terms: [1, 2] });
  check('A5 W 200', w.status === 200 && isDeepStrictEqual(w.body, { courseCode: 'CS420', terms: [1, 2] }));
  const wc = await call('DELETE', W(v), a5);
  check('A5 clean-up 200, terms null', wc.status === 200 && wc.body.terms === null);
  const r2 = await call('DELETE', `/admin/access/users/${A5}/programs/${v.APCS}`, a4);
  check('A4 removal 200, without it', r2.status === 200 && r2.body.programs.length === 0);
  check('A5 W 403 program_admin', refused(await call('PUT', W(v), a5, { terms: [1, 2] }), 'program_admin'));
  const cs420 = groupsOf(await curriculum(a5, 'APCS', 2024)).flatMap((g) => g.courses).find((c) => c.code === 'CS420');
  check('CS420 offeringTerms null', cs420?.offeringTerms === null);
  console.log('--- (3) access');
  const a6 = await signUpOnboarded('b2-a6@example.com');
  saveId('A6', a6.id);
  check('A4 grants access_manager 200, grantedBy A4', holds(await call('PUT', `/admin/access/users/${A5}/global/access_manager`, a4), 'access_manager'));
  const toA6 = await call('PUT', `/admin/access/users/${a6.id}/global/catalog_maintainer`, a5);
  check('A5 grants A6 catalog_maintainer 200, grantedBy A5', toA6.status === 200 && toA6.body.permissions.some((p) => p.permission === 'catalog_maintainer' && p.grantedBy === A5));
  const self = await call('DELETE', `/admin/access/users/${A5}/global/access_manager`, a5);
  check('A5 removes its own access_manager 200', self.status === 200 && !self.body.permissions.some((p) => p.permission === 'access_manager'));
  check('A5 repeated grant 403 access_manager', refused(await call('PUT', `/admin/access/users/${a6.id}/global/catalog_maintainer`, a5), 'access_manager'));
  const a6g = await grantsOf(a4, a6.id);
  check('A6 grant as it was: catalog_maintainer, grantedBy A5', a6g.status === 200 && isDeepStrictEqual(a6g.body.permissions.map((p) => [p.permission, p.grantedBy]), [['catalog_maintainer', A5]]));
  check('A4 removes its own role 409 last_access_manager', is(await call('DELETE', `/admin/access/users/${ID.A4}/global/access_manager`, a4), 409, 'last_access_manager'));
  const a4g = await grantsOf(a4, ID.A4);
  check('A4 keeps access_manager', a4g.body.permissions.some((p) => p.permission === 'access_manager'));
  console.log('--- clean-up');
  check('A3 DELETE ZZADM06 204', (await call('DELETE', '/admin/catalog/courses/ZZADM06', a3)).status === 204);
}

if (which === '06d') {
  const a4 = await signIn('b2-a4@example.com');
  const a6 = await signIn('b2-a6@example.com');
  const { A5, A6 } = ids();
  const e4 = await call('GET', '/users/me/export', a4, undefined, { quiet: true });
  const e6 = await call('GET', '/users/me/export', a6, undefined, { quiet: true });
  check('both 200', e4.status === 200 && e6.status === 200);
  const strip = (r) => ({ ...r, granted_at: typeof r.granted_at });
  console.log(`  A4 grants: ${JSON.stringify(e4.body.tables.global_admin_grants.map(strip))} ${JSON.stringify(e4.body.tables.program_admin_grants)}`);
  console.log(`  A6 grants: ${JSON.stringify(e6.body.tables.global_admin_grants.map(strip))} ${JSON.stringify(e6.body.tables.program_admin_grants)}`);
  check('A4 global_admin_grants: one row, its own access_manager, granted_by null', isDeepStrictEqual(e4.body.tables.global_admin_grants.map(strip), [{ user_id: ID.A4, permission: 'access_manager', granted_at: 'string', granted_by: null }]));
  check('A4 program_admin_grants []', isDeepStrictEqual(e4.body.tables.program_admin_grants, []));
  check('none of A1–A3\'s grants appears in A4\'s file', ![ID.A1, ID.A2, ID.A3].some((id) => e4.text.includes(id)));
  check('A6 global_admin_grants: one row, catalog_maintainer, granted_by A5', isDeepStrictEqual(e6.body.tables.global_admin_grants.map(strip), [{ user_id: A6, permission: 'catalog_maintainer', granted_at: 'string', granted_by: A5 }]));
  check('A6 program_admin_grants []', isDeepStrictEqual(e6.body.tables.program_admin_grants, []));
  const found = credentialKeys(e4.body);
  console.log(`  A4 export tables: ${Object.keys(e4.body.tables).map((t) => `${t}(${e4.body.tables[t]?.length})`).join(', ')}`);
  check(`A4 file: no credential key at any depth${found.length ? ` (found ${found.join(', ')})` : ''}`, found.length === 0);
  check('A4 file does not contain the bearer token of the request', !e4.text.includes(a4));
}

if (which === '06e-before') {
  const a4 = await signIn('b2-a4@example.com');
  const a5 = await signIn('b2-a5@example.com');
  const { A5, A6 } = ids();
  const g0 = await grantsOf(a4, A6);
  check('A6: catalog_maintainer, grantedBy A5', isDeepStrictEqual(g0.body.permissions.map((p) => [p.permission, p.grantedBy]), [['catalog_maintainer', A5]]));
  const del = await call('DELETE', '/users/me', a5, { password: PASSWORD });
  check('A5 deletion 202', del.status === 202);
  const g1 = await grantsOf(a4, A6);
  check('A6 grant unchanged, grantedBy A5', isDeepStrictEqual(g1.body.permissions, g0.body.permissions));
  check('A4 grant to A5 409 recipient_deletion_pending', is(await call('PUT', `/admin/access/users/${A5}/global/catalog_maintainer`, a4), 409, 'recipient_deletion_pending'));
  console.log(`  now write "ADM-06e ready" (A5 ${A5})`);
}

if (which === '06e-after') {
  const a4 = await signIn('b2-a4@example.com');
  const a6 = await signIn('b2-a6@example.com');
  const { A5, A6 } = ids();
  const g = await grantsOf(a4, A6);
  check('A6 still catalog_maintainer, grantedBy null', g.status === 200 && isDeepStrictEqual(g.body.permissions.map((p) => [p.permission, p.grantedBy]), [['catalog_maintainer', null]]));
  check('A5 grants 404 not_found', is(await grantsOf(a4, A5), 404, 'not_found'));
  check('A6 creates ZZADM06 201', (await call('POST', '/admin/catalog/courses', a6, ZZ6)).status === 201);
  check('A6 deletes ZZADM06 204', (await call('DELETE', '/admin/catalog/courses/ZZADM06', a6)).status === 204);
}

if (which === '06f-before') {
  const a6 = await signIn('b2-a6@example.com');
  const del = await call('DELETE', '/users/me', a6, { password: PASSWORD });
  check('A6 deletion 202', del.status === 202);
  console.log(`  now write "ADM-06f ready" (A6 ${ids().A6})`);
}

if (which === '06f-after') {
  const a4 = await signIn('b2-a4@example.com');
  check('A6 grants 404', (await grantsOf(a4, ids().A6)).status === 404);
  const progs = (await call('GET', '/admin/access/programs', a4, undefined, { quiet: true })).body.programs.map((p) => p.code);
  console.log(`  programs: ${progs.join(', ')}`);
  check('A4 lists every program, APCS and CNTT-TCTA-KHMT among them', progs.includes('APCS') && progs.includes('CNTT-TCTA-KHMT'));
  const b = await course(a4, 'BAA00104');
  check('BAA00104 200, 11 memberships', b.status === 200 && b.body.memberships.length === 11);
}

console.log(mismatches ? `${mismatches} MISMATCH` : 'all OK');
