// TC-B2-SHARE-01a–j on staging (docs/test/test-cases-b2.md §7). SHARE-01k is a bash loop, run on its own.
//   node a-share-01.mjs
// Synthetic b2- accounts only. Share tokens are printed as {T1}, {T2} … and never in clear.
import { randomBytes } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { account, call, check, deleteAccount, failureCount, log, secret, signInApi, T_A } from './c-lib.mjs';

const EMAIL = { O: 'b2-s12@example.com', R: 'b2-s13@example.com' };
const course = (c) => ({ kind: 'course', courseCode: c });
const TERMS = [{ term: { year: 2026, number: 1 }, placements: ['CS160', 'CS163', 'CS201', 'CS202', 'MTH251', 'PH211'].map(course) }];
const SP = (name = 'SHARE-01 plan') => ({ name, programCode: 'APCS', cohortYear: 2024, terms: TERMS });
const HIDDEN = ['prerequisite_not_met', 'already_passed', 'already_in_progress', 'requirement_not_covered'];
const PAGE404 = { statusCode: 404, message: 'This plan is not shared', error: 'Not Found' };
const B64URL43 = /^[A-Za-z0-9_-]{43}$/;
log('a-share-01');

const headersOk = (r) => r.headers.get('x-robots-tag') === 'noindex, nofollow' && r.headers.get('cache-control') === 'no-store';
const reader = (t, token) => call('GET', `/shared-plans/${t}`, { token, quiet: true });
const is404Page = (r) => r.status === 404 && isDeepStrictEqual(r.json, PAGE404) && headersOk(r);
const keysDeep = (v, out = new Set()) => { if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { if (!Array.isArray(v)) out.add(k); keysDeep(x, out); } return out; };
// The reader's issues are the owner's, in the same order, without the fields that hold IDs (shared-plan.ts):
// every field the reader gets that the owner's issue also has must be equal; `dropped` lists what the reader lacks.
const sameIssues = (own, shared) => shared.length === own.length && shared.every((x, i) => Object.keys(x).every((k) => !(k in own[i]) || isDeepStrictEqual(x[k], own[i][k])));
const dropped = (own, shared) => [...new Set(own.flatMap((x, i) => Object.keys(x).filter((k) => !(k in (shared[i] ?? {})))))];
const summary = (j) => j && ({ name: j.name, ownerName: j.ownerName, updatedAt: j.updatedAt, terms: j.terms?.map((t) => [t.term?.year ?? t.year, t.term?.number ?? t.number, t.credits, t.placements.length]), issues: j.issues?.map((i) => i.code), issueCodesNotShown: j.issueCodesNotShown, coverage: j.coverage === undefined ? 'absent' : 'present' });

const o = await account(EMAIL.O);
let O = o.token;
const R = (await account(EMAIL.R)).token;
if (!o.created) {
  // A rerun: O exists. Remove the plans of the earlier attempt and empty O's transcript, so O starts with no plan of
  // SHARE-01 and no course of T-A.
  console.log('--- rerun: back to the starting state');
  const plans = (await call('GET', '/plans', { token: O, quiet: true })).json;
  for (const p of plans.plans ?? plans) if (String(p.name).startsWith('SHARE-01')) await call('DELETE', `/plans/${p.id}`, { token: O });
  await call('PUT', '/users/me/transcript', { token: O, body: { rows: [] }, quiet: true });
}

