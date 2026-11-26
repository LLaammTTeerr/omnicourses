// TC-B2-ADM-04a–f on staging (docs/test/test-cases-b2.md §6). Synthetic b2- accounts only; never prints a token.
//   node a-adm-04.mjs
// C (b2-s14) is signed up here if ADM-03a has not done it yet (ADM-03 waits for Lâm's agreement).
import { isDeepStrictEqual } from 'node:util';
import { account, call, check, failureCount, log, PROGRAM, signInApi } from './c-lib.mjs';

const EMAIL = { A1: 'b2-a1@example.com', A2: 'b2-a2@example.com', A3: 'b2-a3@example.com', A4: 'b2-a4@example.com', C: 'b2-s14@example.com' };
log('a-adm-04');
const is = (r, status, code) => r.status === status && (code === undefined || r.json?.code === code);
const groupsOf = (c) => c.requirementGroups ?? c.groups ?? [];
const groupById = (c, id) => groupsOf(c).find((g) => g.id === id);
const codesOf = (g) => (g?.courses ?? []).map((x) => x.code);

const a1 = (await signInApi(EMAIL.A1)).token;
const a2 = (await signInApi(EMAIL.A2)).token;
const a3 = (await signInApi(EMAIL.A3)).token;
const a4 = (await signInApi(EMAIL.A4)).token;
const c = await account(EMAIL.C);
console.log(`  C ${c.created ? 'signed up and onboarded to APCS 2024 here' : 'existed already'}`);
const C = c.token;

const apcs = (await call('GET', '/admin/programs', { token: a1, quiet: true })).json.programs.find((p) => p.code === 'APCS');
const khmt = (await call('GET', '/admin/programs', { token: a2, quiet: true })).json.programs.find((p) => p.code === 'CNTT-TCTA-KHMT');
const curriculum = async () => (await call('GET', '/programs/APCS/curricula/2024', { token: a1, quiet: true })).json;
const APCS24 = apcs.curricula.find((x) => x.cohortYear === 2024).id;
const KHMT25 = khmt.curricula.find((x) => x.cohortYear === 2025).id;
const AC = groupsOf(await curriculum()).find((g) => g.name === 'Tự chọn Computer Science (C)').id;
check('values', 'APCS and KHMT are the known programs', apcs.id === PROGRAM.APCS && khmt.id === PROGRAM.KHMT);
console.log(`  values ${JSON.stringify({ APCS: apcs.id, APCS24, KHMT25, AC })}`);
const cohort = `/admin/programs/${apcs.id}/cohorts/${APCS24}`;
const link = (g) => `${cohort}/requirement-groups/${g}/courses/ZZADM04`;

console.log('--- the test data');
let r = await call('GET', '/courses/ZZADM04', { token: a1 });
check('ADM-04', 'before the run, GET /api/courses/ZZADM04 404', r.status === 404);
r = await call('POST', '/admin/catalog/courses', { token: a3, body: { code: 'ZZADM04', nameVi: 'Học phần thử ADM-04', credits: 3 } });
check('ADM-04', 'ZZADM04 created, 201', r.status === 201);
r = await call('POST', `${cohort}/requirement-groups`, { token: a1, body: { name: 'Nhóm thử ADM-04', kind: 'elective' } });
const TG4 = r.json?.id;
console.log(`  {TG4} = ${TG4}`);
const l1 = await call('PUT', link(TG4), { token: a1 });
const l2 = await call('PUT', link(AC), { token: a1 });
check('ADM-04', '{TG4} 201; ZZADM04 linked to {TG4} and {AC}, 204 each', r.status === 201 && l1.status === 204 && l2.status === 204);

console.log('--- ADM-04a');
const d1 = await call('DELETE', link(TG4), { token: a1 });
const d2 = await call('DELETE', link(TG4), { token: a1 });
check('ADM-04a', 'the first DELETE 204, the second 404 not_found "ZZADM04 is not in this group"', d1.status === 204 && is(d2, 404, 'not_found') && d2.json.message === 'ZZADM04 is not in this group', d2.json);
r = await call('GET', '/courses/ZZADM04', { token: a1 });
const m = r.json?.memberships ?? [];
check('ADM-04a', 'the course 200 with one membership, "Tự chọn Computer Science (C)" of APCS2024', r.status === 200 && m.length === 1 && m[0].requirementGroupName === 'Tự chọn Computer Science (C)' && m[0].curriculumCode === 'APCS2024', m);
let cur = await curriculum();
const acBefore = codesOf(groupById(cur, AC));
check('ADM-04a', '{AC} still lists ZZADM04 with its other courses; {TG4} has no course', acBefore.includes('ZZADM04') && acBefore.length > 1 && codesOf(groupById(cur, TG4)).length === 0, { AC: acBefore.length, TG4: codesOf(groupById(cur, TG4)) });

console.log('--- ADM-04b');
const terms = `${cohort}/courses/ZZADM04/offering-terms`;
r = await call('PUT', terms, { token: a1, body: { terms: [1] } });
check('ADM-04b', 'offering terms 200 { courseCode: ZZADM04, terms: [1] }', r.status === 200 && isDeepStrictEqual(r.json, { courseCode: 'ZZADM04', terms: [1] }), r.json);
r = await call('DELETE', link(AC), { token: a1 });
cur = await curriculum();
check('ADM-04b', 'the unlink 409 referenced_item, the message and references as the case says; {AC} still lists ZZADM04',
  is(r, 409, 'referenced_item') && r.json.message === 'ZZADM04 would leave the curriculum while its rules still name it; clear them first' && isDeepStrictEqual(r.json.references, ['offering terms of ZZADM04 are recorded']) && codesOf(groupById(cur, AC)).includes('ZZADM04'), r.json);
