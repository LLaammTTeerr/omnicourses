// TC-B2-ADM-03g, and the reruns of ADM-03c (5) and ADM-03d (3) with #245's bodies, on staging (docs/test/test-cases-b2.md §6).
// Runs on the test cohort APCS2099 that ADM-03b left on 25 November. Step (14) creates the program ZZ-ADM03G, which no route
// deletes (Lâm's bot agreed on 28 November). Synthetic b2- accounts only; never prints a token.
//   node a-adm-03g.mjs
import { isDeepStrictEqual } from 'node:util';
import { call, check, failureCount, log, PROGRAM, signInApi } from './c-lib.mjs';

const EMAIL = { A1: 'b2-a1@example.com', A2: 'b2-a2@example.com', A4: 'b2-a4@example.com' };
const A4_ID = '925cb9c8-86de-4427-a8c8-72cf442dd074';
const TEST_YEAR = 2099;
log('a-adm-03g');
const is = (r, status, code) => r.status === status && (code === undefined || r.json?.code === code);
const says = (r, text) => JSON.stringify(r.json ?? '').includes(text);
const groupsOf = (c) => c?.requirementGroups ?? [];

const a1 = (await signInApi(EMAIL.A1)).token;
const a2 = (await signInApi(EMAIL.A2)).token;
const a4 = (await signInApi(EMAIL.A4)).token;
const APCS = PROGRAM.APCS;
const cohorts = `/admin/programs/${APCS}/cohorts`;
const listed = (await call('GET', cohorts, { token: a1, show: (j) => JSON.stringify(j?.cohorts?.map((x) => [x.cohortYear, x.code, x.totalCreditsMin])) })).json; const cohortList = listed.cohorts ?? listed;
const test = cohortList.find((x) => x.cohortYear === TEST_YEAR);
const Y = TEST_YEAR;
const CY = test?.id;
console.log(`  {Y} = ${Y}, {CY} = ${CY}`);
check('ADM-03g', 'setup: APCS has the test cohort APCS2099 with no total, and no cohort 2098', test?.code === 'APCS2099' && test.totalCreditsMin === null && !cohortList.some((x) => x.cohortYear === Y - 1), cohortList.map((x) => x.cohortYear));
const groups = `${cohorts}/${CY}/requirement-groups`;
const yRead = async () => (await call('GET', `/programs/APCS/curricula/${Y}`, { token: a1, quiet: true })).json;
check('ADM-03g', 'setup: APCS2099 has no requirement group (after ADM-03f)', groupsOf(await yRead()).length === 0);

console.log('--- TC-B2-ADM-03c (5), rerun');
const base = { cohortYear: Y - 1, code: `APCS${Y - 1}`, nameVi: 'Khóa thử ADM-03', nameEn: 'ADM-03 test cohort' };
const c5 = await call('POST', cohorts, { token: a1, body: { ...base, totalCreditsMin: -1 } });
check('ADM-03c', '(5) 400, "totalCreditsMin must not be less than 0"', c5.status === 400 && says(c5, 'totalCreditsMin must not be less than 0'), c5.json);
const after5 = ((j) => j.cohorts ?? j)((await call("GET", cohorts, { token: a1, quiet: true })).json).map((x) => x.cohortYear);
check('ADM-03c', '(5) nothing saved: no cohort 2098', !after5.includes(Y - 1), after5);

console.log('--- TC-B2-ADM-03d (3), rerun');
const d3 = await call('POST', groups, { token: a1, body: { name: 'Nhóm thử ADM-03 B', kind: 'elective', creditsTotal: 16 } });
check('ADM-03d', '(3) 400 validation_failed, "creditsTotal: an elective group stores creditsTotalMin, not a fixed total (ADR 0005)"', is(d3, 400, 'validation_failed') && says(d3, 'creditsTotal: an elective group stores creditsTotalMin, not a fixed total (ADR 0005)'), d3.json);
check('ADM-03d', '(3) no group "Nhóm thử ADM-03 B"', !groupsOf(await yRead()).some((g) => g.name === 'Nhóm thử ADM-03 B'));