console.log('--- SHARE-01a');
let r = await call('POST', '/plans', { token: O, body: SP(), quiet: true });
const P = r.json?.id;
console.log(`  {P} = ${P}`);
check('SHARE-01a', 'the plan 201', r.status === 201);
r = await call('GET', `/plans/${P}/share`, { token: O });
check('SHARE-01a', 'the first GET 200 { share: null }', r.status === 200 && isDeepStrictEqual(r.json, { share: null }));
r = await call('PUT', `/plans/${P}/share`, { token: O });
const s1 = r.json;
const T1 = s1?.token;
secret(T1, '{T1}');
console.log(`  PUT answer (token as {T1}): ${JSON.stringify({ ...s1, token: '{T1}' })}`);
check('SHARE-01a', 'PUT 200: token of 43 base64url characters, showName false, showTranscriptChecks false, createdAt; Cache-Control: no-store',
  r.status === 200 && B64URL43.test(T1) && s1.showName === false && s1.showTranscriptChecks === false && !!s1.createdAt && r.headers.get('cache-control') === 'no-store', { keys: Object.keys(s1 ?? {}), cacheControl: r.headers.get('cache-control') });
r = await call('GET', `/plans/${P}/share`, { token: O });
check('SHARE-01a', 'the GET returns the same object under share', r.status === 200 && isDeepStrictEqual(r.json.share, s1));
r = await call('PUT', `/plans/${P}/share`, { token: O, body: {} });
check('SHARE-01a', 'the second PUT ({}) returns the same token and createdAt', r.status === 200 && r.json.token === T1 && r.json.createdAt === s1.createdAt);

console.log('--- SHARE-01b');
const issuesO = (await call('GET', `/plans/${P}/issues`, { token: O, quiet: true })).json;
console.log(`  O's issues: ${JSON.stringify(issuesO.issues?.map((i) => i.code) ?? issuesO)}`);
let rd = await reader(T1);
const V = rd.json;
console.log(`  reader: ${JSON.stringify(V)}`);
const allKeys = keysDeep(V);
const t0 = V?.terms?.[0];
const wantIssues = (issuesO.issues ?? []).filter((i) => !HIDDEN.includes(i.code));
const load = V?.issues?.find((i) => i.code === 'load_above_maximum');
check('SHARE-01b', '200 with both headers; keys exactly name, ownerName, curriculum, updatedAt, terms, issues, issueCodesNotShown; no coverage',
  rd.status === 200 && headersOk(rd) && isDeepStrictEqual(Object.keys(V).sort(), ['curriculum', 'issueCodesNotShown', 'issues', 'name', 'ownerName', 'terms', 'updatedAt']), Object.keys(V ?? {}));
check('SHARE-01b', 'name "SHARE-01 plan", ownerName null; curriculum APCS2024, 2024, names, program APCS with names',
  V.name === 'SHARE-01 plan' && V.ownerName === null && V.curriculum?.code === 'APCS2024' && V.curriculum?.cohortYear === 2024 && V.curriculum?.program?.code === 'APCS' && !!V.curriculum?.nameVi && !!V.curriculum?.program?.nameVi, V.curriculum);
check('SHARE-01b', 'terms: 2026 term 1, credits 24, the six placements in order with kind, courseCode, nameVi, nameEn, credits, requirementGroupName',
  V.terms?.length === 1 && t0.credits === 24 && isDeepStrictEqual(t0.placements.map((p) => p.courseCode), ['CS160', 'CS163', 'CS201', 'CS202', 'MTH251', 'PH211'])
    && t0.placements.every((p) => ['kind', 'courseCode', 'nameVi', 'nameEn', 'credits', 'requirementGroupName'].every((k) => k in p)), t0 && { term: t0.term, credits: t0.credits, keys: Object.keys(t0.placements?.[0] ?? {}) });
check('SHARE-01b', 'issueCodesNotShown: the four transcript-decided codes; issues: O\'s report without them, in order, load_above_maximum for 2026/1 (flag, 24, limit 22)',
  isDeepStrictEqual([...V.issueCodesNotShown].sort(), [...HIDDEN].sort()) && sameIssues(wantIssues, V.issues) && load?.kind === 'flag' && load?.credits === 24 && load?.limit === 22, { notShown: V.issueCodesNotShown, codes: V.issues.map((i) => i.code), dropped: dropped(wantIssues, V.issues), load: load && { kind: load.kind, credits: load.credits, limit: load.limit } });
