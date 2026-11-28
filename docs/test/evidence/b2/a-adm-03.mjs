// TC-B2-ADM-03a–f on staging (docs/test/test-cases-b2.md §6). Run only after Lâm agrees in #168: ADM-03b makes a
// cohort of APCS that no route deletes. Synthetic b2- accounts only; never prints a token.
//   node a-adm-03.mjs
import { isDeepStrictEqual } from 'node:util';
import { account, call, check, failureCount, log, PROGRAM, signInApi, T_A } from './c-lib.mjs';

const EMAIL = { A1: 'b2-a1@example.com', A2: 'b2-a2@example.com', A3: 'b2-a3@example.com', A4: 'b2-a4@example.com', C: 'b2-s14@example.com' };
log('a-adm-03');
const is = (r, status, code) => r.status === status && (code === undefined || r.json?.code === code);
const says = (r, text) => JSON.stringify(r.json ?? '').includes(text);
const groupsOf = (c) => c?.requirementGroups ?? c?.groups ?? [];
const codesOf = (g) => (g?.courses ?? []).map((x) => x.code);

const a1 = (await signInApi(EMAIL.A1)).token;
const a2 = (await signInApi(EMAIL.A2)).token;
const a3 = (await signInApi(EMAIL.A3)).token;
const a4 = (await signInApi(EMAIL.A4)).token;
const APCS = PROGRAM.APCS, KHMT = PROGRAM.KHMT;
const khmt = (await call('GET', '/admin/programs', { token: a2, quiet: true })).json.programs.find((p) => p.code === 'CNTT-TCTA-KHMT');
const KHMT25 = khmt.curricula.find((x) => x.cohortYear === 2025).id;
const cohorts = `/admin/programs/${APCS}/cohorts`;
const list = async () => (await call('GET', cohorts, { token: a1, show: (j) => JSON.stringify((j?.cohorts ?? j)?.map?.((x) => [x.cohortYear, x.code]) ?? j) })).json;
const itemsOf = (j) => j?.cohorts ?? j ?? [];

console.log('--- TC-B2-ADM-03a');
const c = await account(EMAIL.C);
console.log(`  C ${c.created ? 'signed up and onboarded to APCS 2024 here' : 'existed already (signed up by ADM-04 at 13:22Z), onboarded to APCS 2024'}`);
const C = c.token;
const apcs24 = await call('GET', '/programs/APCS/curricula/2024', { token: C, quiet: true });
const AE = groupsOf(apcs24.json).find((g) => g.name === 'Kiến thức Computer Science (A): tự chọn').id;
const savedTA = await call('PUT', '/users/me/transcript', { token: C, body: T_A, quiet: true });
let r = await call('POST', '/plans', { token: C, body: { name: 'ADM-03 plan', programCode: 'APCS', cohortYear: 2024, terms: [{ term: { year: 2026, number: 2 }, placements: [{ kind: 'course', courseCode: 'CS163' }, { kind: 'slot', requirementGroupId: AE, credits: 4 }] }] }, quiet: true });
const PA = r.json?.id;
console.log(`  {AE} = ${AE}, {PA} = ${PA}`);
check('ADM-03a', 'T-A 200; the plan 201 with curriculum.code APCS2024', savedTA.status === 200 && r.status === 201 && r.json.curriculum?.code === 'APCS2024', r.json?.curriculum);
const firstReads = async () => {
  const course = async (code) => (await call('GET', `/courses/${code}`, { token: C, quiet: true })).json.memberships;
  return {
    K: (await call('GET', `/plans/${PA}`, { token: C, quiet: true })).json,
    I: (await call('GET', `/plans/${PA}/issues`, { token: C, quiet: true })).json,
    U: (await call('GET', '/users/me/audit', { token: C, quiet: true })).json,
    C24: (await call('GET', '/programs/APCS/curricula/2024', { token: C, quiet: true })).json,
    M: { CS420: await course('CS420'), CS163: await course('CS163') },
  };
};
const before = await firstReads();
const L0 = itemsOf(await list());
const years = L0.map((x) => x.cohortYear);
const APCS24 = L0.find((x) => x.cohortYear === 2024);
let Y = 2099;
while (years.includes(Y) || years.includes(Y - 1)) Y--;
console.log(`  {Y} = ${Y}; APCS's cohorts: ${JSON.stringify(years)}`);
check('ADM-03a', 'A1\'s list holds 2024 and 2025 of APCS, each with programId {APCS}, and not {Y}',
  years.includes(2024) && years.includes(2025) && L0.every((x) => x.programId === APCS) && !years.includes(Y), years);