console.log('--- TC-B2-ADM-03g');
const g1 = await call('PATCH', `${cohorts}/${CY}`, { token: a1, body: { totalCreditsMin: 130 } });
check('ADM-03g', '(1) 200 with totalCreditsMin 130 and a later updatedAt', g1.status === 200 && g1.json.totalCreditsMin === 130 && g1.json.updatedAt > test.updatedAt, [test.updatedAt, g1.json?.updatedAt]);
const g2 = await call('PATCH', `${cohorts}/${CY}`, { token: a1, body: { totalCreditsMin: 130 } });
check('ADM-03g', '(2) 200 with the same updatedAt', g2.status === 200 && g2.json.updatedAt === g1.json.updatedAt, g2.json?.updatedAt);
const g3 = await call('POST', groups, { token: a1, body: { name: 'Nhóm thử ADM-03g bắt buộc', kind: 'compulsory', creditsTotal: 4 } });
const G3 = g3.json?.id;
check('ADM-03g', '(3) 201 compulsory, creditsTotal 4, creditsTotalMin null', g3.status === 201 && g3.json.kind === 'compulsory' && g3.json.creditsTotal === 4 && g3.json.creditsTotalMin === null, g3.json);
const g4 = await call('POST', groups, { token: a1, body: { name: 'Nhóm thử ADM-03g tự chọn', kind: 'elective', creditsTotalMin: 8 } });
const G4 = g4.json?.id;
check('ADM-03g', '(4) 201 elective, creditsTotal null, creditsTotalMin 8', g4.status === 201 && g4.json.kind === 'elective' && g4.json.creditsTotal === null && g4.json.creditsTotalMin === 8, g4.json);
console.log(`  {G3} = ${G3}, {G4} = ${G4}`);
const g5 = await call('POST', groups, { token: a1, body: { name: 'Nhóm thử ADM-03g sai', kind: 'elective', creditsTotal: 4 } });
check('ADM-03g', '(5) 400 validation_failed, the elective message; no group "… sai"', is(g5, 400, 'validation_failed') && says(g5, 'creditsTotal: an elective group stores creditsTotalMin, not a fixed total (ADR 0005)') && !groupsOf(await yRead()).some((g) => g.name === 'Nhóm thử ADM-03g sai'), g5.json);
const COMPULSORY_MSG = 'creditsTotalMin: a compulsory group stores creditsTotal, not a minimum (ADR 0005)';
const g6 = await call('PATCH', `${groups}/${G3}`, { token: a1, body: { creditsTotalMin: 4 } });
check('ADM-03g', '(6) 400, the compulsory message', g6.status === 400 && says(g6, COMPULSORY_MSG), g6.json);
const g7a = await call('PATCH', `${groups}/${G4}`, { token: a1, body: { kind: 'compulsory' } });
const g7b = await call('PATCH', `${groups}/${G4}`, { token: a1, body: { kind: 'compulsory', creditsTotalMin: null, creditsTotal: 8 } });
check('ADM-03g', '(7) 400 with the compulsory message, then 200 compulsory, creditsTotal 8, creditsTotalMin null',
  g7a.status === 400 && says(g7a, COMPULSORY_MSG) && g7b.status === 200 && g7b.json.kind === 'compulsory' && g7b.json.creditsTotal === 8 && g7b.json.creditsTotalMin === null, [g7a.json, g7b.json]);
const g8a = await call('PATCH', `${cohorts}/${CY}`, { token: a1, body: { totalCreditsMin: -1 } });
const g8b = await call('PATCH', `${cohorts}/${CY}`, { token: a1, body: { totalCreditsMin: 1.5 } });
check('ADM-03g', '(8) 400 "totalCreditsMin must not be less than 0", then 400 "totalCreditsMin must be an integer number"',
  g8a.status === 400 && says(g8a, 'totalCreditsMin must not be less than 0') && g8b.status === 400 && says(g8b, 'totalCreditsMin must be an integer number'), [g8a.json, g8b.json]);
const g9 = await call('PATCH', `/admin/programs/${APCS}`, { token: a1, body: { trainingType: 'advanced' } });
check('ADM-03g', '(9) 400, "trainingType: property trainingType should not exist"', g9.status === 400 && says(g9, 'property trainingType should not exist'), g9.json);
const g10 = await call('PATCH', `${cohorts}/${CY}`, { token: a2, body: { totalCreditsMin: 1 } });
check('ADM-03g', '(10) A2: 403 permission_required, program_admin', is(g10, 403, 'permission_required') && g10.json.permission === 'program_admin', g10.json);
const read = await yRead();
const rg3 = groupsOf(read).find((g) => g.name === 'Nhóm thử ADM-03g bắt buộc'), rg4 = groupsOf(read).find((g) => g.name === 'Nhóm thử ADM-03g tự chọn');
check('ADM-03g', 'the read route: APCS2099 totalCreditsMin 130; "… bắt buộc" creditsTotal 4; "… tự chọn" compulsory with creditsTotal 8',
  read.totalCreditsMin === 130 && rg3?.creditsTotal === 4 && rg4?.kind === 'compulsory' && rg4?.creditsTotal === 8, { totalCreditsMin: read.totalCreditsMin, groups: groupsOf(read).map((g) => [g.name, g.kind, g.creditsTotal, g.creditsTotalMin]) });