check('SHARE-01b', 'no key id at any depth, no email, no grade, no transcript row', !allKeys.has('id') && !allKeys.has('grade') && !/@example\.com/.test(rd.text) && !allKeys.has('rows'), [...allKeys]);
const asR = await reader(T1, R), asO = await reader(T1, O);
check('SHARE-01b', 'R\'s answer and O\'s are the same as the reader\'s', isDeepStrictEqual(asR.json, V) && isDeepStrictEqual(asO.json, V));

console.log('--- SHARE-01c');
r = await call('PUT', `/plans/${P}/share`, { token: O, body: { showName: true } });
rd = await reader(T1);
check('SHARE-01c', 'showName true: 200, same token, showTranscriptChecks false; the reader\'s ownerName "Test Student"',
  r.status === 200 && r.json.token === T1 && r.json.showName === true && r.json.showTranscriptChecks === false && rd.json.ownerName === 'Test Student', rd.json.ownerName);
const shareBefore = (await call('GET', `/plans/${P}/share`, { token: O })).json;
const bad = [await call('PUT', `/plans/${P}/share`, { token: O, body: { showName: null } }), await call('PUT', `/plans/${P}/share`, { token: O, raw: '[]' }), await call('PUT', `/plans/${P}/share`, { token: O, body: { showTranscriptChecks: 'yes' } })];
r = await call('GET', `/plans/${P}/share`, { token: O });
check('SHARE-01c', 'null, [] and "yes" each 400, [] with "The body must be a JSON object"; the link as before them',
  bad.every((x) => x.status === 400) && JSON.stringify(bad[1].json).includes('The body must be a JSON object') && isDeepStrictEqual(r.json, shareBefore), bad.map((x) => x.json?.message));
r = await call('PUT', `/plans/${P}/share`, { token: O, body: { showName: false } });
rd = await reader(T1);
check('SHARE-01c', 'showName false: 200, showTranscriptChecks unchanged; ownerName null again', r.status === 200 && r.json.showName === false && r.json.showTranscriptChecks === false && rd.json.ownerName === null);

console.log('--- SHARE-01d');
const V0 = (await reader(T1)).json;
const e1 = await call('PATCH', `/plans/${P}`, { token: O, body: { name: 'SHARE-01 plan (renamed)' }, quiet: true });
const five = [{ term: TERMS[0].term, placements: TERMS[0].placements.filter((p) => p.courseCode !== 'CS202') }];
const e2 = await call('PUT', `/plans/${P}/placements`, { token: O, body: { terms: five }, quiet: true });
rd = await reader(T1);
console.log(`  reader: ${JSON.stringify(summary(rd.json))}`);
check('SHARE-01d', 'both edits 200; the reader sees the new name, a later updatedAt, five placements, 20 credits, no load_above_maximum',
  e1.status === 200 && e2.status === 200 && rd.json.name === 'SHARE-01 plan (renamed)' && rd.json.updatedAt > V0.updatedAt && rd.json.terms[0].placements.length === 5 && rd.json.terms[0].credits === 20 && !rd.json.issues.some((i) => i.code === 'load_above_maximum'), [e1.status, e2.status]);
check('SHARE-01d', 'the token is unchanged', (await call('GET', `/plans/${P}/share`, { token: O })).json.share.token === T1);