console.log('--- TC-B2-ADM-03b');
const body = { cohortYear: Y, code: ` apcs${Y} `, nameVi: 'Khóa thử ADM-03', nameEn: 'ADM-03 test cohort' };
r = await call('POST', cohorts, { token: a1, body });
const made = r.json;
const CY = made?.id;
console.log(`  {CY} = ${CY}`);
check('ADM-03b', `201: programId {APCS}, cohortYear ${Y}, code APCS${Y}, the names, language null, totalCreditsMin null`,
  r.status === 201 && made.programId === APCS && made.cohortYear === Y && made.code === `APCS${Y}` && made.nameVi === 'Khóa thử ADM-03' && made.nameEn === 'ADM-03 test cohort' && made.language === null && made.totalCreditsMin === null, made);
const L1 = itemsOf(await list());
const one = await call('GET', `${cohorts}/${CY}`, { token: a1 });
const read = await call('GET', `/programs/APCS/curricula/${Y}`, { token: a1 });
check('ADM-03b', 'the list holds 2024, 2025 and {Y}; the GET of {CY} equals the POST; the read route serves APCS{Y} with no requirement group',
  [2024, 2025, Y].every((y) => L1.some((x) => x.cohortYear === y)) && isDeepStrictEqual(one.json, made) && read.status === 200 && read.json.code === `APCS${Y}` && groupsOf(read.json).length === 0, { list: L1.map((x) => x.cohortYear), groups: groupsOf(read.json).length });
const p1 = await call('PATCH', `${cohorts}/${CY}`, { token: a1, body: { nameEn: 'ADM-03 test cohort (edited)' } });
const p2 = await call('PATCH', `${cohorts}/${CY}`, { token: a1, body: { nameEn: 'ADM-03 test cohort (edited)' } });
check('ADM-03b', 'the first PATCH 200 with the new name and a later updatedAt; the second 200 with the same updatedAt',
  p1.status === 200 && p1.json.nameEn === 'ADM-03 test cohort (edited)' && p1.json.updatedAt > made.updatedAt && p2.status === 200 && p2.json.updatedAt === p1.json.updatedAt, [made.updatedAt, p1.json?.updatedAt, p2.json?.updatedAt]);

console.log('--- TC-B2-ADM-03c');
const c1 = await call('POST', cohorts, { token: a1, body });
check('ADM-03c', `(1) 409 duplicate_cohort "This program already has a cohort ${Y}"`, is(c1, 409, 'duplicate_cohort') && c1.json.message === `This program already has a cohort ${Y}`, c1.json);
const c2 = await call('POST', cohorts, { token: a1, body: { cohortYear: Y - 1, code: 'apcs2024', nameVi: 'Khóa trùng mã' } });
await list();
check('ADM-03c', '(2) 409 duplicate_code "A curriculum already has the code APCS2024"', is(c2, 409, 'duplicate_code') && c2.json.message === 'A curriculum already has the code APCS2024', c2.json);
const c3 = await call('POST', cohorts, { token: a1, body: { cohortYear: Y - 1, code: `APCS ${Y - 1}`, nameVi: 'Khóa thử' } });
check('ADM-03c', '(3) 400 validation_failed, the code-format message', is(c3, 400, 'validation_failed') && says(c3, 'code must be letters A-Z and digits, in parts joined by single hyphens (for example ZZ-PROG-2024)'), c3.json);
const c4 = await call('POST', cohorts, { token: a1, body: { cohortYear: 1999, code: 'APCS1999', nameVi: 'Khóa thử' } });
check('ADM-03c', '(4) 400 validation_failed (2000 to 2100)', is(c4, 400, 'validation_failed'), c4.json);
const base = { ...body, cohortYear: Y - 1, code: `APCS${Y - 1}` };
const c5 = await call('POST', cohorts, { token: a1, body: { ...base, totalCreditsMin: -1 } });
check('ADM-03c', '(5) 400, "totalCreditsMin must not be less than 0"', c5.status === 400 && says(c5, 'totalCreditsMin must not be less than 0'), c5.json);
const c6 = await call('POST', cohorts, { token: a1, body: { ...base, programId: KHMT } });
check('ADM-03c', '(6) 400, "property programId should not exist"', c6.status === 400 && says(c6, 'property programId should not exist'), c6.json);
const c7a = await call('PATCH', `${cohorts}/${CY}`, { token: a1, body: { cohortYear: Y - 1 } });
const c7b = await call('PATCH', `${cohorts}/${CY}`, { token: a1, body: { code: `APCS${Y - 1}` } });
check('ADM-03c', '(7) 400 "property cohortYear should not exist", then "property code should not exist"', c7a.status === 400 && says(c7a, 'property cohortYear should not exist') && c7b.status === 400 && says(c7b, 'property code should not exist'), [c7a.json, c7b.json]);
const c8 = await call('GET', `${cohorts}/${KHMT25}`, { token: a1 });
check('ADM-03c', '(8) 404 not_found "No such cohort in this program", nothing of CLC', is(c8, 404, 'not_found') && c8.json.message === 'No such cohort in this program' && !/KHMT|CNTT/.test(c8.text), c8.json);
const c9 = await call('POST', '/admin/programs', { token: a1, body: { code: 'ZZ-ADM03', nameVi: 'Chương trình thử' } });
check('ADM-03c', '(9) 403 permission_required, access_manager', is(c9, 403, 'permission_required') && c9.json.permission === 'access_manager', c9.json);
const c10 = await call('POST', cohorts, { token: a2, body: base });
check('ADM-03c', '(10) A2: 403 permission_required, program_admin', is(c10, 403, 'permission_required') && c10.json.permission === 'program_admin', c10.json);
const c11 = await call('POST', '/admin/programs', { token: a4, body: { code: ' apcs ', nameVi: 'Chương trình trùng mã' } });
check('ADM-03c', '(11) A4: 409 duplicate_code "A program already has the code APCS"', is(c11, 409, 'duplicate_code') && c11.json.message === 'A program already has the code APCS', c11.json);
const L2 = itemsOf(await list()).map((x) => x.cohortYear).sort();
const progs = (await call('GET', '/programs', { token: a1, quiet: true })).json;
check('ADM-03c', 'nothing saved: the list holds 2024, 2025 and {Y} only; no program ZZ-ADM03', isDeepStrictEqual(L2, [...years, Y].sort()) && !JSON.stringify(progs).includes('ZZ-ADM03'), L2);