const stand = await call('GET', `/programs/APCS/curricula/${Y}/standing`, { token: a1, show: (j) => JSON.stringify(j).slice(0, 200) });
console.log(`  standing of APCS${Y} (for information): ${stand.status}`);

console.log('--- TC-B2-ADM-03g clean-up (11)');
const g11 = [await call('DELETE', `${groups}/${G3}`, { token: a1 }), await call('DELETE', `${groups}/${G4}`, { token: a1 })];
const g11c = await call('PATCH', `${cohorts}/${CY}`, { token: a1, body: { totalCreditsMin: null } });
check('ADM-03g', '(11) 204, 204, then 200 with totalCreditsMin null', g11.every((x) => x.status === 204) && g11c.status === 200 && g11c.json.totalCreditsMin === null, [...g11.map((x) => x.status), g11c.status, g11c.json?.totalCreditsMin]);

console.log('--- TC-B2-ADM-03g, the training type (A4)');
const programs = async () => (await call('GET', '/programs', { token: a4, quiet: true })).json;
const zz = (j) => (j?.programs ?? j ?? []).filter((p) => p.code === 'ZZ-ADM03G');
const g12 = await call('POST', '/admin/programs', { token: a4, body: { code: ' apcs ', nameVi: 'Chương trình trùng mã', trainingType: 'advanced' } });
check('ADM-03g', '(12) 409 duplicate_code "A program already has the code APCS"', is(g12, 409, 'duplicate_code') && g12.json.message === 'A program already has the code APCS', g12.json);
const before13 = zz(await programs());
check('ADM-03g', 'before (13): no program ZZ-ADM03G yet', before13.length === 0, before13);
const g13 = await call('POST', '/admin/programs', { token: a4, body: { code: 'ZZ-ADM03G', nameVi: 'Chương trình thử ADM-03g', trainingType: 'dai_tra' } });
check('ADM-03g', '(13) 400 validation_failed, "trainingType must be one of the following values: advanced, joint, high_quality, standard"; no ZZ-ADM03G',
  is(g13, 400, 'validation_failed') && says(g13, 'trainingType must be one of the following values: advanced, joint, high_quality, standard') && zz(await programs()).length === 0, g13.json);
const g14 = await call('POST', '/admin/programs', { token: a4, body: { code: 'ZZ-ADM03G', nameVi: 'Chương trình thử ADM-03g', trainingType: 'standard' } });
const ZP = g14.json?.id;
console.log(`  {ZP} = ${ZP} (stays: no route deletes a program)`);
const grants = await call('GET', `/admin/access/users/${A4_ID}/grants`, { token: a4 });
check('ADM-03g', '(14) 201 with trainingType standard, and no grant for A4 on it', g14.status === 201 && g14.json.trainingType === 'standard' && !JSON.stringify(grants.json).includes(ZP), { status: g14.status, trainingType: g14.json?.trainingType });
const g14p = await call('PATCH', `/admin/programs/${ZP}`, { token: a4, body: { trainingType: 'advanced' } });
check('ADM-03g', '(14) the PATCH: 400 validation_failed, "trainingType: property trainingType should not exist"', is(g14p, 400, 'validation_failed') && says(g14p, 'property trainingType should not exist'), g14p.json);
const end = zz(await programs());
check('ADM-03g', '(14) GET /api/programs lists ZZ-ADM03G with trainingType standard', end.length === 1 && end[0].trainingType === 'standard', end);

const last = ((j) => j.cohorts ?? j)((await call("GET", cohorts, { token: a1, quiet: true })).json).find((x) => x.cohortYear === Y);
check('ADM-03g', 'after the run: APCS2099 has no group and totalCreditsMin null', groupsOf(await yRead()).length === 0 && last.totalCreditsMin === null);
log(failureCount() ? `${failureCount()} FAIL(S)` : 'All checks ok');