console.log('--- SHARE-01e');
const beforeTA = (await reader(T1)).json;
const saved = await call('PUT', '/users/me/transcript', { token: O, body: T_A, quiet: true });
const V1 = (await reader(T1)).json;
check('SHARE-01e', 'T-A saved; V1 equals the answer before T-A was saved, updatedAt included', saved.status === 200 && isDeepStrictEqual(V1, beforeTA), summary(V1));
const rep = (await call('GET', `/plans/${P}/issues`, { token: O, quiet: true })).json;
const passed = rep.issues.filter((i) => i.code === 'already_passed').map((i) => i.courseCode).sort();
console.log(`  O's issues: ${JSON.stringify(rep.issues.map((i) => [i.code, i.courseCode ?? null]))}`);
check('SHARE-01e', 'O\'s report holds already_passed for CS160 and MTH251', isDeepStrictEqual(passed, ['CS160', 'MTH251']), passed);
await call('PUT', `/plans/${P}/share`, { token: O, body: { showTranscriptChecks: true } });
rd = await reader(T1);
const on = rd.json, onKeys = keysDeep(on);
console.log(`  reader with the checks: ${JSON.stringify(summary(on))}`);
check('SHARE-01e', 'with the choice on: the reader\'s issues hold the report\'s issues in order, issueCodesNotShown [], coverage present; no grade, no transcript row, no id',
  sameIssues(rep.issues, on.issues) && isDeepStrictEqual(on.issueCodesNotShown, []) && on.coverage !== undefined && !onKeys.has('grade') && !onKeys.has('id') && !onKeys.has('rows'), { codes: on.issues.map((i) => [i.code, i.courseCode ?? null]), dropped: dropped(rep.issues, on.issues), forbidden: [...onKeys].filter((k) => ['grade', 'id', 'rows'].includes(k)) });
await call('PUT', `/plans/${P}/share`, { token: O, body: { showTranscriptChecks: false } });
check('SHARE-01e', 'with the choice off again, the answer equals V1', isDeepStrictEqual((await reader(T1)).json, V1));

console.log('--- SHARE-01f');
const keep = (await reader(T1)).json;
const keepShare = (await call('GET', `/plans/${P}/share`, { token: O })).json;
const w = { showName: true, name: 'Changed', terms: [] };
const writes = [];
for (const m of ['POST', 'PUT', 'PATCH', 'DELETE']) writes.push(await call(m, `/shared-plans/${T1}`, { body: w }));
check('SHARE-01f', 'each reader write 404 (no write route), never 200 nor "This plan is not shared", each with both headers',
  writes.every((x) => x.status === 404 && !x.text.includes('This plan is not shared') && headersOk(x)), writes.map((x) => [x.status, x.json?.message]));
const asTok = [await call('GET', `/plans/${P}/share`, { token: T1 }), await call('PUT', `/plans/${P}/share`, { token: T1 }), await call('DELETE', `/plans/${P}/share`, { token: T1 }), await call('PUT', `/plans/${P}/placements`, { token: T1, body: { terms: [] } })];
check('SHARE-01f', 'with Bearer {T1}, each owner route 401', asTok.every((x) => x.status === 401), asTok.map((x) => x.status));
const asR3 = [await call('GET', `/plans/${P}/share`, { token: R }), await call('PUT', `/plans/${P}/share`, { token: R }), await call('DELETE', `/plans/${P}/share`, { token: R })];
check('SHARE-01f', 'R\'s three calls 404 "No plan with this id"', asR3.every((x) => x.status === 404 && x.json?.message === 'No plan with this id'), asR3.map((x) => [x.status, x.json?.message]));
check('SHARE-01f', 'the reader\'s answer and O\'s link as before', isDeepStrictEqual((await reader(T1)).json, keep) && isDeepStrictEqual((await call('GET', `/plans/${P}/share`, { token: O })).json, keepShare));