console.log('--- TC-B2-ADM-03d');
const groups = `${cohorts}/${CY}/requirement-groups`;
const d1 = await call('POST', groups, { token: a1, body: { name: 'Kiến thức Computer Science (A): tự chọn', kind: 'elective' } });
const d2 = await call('POST', groups, { token: a1, body: { name: 'Nhóm thử ADM-03', kind: 'compulsory' } });
const G1 = d1.json?.id, G2 = d2.json?.id;
console.log(`  {G1} = ${G1}, {G2} = ${G2}`);
check('ADM-03d', '(1) and (2) 201, curriculumId {CY}', d1.status === 201 && d2.status === 201 && d1.json.curriculumId === CY && d2.json.curriculumId === CY);
const d3 = await call('POST', groups, { token: a1, body: { name: 'Nhóm thử ADM-03 B', kind: 'elective', creditsTotal: 16 } });
check('ADM-03d', '(3) 400 validation_failed, "creditsTotal: an elective group stores creditsTotalMin, not a fixed total (ADR 0005)"', is(d3, 400, 'validation_failed') && says(d3, 'creditsTotal: an elective group stores creditsTotalMin, not a fixed total (ADR 0005)'), d3.json);
const d4 = [await call('PUT', `${groups}/${G1}/courses/CS420`, { token: a1 }), await call('PUT', `${groups}/${G1}/courses/cs163`, { token: a1 }), await call('PUT', `${groups}/${G2}/courses/CS163`, { token: a1 })];
check('ADM-03d', '(4) each 204', d4.every((x) => x.status === 204), d4.map((x) => x.status));
const d5 = await call('PUT', `${groups}/${G1}/courses/CS420`, { token: a1 });
const d6 = [await call('PUT', `${groups}/${G1}/courses/ZZADM99`, { token: a1 }), await call('PUT', `${groups}/${G1}/courses/cs-1`, { token: a1 }), await call('PUT', `${groups}/${AE}/courses/CS420`, { token: a1 })];
check('ADM-03d', '(6) 404 "No catalog course has the code ZZADM99; …"; 400 validation_failed "courseCode: \\"cs-1\\" is not a course code …"; 404 "No such requirement group in this cohort"',
  is(d6[0], 404, 'not_found') && d6[0].json.message === 'No catalog course has the code ZZADM99; a catalog maintainer adds it first'
    && is(d6[1], 400, 'validation_failed') && says(d6[1], 'courseCode: \\"cs-1\\" is not a course code (letters A-Z and digits, 2 to 20)')
    && is(d6[2], 404, 'not_found') && d6[2].json.message === 'No such requirement group in this cohort', d6.map((x) => x.json));