r = await call('DELETE', terms, { token: a1 });
check('ADM-04b', 'clearing the terms 200 with terms null', r.status === 200 && r.json?.terms === null, r.json);
r = await call('DELETE', link(AC), { token: a1 });
const g = await call('GET', '/courses/ZZADM04', { token: a1 });
check('ADM-04b', 'the second unlink 204; the course has no membership', r.status === 204 && g.json?.memberships?.length === 0, g.json?.memberships);

console.log('--- ADM-04c');
const relink = await call('PUT', link(AC), { token: a1 });
r = await call('DELETE', '/admin/catalog/courses/ZZADM04', { token: a3 });
const gc = await call('GET', '/courses/ZZADM04', { token: a3 });
const un = await call('DELETE', link(AC), { token: a1 });
check('ADM-04c', 'the link 204; the DELETE 409 referenced_item "ZZADM04 is still referenced", references ["linked in APCS2024"]; the GET 200; the unlink 204',
  relink.status === 204 && is(r, 409, 'referenced_item') && r.json.message === 'ZZADM04 is still referenced' && isDeepStrictEqual(r.json.references, ['linked in APCS2024']) && gc.status === 200 && un.status === 204, r.json);

console.log('--- ADM-04d');
r = await call('POST', '/plans', { token: C, body: { name: 'ADM-04 plan', programCode: 'APCS', cohortYear: 2024, terms: [{ term: { year: 2026, number: 2 }, placements: [{ kind: 'slot', requirementGroupId: TG4, credits: 4 }] }] }, quiet: true });
const planId = r.json?.id;
check('ADM-04d', 'the plan 201', r.status === 201, r.json?.code);
const kept = (await call('GET', `/plans/${planId}`, { token: C, quiet: true })).json;
r = await call('DELETE', `${cohort}/requirement-groups/${TG4}`, { token: a1 });
check('ADM-04d', 'the group DELETE 409 referenced_item "Saved plans use the group; it stays while they name it", references ["1 saved plans use it"]; no plan or student named',
  is(r, 409, 'referenced_item') && r.json.message === 'Saved plans use the group; it stays while they name it' && isDeepStrictEqual(r.json.references, ['1 saved plans use it'])
    && !r.text.includes(planId) && !/b2-s14|Test Student/.test(r.text), r.json);
cur = await curriculum();
const again = (await call('GET', `/plans/${planId}`, { token: C, quiet: true })).json;
check('ADM-04d', '{TG4} still in APCS 2024, and the plan equals what was kept', !!groupById(cur, TG4) && isDeepStrictEqual(again, kept));
const pd = await call('DELETE', `/plans/${planId}`, { token: C });
const gd = await call('DELETE', `${cohort}/requirement-groups/${TG4}`, { token: a1 });
check('ADM-04d', 'clean-up: the plan DELETE 204 and the group DELETE 204', pd.status === 204 && gd.status === 204, [pd.status, gd.status]);

console.log('--- ADM-04e');
const e1 = await call('DELETE', '/admin/catalog/courses/ZZADM04', { token: a1 });
const e2 = await call('DELETE', '/admin/catalog/courses/ZZADM04', { token: a4 });
check('ADM-04e', 'A1 and A4: 403 permission_required, catalog_maintainer', [e1, e2].every((x) => is(x, 403, 'permission_required') && x.json.permission === 'catalog_maintainer'), [e1.json, e2.json]);
const e3 = await call('DELETE', '/admin/catalog/courses/ZZADM04', { token: a3 });
const e4 = await call('GET', '/courses/ZZADM04', { token: a3 });
const e5 = await call('DELETE', '/admin/catalog/courses/ZZADM04', { token: a3 });
check('ADM-04e', 'A3: 204, the GET 404, the second DELETE 404 not_found "No catalog course has the code ZZADM04"',
  e3.status === 204 && e4.status === 404 && is(e5, 404, 'not_found') && e5.json.message === 'No catalog course has the code ZZADM04', e5.json);

console.log('--- ADM-04f');
r = await call('PATCH', '/admin/catalog/courses/BAA00104', { token: a3, body: { code: 'BAA00105' } });
check('ADM-04f', 'the catalog PATCH 400 validation_failed, "property code should not exist", no 409 first', is(r, 400, 'validation_failed') && JSON.stringify(r.json).includes('property code should not exist'), r.json);
const b4 = await call('GET', '/courses/BAA00104', { token: a3, quiet: true });
const b5 = await call('GET', '/courses/BAA00105', { token: a3 });
check('ADM-04f', 'BAA00104 200 with its 11 memberships; BAA00105 404', b4.status === 200 && b4.json.memberships.length === 11 && b5.status === 404, b4.json?.memberships?.length);
r = await call('PATCH', `${cohort}/requirement-groups/${AC}`, { token: a1, body: { curriculumId: KHMT25 } });
check('ADM-04f', 'the group PATCH 400, "property curriculumId should not exist"', r.status === 400 && JSON.stringify(r.json).includes('property curriculumId should not exist'), r.json);

console.log('--- state after the run');
cur = await curriculum();
check('after', 'no test group in APCS 2024, ZZADM04 nowhere, {AC} as before ADM-04 linked ZZADM04',
  !groupsOf(cur).some((x) => x.name.startsWith('Nhóm thử ADM-04')) && !codesOf(groupById(cur, AC)).includes('ZZADM04') && (await call('GET', '/courses/ZZADM04', { token: a1 })).status === 404);

log(failureCount() ? `${failureCount()} FAIL(S)` : 'All checks ok');