console.log('--- SHARE-01g');
r = await call('DELETE', `/plans/${P}/share`, { token: O });
rd = await reader(T1);
check('SHARE-01g', 'DELETE 204; {T1} gives the 404 page at once, with both headers', r.status === 204 && is404Page(rd), [r.status, rd.status, rd.json]);
r = await call('GET', `/plans/${P}/share`, { token: O });
const d2 = await call('DELETE', `/plans/${P}/share`, { token: O });
check('SHARE-01g', 'GET { share: null }; the second DELETE 204', isDeepStrictEqual(r.json, { share: null }) && d2.status === 204);
r = await call('PUT', `/plans/${P}/share`, { token: O });
const T2 = r.json?.token;
secret(T2, '{T2}');
check('SHARE-01g', 'PUT gives a new token {T2} ≠ {T1}, both choices off', r.status === 200 && B64URL43.test(T2) && T2 !== T1 && r.json.showName === false && r.json.showTranscriptChecks === false);
const r2 = await reader(T2), r1 = await reader(T1);
check('SHARE-01g', '{T2} opens (200); {T1} stays the 404 page', r2.status === 200 && is404Page(r1));
const rnd = randomBytes(32).toString('base64url');
secret(rnd, '{random}');
secret(T2.slice(0, -1), '{T2 without its last character}');
const others = [await reader(rnd), await reader('x'), await reader(P), await reader(T2.slice(0, -1))];
check('SHARE-01g', 'a random token, x, {P} and {T2} without its last character: the same 404 page, word for word', others.every(is404Page), others.map((x) => [x.status, x.text]));

console.log('--- SHARE-01h');
r = await call('POST', '/plans', { token: O, body: SP('SHARE-01 plan 2'), quiet: true });
const P2 = r.json?.id;
console.log(`  {P2} = ${P2}`);
r = await call('PUT', `/plans/${P2}/share`, { token: O });
const T3 = r.json?.token;
secret(T3, '{T3}');
const h1 = await reader(T3);
const hd = await call('DELETE', `/plans/${P2}`, { token: O });
const h2 = await reader(T3);
check('SHARE-01h', 'the read before 200; the plan DELETE 204; {T3} gives the 404 page', h1.status === 200 && hd.status === 204 && is404Page(h2), [h1.status, hd.status, h2.status]);

console.log('--- SHARE-01i');
r = await call('POST', '/plans', { token: R, body: SP('SHARE-01 plan R'), quiet: true });
const PR = r.json?.id;
r = await call('PUT', `/plans/${PR}/share`, { token: R });
const TR = r.json?.token;
secret(TR, '{TR}');
const del = await deleteAccount(O);
const i1 = await reader(T2), i2 = await reader(TR);
check('SHARE-01i', 'deletion 202; {T2} the 404 page at once; R\'s {TR} still opens', del.status === 202 && is404Page(i1) && i2.status === 200, [del.status, i1.status, i2.status]);
const back = await signInApi(EMAIL.O);
O = back.token;
check('SHARE-01i', 'the sign-in 200 with accountRestored true', back.accountRestored === true);
r = await call('GET', `/plans/${P}/share`, { token: O });
const i3 = await reader(T2);
check('SHARE-01i', 'the plan is back, its link is not: { share: null }; {T2} stays the 404 page', r.status === 200 && isDeepStrictEqual(r.json, { share: null }) && is404Page(i3));
r = await call('PUT', `/plans/${P}/share`, { token: O });
const T4 = r.json?.token;
secret(T4, '{T4}');
const i4 = await reader(T4);
check('SHARE-01i', '{T4} is a new token and opens', r.status === 200 && T4 !== T2 && T4 !== T1 && i4.status === 200);
const rc = await call('DELETE', `/plans/${PR}`, { token: R });
check('SHARE-01i', 'clean-up: R\'s plan DELETE 204', rc.status === 204);

console.log('--- SHARE-01j');
const ex = await call('GET', '/users/me/export', { token: O, quiet: true });
const shares = ex.json?.tables?.plan_shares ?? [];
console.log(`  plan_shares rows: ${JSON.stringify(shares)}`);
check('SHARE-01j', '200; tables.plan_shares holds the row of {P} with its choices and created_at, no share_token key; {T4} nowhere in the file',
  ex.status === 200 && shares.length === 1 && shares[0].plan_id === P && 'show_name' in shares[0] && 'show_transcript_checks' in shares[0] && 'created_at' in shares[0] && !('share_token' in shares[0]) && !ex.text.includes(T4), Object.keys(shares[0] ?? {}));

log(failureCount() ? `${failureCount()} FAIL(S)` : 'All checks ok');