const d7 = await call('PATCH', `${groups}/${G1}`, { token: a1, body: { name: 'Nhóm thử ADM-03 A' } });
check('ADM-03d', '(7) 200 with the new name', d7.status === 200 && d7.json.name === 'Nhóm thử ADM-03 A');
const d8 = await call('POST', '/admin/catalog/courses', { token: a3, body: { code: 'CS420', nameVi: 'Học phần trùng mã', credits: 4 } });
check('ADM-03d', '(8) A3: 409 duplicate_code "The catalog already has CS420"', is(d8, 409, 'duplicate_code') && d8.json.message === 'The catalog already has CS420', d8.json);
const yRead = (await call('GET', `/programs/APCS/curricula/${Y}`, { token: a1, quiet: true })).json;
const gA = groupsOf(yRead).find((g) => g.name === 'Nhóm thử ADM-03 A'), gB = groupsOf(yRead).find((g) => g.name === 'Nhóm thử ADM-03');
check('ADM-03d', '(5) the group links CS420 once; APCS{Y} lists "Nhóm thử ADM-03 A" with CS420 and CS163, "Nhóm thử ADM-03" with CS163',
  d5.status === 204 && isDeepStrictEqual(codesOf(gA).sort(), ['CS163', 'CS420']) && isDeepStrictEqual(codesOf(gB), ['CS163']), { A: codesOf(gA), B: codesOf(gB), groups: groupsOf(yRead).map((g) => g.name) });
const cs = async (code) => (await call('GET', `/courses/${code}`, { token: a1, quiet: true })).json;
const [m420, m163] = [await cs('CS420'), await cs('CS163')];
const key = (m) => `${m.curriculumCode}|${m.requirementGroupName}`;
const newOf = (now, old) => now.memberships.map(key).filter((k) => !old.map(key).includes(k));
check('ADM-03d', 'one catalog course each: memberships are M0\'s plus the new ones in APCS{Y}; name and credits unchanged',
  before.M.CS420.every((m) => now(m420, m)) && before.M.CS163.every((m) => now(m163, m)) && isDeepStrictEqual(newOf(m420, before.M.CS420), [`APCS${Y}|Nhóm thử ADM-03 A`]) && isDeepStrictEqual(newOf(m163, before.M.CS163).sort(), [`APCS${Y}|Nhóm thử ADM-03`, `APCS${Y}|Nhóm thử ADM-03 A`].sort()),
  { CS420: newOf(m420, before.M.CS420), CS163: newOf(m163, before.M.CS163), names: [m420.nameVi, m420.credits, m163.nameVi, m163.credits] });
function now(course, m) { return course.memberships.some((x) => isDeepStrictEqual(x, m)); }

console.log('--- TC-B2-ADM-03e');
const after = await firstReads();
check('ADM-03e', 'the plan equals K0 (curriculum APCS2024, the placements, the same updatedAt)', isDeepStrictEqual(after.K, before.K), after.K?.updatedAt);
check('ADM-03e', 'the issues equal I0 and the audit equals U0', isDeepStrictEqual(after.I, before.I) && isDeepStrictEqual(after.U, before.U));
check('ADM-03e', 'APCS 2024 equals C24', isDeepStrictEqual(after.C24, before.C24));
const in2425 = (ms) => ms.filter((m) => ['APCS2024', 'APCS2025'].includes(m.curriculumCode));
check('ADM-03e', 'the memberships of CS420 and CS163 in APCS 2024 and 2025 are M0\'s', isDeepStrictEqual(in2425(after.M.CS420), in2425(before.M.CS420)) && isDeepStrictEqual(in2425(after.M.CS163), in2425(before.M.CS163)));
const c24 = await call('GET', `${cohorts}/${APCS24.id}`, { token: a1 });
check('ADM-03e', 'the cohort {APCS24} has the updatedAt it had before ADM-03b', c24.json?.updatedAt === APCS24.updatedAt, [APCS24.updatedAt, c24.json?.updatedAt]);

console.log('--- TC-B2-ADM-03f');
const f = [await call('DELETE', `${groups}/${G1}/courses/CS420`, { token: a1 }), await call('DELETE', `${groups}/${G1}/courses/CS163`, { token: a1 }), await call('DELETE', `${groups}/${G2}/courses/CS163`, { token: a1 }),
  await call('DELETE', `${groups}/${G1}`, { token: a1 }), await call('DELETE', `${groups}/${G2}`, { token: a1 }), await call('DELETE', `/plans/${PA}`, { token: C })];
const yEnd = (await call('GET', `/programs/APCS/curricula/${Y}`, { token: a1, quiet: true })).json;
check('ADM-03f', 'each unlink 204, each group DELETE 204, the plan DELETE 204; APCS{Y} has no group', f.every((x) => x.status === 204) && groupsOf(yEnd).length === 0, f.map((x) => x.status));
log(`record: {Y} = ${Y}, {CY} = ${CY} (the cohort stays: no route deletes one)`);

log(failureCount() ? `${failureCount()} FAIL(S)` : 'All checks ok');
