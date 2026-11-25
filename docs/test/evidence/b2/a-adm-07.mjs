// TC-B2-ADM-02k, ADM-02l and ADM-07a–i on staging (docs/test/test-cases-b2.md §6), API only.
//   node docs/test/evidence/b2/a-adm-07.mjs <pre|02k|02l|07a|07b|07c|07d|07e|07f|07g|07h|07i|post>
// Node, no dependencies. Prints statuses and bodies, never a token. Checks each expected result (OK / MISMATCH).
// ADM-07j runs in the app's console instead: a-screens.mjs 07j.
import { isDeepStrictEqual } from 'node:util';

const API = 'https://stag-omnicourses.lamter.cc/api';
const PASSWORD = 'correct horse battery';
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
// Sign-in allows 10 requests a minute from one address (ADR 0002): sign-ins are spaced 7 s apart, and a failed one
// stops the run, so a case is never half sent with a missing token.
let lastSignIn = 0;
const signIn = async (email) => {
  const wait = lastSignIn + 7000 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastSignIn = Date.now();
  const res = await fetch(`${API}/auth/sign-in`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: PASSWORD }) });
  console.log(`POST /auth/sign-in (${email}) → ${res.status}`);
  if (res.ok) return (await res.json()).token;
  console.log(`STOPPED: sign-in as ${email} answered ${res.status}; nothing more was sent`);
  process.exit(2);
};
const messages = (body) => [].concat(body?.message ?? []);
const msgHas = (body, s) => messages(body).some((m) => String(m).includes(s));
const is = (res, status, code) => res.status === status && (code === undefined || res.body?.code === code);
const refused = (res, permission) => is(res, 403, 'permission_required') && res.body.permission === permission;

const curriculum = async (token, program, year) => (await call('GET', `/programs/${program}/curricula/${year}`, token, undefined, { quiet: true })).body;
const groupsOf = (c) => c.requirementGroups ?? c.groups ?? [];
const groupNamed = (c, name) => groupsOf(c).find((g) => g.name === name);
const groupStartingWith = (c, prefix) => groupsOf(c).filter((g) => g.name.startsWith(prefix));
const codesOf = (g) => (g?.courses ?? []).map((x) => x.code);
const courseIn = (c, groupName, code) => groupNamed(c, groupName)?.courses.find((x) => x.code === code);
const values = async (a1, a2) => {
  const apcs = (await call('GET', '/admin/programs', a1, undefined, { quiet: true })).body.programs.find((p) => p.code === 'APCS');
  const khmt = (await call('GET', '/admin/programs', a2, undefined, { quiet: true })).body.programs.find((p) => p.code === 'CNTT-TCTA-KHMT');
  const apcs24 = await curriculum(a1, 'APCS', 2024);
  const v = {
    APCS: apcs.id,
    APCS24: apcs.curricula.find((c) => c.cohortYear === 2024).id,
    KHMT: khmt.id,
    KHMT25: khmt.curricula.find((c) => c.cohortYear === 2025).id,
    AC: groupNamed(apcs24, 'Tự chọn Computer Science (C)').id,
    AE: groupNamed(apcs24, 'Kiến thức Computer Science (A): tự chọn').id,
    KG: groupNamed(await curriculum(a1, 'CNTT-TCTA-KHMT', 2025), 'Kiến thức bắt buộc chuyên ngành').id,
  };
  console.log(`  values ${JSON.stringify(v)}`);
  return v;
};
const linkPath = (program, cohort, group, code) => `/admin/programs/${program}/cohorts/${cohort}/requirement-groups/${group}/courses/${code}`;
const groupsPath = (program, cohort) => `/admin/programs/${program}/cohorts/${cohort}/requirement-groups`;

// ---- The files of ADM-07, copied from the cases ------------------------------------------------
const HEADER = 'code,name_vi,name_en,credits,theory_periods,lab_periods,exercise_periods,project_periods';
const F1 = JSON.parse(String.raw`{ "csv": "code,name_vi,name_en,credits,theory_periods,lab_periods,exercise_periods,project_periods\nZZADM07A,Học phần thử ADM-07 A,,3,,,,\nzz.bad,Học phần sai mã,,3,,,,\nZZADM07C,,,3,,,,\nZZADM07D,Học phần thử ADM-07 D,,0,,,,\nZZADM07E,Học phần thử ADM-07 E,,3.0,,,,\n zzadm07a ,Học phần trùng mã,,3,,,,\nZZADM07F,Học phần thiếu cột,,3,,,\nZZADM07G,Học phần thử ADM-07 G,,3,-1,,,\n" }`);
const F2 = JSON.parse(String.raw`{ "csv": "code,name_vi,name_en,credits,theory_periods,lab_periods,exercise_periods,project_periods\r\nZZADM07A,Học phần thử ADM-07 A,,3,45,,,\r\n zzadm07b ,\"Học phần thử ADM-07 B, có dấu phẩy\",Test course ADM-07 B,4,,30,,\r\n\r\n" }`);
const F2b = JSON.parse(String.raw`{ "csv": "code,name_vi,name_en,credits,theory_periods,lab_periods,exercise_periods,project_periods\nZZADM07A,Học phần thử ADM-07 A,,3,45,,,\nZZADM07B,\"Học phần thử ADM-07 B, có dấu phẩy\",Test course ADM-07 B,4,,30,,\n" }`);
const F3 = JSON.parse(String.raw`{ "csv": "code,name_vi,name_en,credits,theory_periods,lab_periods,exercise_periods,project_periods\nZZADM07A,Học phần thử ADM-07 A,,4,45,0,0,0\n" }`);
const F4 = JSON.parse(String.raw`{ "csv": "requirement_group_name,course_code\nTự chọn Computer Science (C),ZZADM07A\nKiến thức bắt buộc chuyên ngành,ZZADM07B\nTự chọn Computer Science (C),ZZADM99\nTự chọn Computer Science (C), zzadm07a \n,ZZADM07B\ntự chọn computer science (c),ZZADM07B\n" }`);
const F5 = JSON.parse(String.raw`{ "csv": "requirement_group_name,course_code\nTự chọn Computer Science (C),ZZADM07A\nTự chọn Computer Science (C),zzadm07b\nTự chọn Computer Science (C),CS404\n" }`);
const F6 = JSON.parse(String.raw`{ "csv": "requirement_group_name,course_code\nKiến thức Computer Science (A): tự chọn,ZZADM07B\n" }`);
const F7 = JSON.parse(String.raw`{ "csv": "requirement_group_name,course_code\nKiến thức bắt buộc chuyên ngành,ZZADM07B\nTự chọn Computer Science (C),ZZADM99\n" }`);
const CAT_PREVIEW = '/admin/catalog/imports/preview';
const CAT_CONFIRM = '/admin/catalog/imports/confirm';
const linkImport = (program, cohort, step) => `/admin/programs/${program}/cohorts/${cohort}/imports/${step}`;
const err = (body, record, field, message) => (body.errors ?? []).some((e) => e.record === record && e.field === field && e.message === message);
const summaryIs = (body, inserts, updates, noOps) => isDeepStrictEqual(body?.summary, { inserts, updates, noOps });
const IMPACT_CHANGED = 'The file, or the saved data it touches, changed since the preview; preview it again';

const which = process.argv[2];
console.log(`ADM ${which} run at ${new Date().toISOString()}`);

if (which === 'pre') {
  // ADM-02's "Accounts and grants", CS420's offering terms, and the test codes ADM-05e–g and ADM-07 create.
  const a4 = await signIn('b2-a4@example.com');
  const g = async (id) => (await call('GET', `/admin/access/users/${id}/grants`, a4)).body;
  const a1 = await g(ID.A1), a2 = await g(ID.A2), a3 = await g(ID.A3), a4g = await g(ID.A4), s1 = await g(ID.S1);
  check('A1: APCS only', a1.programs.map((p) => p.programCode).join() === 'APCS' && a1.permissions.length === 0);
  check('A2: CNTT-TCTA-KHMT only', a2.programs.map((p) => p.programCode).join() === 'CNTT-TCTA-KHMT' && a2.permissions.length === 0);
  check('A3: catalog_maintainer only', a3.programs.length === 0 && a3.permissions.map((p) => p.permission).join() === 'catalog_maintainer');
  check('A4: access_manager only, grantedBy null', a4g.programs.length === 0 && a4g.permissions.map((p) => p.permission).join() === 'access_manager' && a4g.permissions[0].grantedBy === null);
  check('S1: no grant', s1.programs.length === 0 && s1.permissions.length === 0);
  const c24 = await curriculum(a4, 'APCS', 2024);
  check('CS420 offeringTerms null in APCS 2024', courseIn(c24, 'Kiến thức Computer Science (A): tự chọn', 'CS420')?.offeringTerms === null);
  check('APCS 2024 has no group "Nhóm thử ADM-02k…"', groupStartingWith(c24, 'Nhóm thử ADM-02k').length === 0);
  for (const code of ['ZZADM07A', 'ZZADM07B', 'ZZADM99', 'ZZADM05S', 'ZZL0001']) check(`GET /courses/${code} 404`, (await call('GET', `/courses/${code}`, a4, undefined, { quiet: true })).status === 404);
  console.log(`  BAA00104 nameEn ${JSON.stringify((await call('GET', '/courses/BAA00104', a4, undefined, { quiet: true })).body.nameEn)}`);
}

if (which === '02k') {
  const a1 = await signIn('b2-a1@example.com');
  const a2 = await signIn('b2-a2@example.com');
  const v = await values(a1, a2);
  const base = groupsPath(v.APCS, v.APCS24);
  const before = await curriculum(a1, 'APCS', 2024);
  const ae0 = courseIn(before, 'Kiến thức Computer Science (A): tự chọn', 'CS420');
  console.log(`  CS420 in AE before: offeringTerms ${JSON.stringify(ae0?.offeringTerms)}`);
  const one = await call('POST', base, a1, { name: 'Nhóm thử ADM-02k', kind: 'elective' });
  const TG = one.body?.id;
  check('(1) 201, curriculumId {APCS24}, name, elective, notes/totals null', one.status === 201 && one.body.curriculumId === v.APCS24 && one.body.name === 'Nhóm thử ADM-02k' && one.body.kind === 'elective' && one.body.officialNotes === null && one.body.creditsTotal === null && one.body.creditsTotalMin === null);
  if (!TG) { console.log('STOPPED: no {TG}'); process.exit(2); }
  const two = await call('POST', base, a1, { name: 'Nhóm thử ADM-02k', kind: 'elective' });
  check('(2) 409 duplicate_name, "This cohort already has a requirement group with this name"', is(two, 409, 'duplicate_name') && msgHas(two.body, 'This cohort already has a requirement group with this name'));
  const three = await call('PATCH', `${base}/${TG}`, a1, { name: 'Nhóm thử ADM-02k đã sửa', officialNotes: 'Ghi chú thử ADM-02k' });
  check('(3) 200 new name and notes, still elective', three.status === 200 && three.body.name === 'Nhóm thử ADM-02k đã sửa' && three.body.officialNotes === 'Ghi chú thử ADM-02k' && three.body.kind === 'elective');
  const four = await call('PATCH', `${base}/${TG}`, a1, { name: 'Kiến thức Computer Science (A): tự chọn' });
  check('(4) 409 duplicate_name', is(four, 409, 'duplicate_name'));
  const five = await call('PUT', `${base}/${TG}/courses/CS420`, a1);
  check('(5) 204', five.status === 204);
  const mid = await curriculum(a1, 'APCS', 2024);
  const tg = groupNamed(mid, 'Nhóm thử ADM-02k đã sửa');
  check('curriculum lists the group, elective, with the notes and CS420 only', tg?.kind === 'elective' && tg?.officialNotes === 'Ghi chú thử ADM-02k' && isDeepStrictEqual(codesOf(tg), ['CS420']));
  check('CS420 still in "Kiến thức Computer Science (A): tự chọn"', !!courseIn(mid, 'Kiến thức Computer Science (A): tự chọn', 'CS420'));
  const six = await call('DELETE', `${base}/${TG}`, a1);
  check('(6) 409 referenced_item, "The group still links courses; remove them from it first", references ["links CS420"]', is(six, 409, 'referenced_item') && msgHas(six.body, 'The group still links courses; remove them from it first') && isDeepStrictEqual(six.body.references, ['links CS420']));
  const sevenA = await call('DELETE', `${base}/${TG}/courses/CS420`, a1);
  const sevenB = await call('DELETE', `${base}/${TG}`, a1);
  check('(7) 204, 204', sevenA.status === 204 && sevenB.status === 204);
  const after = await curriculum(a1, 'APCS', 2024);
  check('no group "Nhóm thử ADM-02k…"', groupStartingWith(after, 'Nhóm thử ADM-02k').length === 0);
  const ae1 = courseIn(after, 'Kiến thức Computer Science (A): tự chọn', 'CS420');
  check('CS420 still in AE with the same offeringTerms', !!ae1 && isDeepStrictEqual(ae1.offeringTerms, ae0?.offeringTerms));
}

if (which === '02l') {
  const a1 = await signIn('b2-a1@example.com');
  const a2 = await signIn('b2-a2@example.com');
  const v = await values(a1, a2);
  const CLC0 = await curriculum(a1, 'CNTT-TCTA-KHMT', 2025);
  const APCS0 = await curriculum(a1, 'APCS', 2024);
  const k = groupsPath(v.KHMT, v.KHMT25);
  const r1 = await call('POST', k, a1, { name: 'Nhóm thử ADM-02l', kind: 'elective' });
  const r2 = await call('PATCH', `${k}/${v.KG}`, a1, { officialNotes: 'Ghi chú thử ADM-02l' });
  const r3 = await call('PUT', `${k}/${v.KG}/courses/CS420`, a1);
  const r4 = await call('DELETE', `${k}/${v.KG}`, a1);
  check('(1)–(4) 403 permission_required program_admin', [r1, r2, r3, r4].every((r) => refused(r, 'program_admin')));
  const a = groupsPath(v.APCS, v.APCS24);
  const r5a = await call('PATCH', `${a}/${v.KG}`, a1, { officialNotes: 'Ghi chú thử ADM-02l' });
  const r5b = await call('DELETE', `${a}/${v.KG}`, a1);
  const r5c = await call('POST', groupsPath(v.APCS, v.KHMT25), a1, { name: 'Nhóm thử ADM-02l', kind: 'elective' });
  check('(5) 404 not_found "No such requirement group in this cohort" twice', [r5a, r5b].every((r) => is(r, 404, 'not_found') && msgHas(r.body, 'No such requirement group in this cohort')));
  check('(5) then 404 "No such cohort in this program"', is(r5c, 404, 'not_found') && msgHas(r5c.body, 'No such cohort in this program'));
  const r6a = await call('PATCH', `${k}/${v.AE}`, a2, { officialNotes: 'Ghi chú thử ADM-02l' });
  const r6b = await call('DELETE', `${k}/${v.AE}`, a2);
  check('(6) A2: 404 "No such requirement group in this cohort" twice', [r6a, r6b].every((r) => is(r, 404, 'not_found') && msgHas(r.body, 'No such requirement group in this cohort')));
  const leaks = [r1, r2, r3, r4, r5a, r5b, r5c, r6a, r6b].filter((r) => /Kiến thức|Tự chọn|CS420|ADM-02l/.test(JSON.stringify(r.body)));
  check('no answer shows the other program\'s data (no group name or course in a body)', leaks.length === 0);
  const CLC1 = await curriculum(a1, 'CNTT-TCTA-KHMT', 2025);
  const APCS1 = await curriculum(a1, 'APCS', 2024);
  check('CLC equals CLC0', isDeepStrictEqual(CLC1, CLC0));
  check('APCS equals APCS0', isDeepStrictEqual(APCS1, APCS0));
}

if (which === '07a') {
  const s1 = await signIn('b2-s1@example.com');
  const a1 = await signIn('b2-a1@example.com');
  const a2 = await signIn('b2-a2@example.com');
  const v = await values(a1, a2);
  const r1 = await call('POST', CAT_PREVIEW, null, F2);
  check('(1) signed out 401', r1.status === 401);
  const r2a = await call('POST', CAT_PREVIEW, s1, F2);
  const r2b = await call('POST', linkImport(v.APCS, v.APCS24, 'preview'), s1, F5);
  check('(2) S1: 403 catalog_maintainer, then program_admin', refused(r2a, 'catalog_maintainer') && refused(r2b, 'program_admin'));
  const r3a = await call('POST', CAT_PREVIEW, a1, F2);
  const r3b = await call('POST', linkImport(v.APCS, v.KHMT25, 'preview'), a1, F5);
  const r3c = await call('POST', linkImport(v.KHMT, v.KHMT25, 'preview'), a1, F5);
  const r3d = await call('POST', linkImport(v.APCS, v.APCS24, 'preview'), a1, { ...F5, programId: v.KHMT });
  check('(3) A1 catalog: 403 catalog_maintainer', refused(r3a, 'catalog_maintainer'));
  check('(3) A1 {APCS}/{KHMT25}: 404 not_found "No such cohort in this program", nothing of CLC', is(r3b, 404, 'not_found') && msgHas(r3b.body, 'No such cohort in this program') && !/KHMT|Kiến thức/.test(JSON.stringify(r3b.body)));
  check('(3) A1 {KHMT}/{KHMT25}: 403 program_admin', refused(r3c, 'program_admin'));
  check('(3) A1 with programId: 400 validation_failed "property programId should not exist"', is(r3d, 400, 'validation_failed') && msgHas(r3d.body, 'property programId should not exist'));
  const a3 = await signIn('b2-a3@example.com');
  const r4 = await call('POST', linkImport(v.APCS, v.APCS24, 'preview'), a3, F5);
  check('(4) A3: 403 program_admin', refused(r4, 'program_admin'));
  const a4 = await signIn('b2-a4@example.com');
  const r5 = await call('POST', CAT_PREVIEW, a4, F2);
  check('(5) A4: 403 catalog_maintainer', refused(r5, 'catalog_maintainer'));
  const r6 = await call('POST', CAT_CONFIRM, a1, { ...F2, reviewVersion: 'x' });
  check('(6) A1 confirm with "x": 403 catalog_maintainer, not 409', refused(r6, 'catalog_maintainer'));
  check('GET /courses/ZZADM07A 404', (await call('GET', '/courses/ZZADM07A', a1)).status === 404);
}

if (which === '07b') {
  const a3 = await signIn('b2-a3@example.com');
  const p = await call('POST', CAT_PREVIEW, a3, F1);
  check('preview 200, reviewVersion null', p.status === 200 && p.body.reviewVersion === null);
  check('rows: record 2 only, ZZADM07A insert', p.body.rows?.length === 1 && p.body.rows[0].record === 2 && p.body.rows[0].code === 'ZZADM07A' && p.body.rows[0].action === 'insert');
  check('summary {1,0,0}', summaryIs(p.body, 1, 0, 0));
  const expected = [
    [3, 'code', '"zz.bad" is not a course code (letters A-Z and digits, 2 to 20)'],
    [4, 'name_vi', 'should not be empty'],
    [5, 'credits', 'must not be less than 1'],
    [6, 'credits', 'must not be less than 1; must be an integer number'],
    [7, 'code', 'ZZADM07A is in record 2 already; a file names a course once'],
    [8, null, 'has 7 fields; the template has 8'],
    [9, 'theory_periods', 'must not be less than 0; must be an integer number'],
  ];
  for (const [r, f, m] of expected) check(`error record ${r}, ${f}, ${m}`, err(p.body, r, f, m));
  check('errors in this order, exactly these 7', isDeepStrictEqual((p.body.errors ?? []).map((e) => [e.record, e.field, e.message]), expected));
  const c = await call('POST', CAT_CONFIRM, a3, { ...F1, reviewVersion: 'x' });
  check('confirm 400 validation_failed "The file has errors; correct it and preview it again" with the same errors', is(c, 400, 'validation_failed') && msgHas(c.body, 'The file has errors; correct it and preview it again') && isDeepStrictEqual(c.body.errors, p.body.errors));
  check('GET /courses/ZZADM07A 404', (await call('GET', '/courses/ZZADM07A', a3)).status === 404);
}

if (which === '07c') {
  const a3 = await signIn('b2-a3@example.com');
  const HEADER_MSG = `the header must be exactly: ${HEADER}`;
  const bad = [
    ['(1) swapped header', { csv: 'name_vi,code,name_en,credits,theory_periods,lab_periods,exercise_periods,project_periods\nHọc phần,ZZADM07A,,3,,,,\n' }],
    ['(2) F5, a group-link file', F5],
    ['(4) empty', { csv: '' }],
  ];
  for (const [label, body] of bad) {
    const r = await call('POST', CAT_PREVIEW, a3, body);
    check(`${label}: 400 validation_failed "The CSV does not have the header of this template", one error record 1 null "${HEADER_MSG}"`, is(r, 400, 'validation_failed') && msgHas(r.body, 'The CSV does not have the header of this template') && isDeepStrictEqual((r.body.errors ?? []).map((e) => [e.record, e.field, e.message]), [[1, null, HEADER_MSG]]));
  }
  const r3 = await call('POST', CAT_PREVIEW, a3, { csv: `${HEADER}\nZZADM07A,"Học phần "thử",,3,,,,\n` });
  check('(3) 400 "The CSV is malformed; nothing was read from it", one error record 2 null', r3.status === 400 && msgHas(r3.body, 'The CSV is malformed; nothing was read from it') && isDeepStrictEqual((r3.body.errors ?? []).map((e) => [e.record, e.field, e.message]), [[2, null, 'text follows a closing quote; a quoted field ends at the comma or at the end of the line']]));
  check('no message quotes the cell ("thử" / "Học phần")', !/thử|Học phần/.test(JSON.stringify(r3.body)));
  check('GET /courses/ZZADM07A 404', (await call('GET', '/courses/ZZADM07A', a3)).status === 404);
}

if (which === '07d') {
  const a3 = await signIn('b2-a3@example.com');
  const p1 = await call('POST', CAT_PREVIEW, a3, F2);
  const p2 = await call('POST', CAT_PREVIEW, a3, F2);
  const pb = await call('POST', CAT_PREVIEW, a3, F2b);
  const V1 = p1.body.reviewVersion;
  for (const [label, p] of [['F2 first', p1], ['F2 again', p2], ['F2b', pb]]) {
    check(`${label}: 200, no errors, summary {2,0,0}, affectedCurricula []`, p.status === 200 && (p.body.errors ?? []).length === 0 && summaryIs(p.body, 2, 0, 0) && isDeepStrictEqual(p.body.affectedCurricula, []));
    const [a, b] = p.body.rows ?? [];
    check(`${label}: record 2 ZZADM07A, nameEn null, 3 credits, theory 45, other periods 0`, a?.record === 2 && a.code === 'ZZADM07A' && a.nameEn === null && a.credits === 3 && a.theoryPeriods === 45 && a.labPeriods === 0 && a.exercisePeriods === 0 && a.projectPeriods === 0);
    check(`${label}: record 3 ZZADM07B, nameVi with comma, nameEn, 4 credits, lab 30`, b?.record === 3 && b.code === 'ZZADM07B' && b.nameVi === 'Học phần thử ADM-07 B, có dấu phẩy' && b.nameEn === 'Test course ADM-07 B' && b.credits === 4 && b.labPeriods === 30);
    check(`${label}: two rows only (the blank line is no record)`, p.body.rows?.length === 2);
  }
  check('same reviewVersion for F2, F2 again and F2b', typeof V1 === 'string' && p2.body.reviewVersion === V1 && pb.body.reviewVersion === V1);
  check('GET ZZADM07A before the confirmation 404', (await call('GET', '/courses/ZZADM07A', a3)).status === 404);
  const c1 = await call('POST', CAT_CONFIRM, a3, { ...F2b, reviewVersion: V1 });
  check('confirm F2b with V1: 200 {fileType catalog_courses, summary {2,0,0}}', c1.status === 200 && isDeepStrictEqual(c1.body, { fileType: 'catalog_courses', summary: { inserts: 2, updates: 0, noOps: 0 } }));
  const ga = await call('GET', '/courses/ZZADM07A', a3);
  const gb = await call('GET', '/courses/ZZADM07B', a3);
  check('ZZADM07A reads as previewed, no memberships', ga.status === 200 && ga.body.nameEn === null && ga.body.credits === 3 && ga.body.theoryPeriods === 45 && ga.body.memberships.length === 0);
  check('ZZADM07B reads as previewed, no memberships', gb.status === 200 && gb.body.nameVi === 'Học phần thử ADM-07 B, có dấu phẩy' && gb.body.nameEn === 'Test course ADM-07 B' && gb.body.credits === 4 && gb.body.labPeriods === 30 && gb.body.memberships.length === 0);
  const c2 = await call('POST', CAT_CONFIRM, a3, { ...F2, reviewVersion: V1 });
  check(`second confirmation 409 impact_changed "${IMPACT_CHANGED}"`, is(c2, 409, 'impact_changed') && msgHas(c2.body, IMPACT_CHANGED));
}

if (which === '07e') {
  const a3 = await signIn('b2-a3@example.com');
  const before = (await call('GET', '/courses/ZZADM07B', a3, undefined, { quiet: true })).body;
  const p = await call('POST', CAT_PREVIEW, a3, F2);
  check('preview: both rows no_op, summary {0,0,2}', (p.body.rows ?? []).length === 2 && p.body.rows.every((r) => r.action === 'no_op') && summaryIs(p.body, 0, 0, 2));
  const c = await call('POST', CAT_CONFIRM, a3, { ...F2, reviewVersion: p.body.reviewVersion });
  check('confirm 200 with the same summary', c.status === 200 && summaryIs(c.body, 0, 0, 2));
  const p3 = await call('POST', CAT_PREVIEW, a3, F3);
  const row = p3.body.rows?.[0];
  check('F3: ZZADM07A only, update, changedFields ["credits"], current 3 credits, affectedCurricula []', p3.body.rows?.length === 1 && row.code === 'ZZADM07A' && row.action === 'update' && isDeepStrictEqual(row.changedFields, ['credits']) && row.current?.credits === 3 && isDeepStrictEqual(row.affectedCurricula, []));
  const after = (await call('GET', '/courses/ZZADM07B', a3)).body;
  check('ZZADM07B not in F3 and unchanged', isDeepStrictEqual(after, before));
}

if (which === '07f') {
  const a1 = await signIn('b2-a1@example.com');
  const a2 = await signIn('b2-a2@example.com');
  const v = await values(a1, a2);
  const ac0 = codesOf(groupNamed(await curriculum(a1, 'APCS', 2024), 'Tự chọn Computer Science (C)'));
  const p = await call('POST', linkImport(v.APCS, v.APCS24, 'preview'), a1, F4);
  check('preview 200, programId {APCS}, curriculumId {APCS24}, reviewVersion null', p.status === 200 && p.body.programId === v.APCS && p.body.curriculumId === v.APCS24 && p.body.reviewVersion === null);
  check('rows: record 2 only, ZZADM07A insert', p.body.rows?.length === 1 && p.body.rows[0].record === 2 && p.body.rows[0].courseCode === 'ZZADM07A' && p.body.rows[0].action === 'insert');
  const NO_GROUP = 'no requirement group of this cohort has this name; a file does not create groups';
  const expected = [
    [3, 'requirement_group_name', NO_GROUP],
    [4, 'course_code', 'No catalog course has the code ZZADM99; a catalog maintainer adds it first'],
    [5, 'course_code', 'this group and ZZADM07A are in record 2 already; a file names a link once'],
    [6, 'requirement_group_name', 'a value is required'],
    [7, 'requirement_group_name', NO_GROUP],
  ];
  for (const [r, f, m] of expected) check(`error record ${r}, ${f}, ${m}`, err(p.body, r, f, m));
  check('exactly these 5 errors, in order', isDeepStrictEqual((p.body.errors ?? []).map((e) => [e.record, e.field, e.message]), expected));
  const c = await call('POST', linkImport(v.APCS, v.APCS24, 'confirm'), a1, { ...F4, reviewVersion: 'x' });
  check('confirm F4: 400 validation_failed with the same errors', is(c, 400, 'validation_failed') && isDeepStrictEqual(c.body.errors, p.body.errors));
  const p7 = await call('POST', linkImport(v.APCS, v.APCS24, 'preview'), a1, F7);
  check('F7 preview: 200, rows [], reviewVersion null, record 2 group and record 3 course with F4\'s messages', p7.status === 200 && isDeepStrictEqual(p7.body.rows, []) && p7.body.reviewVersion === null && isDeepStrictEqual((p7.body.errors ?? []).map((e) => [e.record, e.field, e.message]), [[2, 'requirement_group_name', NO_GROUP], [3, 'course_code', 'No catalog course has the code ZZADM99; a catalog maintainer adds it first']]));
  const c7 = await call('POST', linkImport(v.APCS, v.APCS24, 'confirm'), a1, { ...F7, reviewVersion: 'x' });
  check(`F7 confirm: 409 impact_changed "${IMPACT_CHANGED}", not 400`, is(c7, 409, 'impact_changed') && msgHas(c7.body, IMPACT_CHANGED));
  const ac1 = codesOf(groupNamed(await curriculum(a1, 'APCS', 2024), 'Tự chọn Computer Science (C)'));
  check('group unchanged, without ZZADM07A', isDeepStrictEqual(ac1, ac0) && !ac1.includes('ZZADM07A'));
}

if (which === '07g') {
  const a1 = await signIn('b2-a1@example.com');
  const a2 = await signIn('b2-a2@example.com');
  const v = await values(a1, a2);
  const ac0 = codesOf(groupNamed(await curriculum(a1, 'APCS', 2024), 'Tự chọn Computer Science (C)'));
  console.log(`  {AC} before: ${ac0.join(', ')}`);
  const p = await call('POST', linkImport(v.APCS, v.APCS24, 'preview'), a1, F5);
  const acts = (p.body.rows ?? []).map((r) => `${r.courseCode}:${r.action}`);
  check('preview: no errors, ZZADM07A and ZZADM07B insert, CS404 no_op, summary {2,0,1}', (p.body.errors ?? []).length === 0 && isDeepStrictEqual(acts, ['ZZADM07A:insert', 'ZZADM07B:insert', 'CS404:no_op']) && summaryIs(p.body, 2, 0, 1));
  const c = await call('POST', linkImport(v.APCS, v.APCS24, 'confirm'), a1, { ...F5, reviewVersion: p.body.reviewVersion });
  check('confirm 200 {fileType group_links, summary {2,0,1}}', c.status === 200 && c.body.fileType === 'group_links' && summaryIs(c.body, 2, 0, 1));
  const ac1 = codesOf(groupNamed(await curriculum(a1, 'APCS', 2024), 'Tự chọn Computer Science (C)'));
  check('APCS 2024 {AC}: ZZADM07A and ZZADM07B once each, besides its courses before', ac1.filter((x) => x === 'ZZADM07A').length === 1 && ac1.filter((x) => x === 'ZZADM07B').length === 1 && ac0.every((x) => ac1.includes(x)) && ac1.length === ac0.length + 2);
  const c25 = await curriculum(a1, 'APCS', 2025);
  check('APCS 2025 has neither', !JSON.stringify(c25).includes('ZZADM07'));
  const p2 = await call('POST', linkImport(v.APCS, v.APCS24, 'preview'), a1, F5);
  check('second preview: three no_op', (p2.body.rows ?? []).length === 3 && p2.body.rows.every((r) => r.action === 'no_op'));
  const c2 = await call('POST', linkImport(v.APCS, v.APCS24, 'confirm'), a1, { ...F5, reviewVersion: p2.body.reviewVersion });
  check('second confirm {0,0,3}', c2.status === 200 && summaryIs(c2.body, 0, 0, 3));
  const ac2 = codesOf(groupNamed(await curriculum(a1, 'APCS', 2024), 'Tự chọn Computer Science (C)'));
  check('no duplicate link', isDeepStrictEqual(ac2, ac1) && new Set(ac2).size === ac2.length);
}

if (which === '07h') {
  const a3 = await signIn('b2-a3@example.com');
  const a2 = await signIn('b2-a2@example.com');
  const a1 = await signIn('b2-a1@example.com');
  const v = await values(a1, a2);
  const p1 = await call('POST', CAT_PREVIEW, a3, F3);
  const row = p1.body.rows?.[0];
  const V1 = p1.body.reviewVersion;
  check('first preview: ZZADM07A update, changedFields ["credits"], current 3, affectedCurricula APCS2024 only (row and top)', row?.action === 'update' && isDeepStrictEqual(row.changedFields, ['credits']) && row.current?.credits === 3 && isDeepStrictEqual(row.affectedCurricula.map((a) => a.curriculumCode), ['APCS2024']) && isDeepStrictEqual(p1.body.affectedCurricula.map((a) => a.curriculumCode), ['APCS2024']));
  const link = await call('PUT', linkPath(v.KHMT, v.KHMT25, v.KG, 'ZZADM07A'), a2);
  check('A2 link 204', link.status === 204);
  const c1 = await call('POST', CAT_CONFIRM, a3, { ...F3, reviewVersion: V1 });
  check('confirm with V1: 409 impact_changed, no new version', is(c1, 409, 'impact_changed') && c1.body.reviewVersion === undefined);
  check('GET still 3 credits', (await call('GET', '/courses/ZZADM07A', a3, undefined, { quiet: true })).body.credits === 3);
  const p2 = await call('POST', CAT_PREVIEW, a3, F3);
  const V2 = p2.body.reviewVersion;
  check('second preview lists APCS2024 and CNTT-TCTA-KHMT-2025, V2 differs from V1', isDeepStrictEqual(p2.body.affectedCurricula.map((a) => a.curriculumCode), ['APCS2024', 'CNTT-TCTA-KHMT-2025']) && typeof V2 === 'string' && V2 !== V1);
  const c2 = await call('POST', CAT_CONFIRM, a3, { ...F3, reviewVersion: V2 });
  check('confirm with V2: 200, updates 1', c2.status === 200 && c2.body.summary?.updates === 1);
  check('GET 4 credits', (await call('GET', '/courses/ZZADM07A', a3)).body.credits === 4);
}

if (which === '07i') {
  const a1 = await signIn('b2-a1@example.com');
  const a2 = await signIn('b2-a2@example.com');
  const a4 = await signIn('b2-a4@example.com');
  const v = await values(a1, a2);
  const AE = 'Kiến thức Computer Science (A): tự chọn';
  const p = await call('POST', linkImport(v.APCS, v.APCS24, 'preview'), a1, F6);
  const V = p.body.reviewVersion;
  check('preview: one insert', p.body.rows?.length === 1 && p.body.rows[0].action === 'insert' && summaryIs(p.body, 1, 0, 0));
  const rev = await call('DELETE', `/admin/access/users/${ID.A1}/programs/${v.APCS}`, a4);
  check('revocation 200', rev.status === 200);
  const c1 = await call('POST', linkImport(v.APCS, v.APCS24, 'confirm'), a1, { ...F6, reviewVersion: V });
  check('confirm 403 permission_required program_admin', refused(c1, 'program_admin'));
  check('group has no ZZADM07B', !codesOf(groupNamed(await curriculum(a1, 'APCS', 2024), AE)).includes('ZZADM07B'));
  const grant = await call('PUT', `/admin/access/users/${ID.A1}/programs/${v.APCS}`, a4);
  check('grant 200', grant.status === 200);
  const c2 = await call('POST', linkImport(v.APCS, v.APCS24, 'confirm'), a1, { ...F6, reviewVersion: V });
  check('second confirm 200 inserts 1', c2.status === 200 && c2.body.summary?.inserts === 1);
  check('group now holds ZZADM07B', codesOf(groupNamed(await curriculum(a1, 'APCS', 2024), AE)).includes('ZZADM07B'));
  console.log('--- clean-up');
  const a3 = await signIn('b2-a3@example.com');
  const u = [
    await call('DELETE', linkPath(v.APCS, v.APCS24, v.AC, 'ZZADM07A'), a1),
    await call('DELETE', linkPath(v.APCS, v.APCS24, v.AC, 'ZZADM07B'), a1),
    await call('DELETE', linkPath(v.APCS, v.APCS24, v.AE, 'ZZADM07B'), a1),
    await call('DELETE', linkPath(v.KHMT, v.KHMT25, v.KG, 'ZZADM07A'), a2),
  ];
  check('each unlink 204', u.every((r) => r.status === 204));
  const d = [await call('DELETE', '/admin/catalog/courses/ZZADM07A', a3), await call('DELETE', '/admin/catalog/courses/ZZADM07B', a3)];
  check('each course DELETE 204', d.every((r) => r.status === 204));
  check('each GET 404', (await call('GET', '/courses/ZZADM07A', a3)).status === 404 && (await call('GET', '/courses/ZZADM07B', a3)).status === 404);
  const g = (await call('GET', `/admin/access/users/${ID.A1}/grants`, a4)).body;
  check('A1 holds APCS again', g.programs.map((x) => x.programCode).join() === 'APCS');
}

if (which === 'post') {
  // The state after the run: the same checks as "pre".
  const a4 = await signIn('b2-a4@example.com');
  const g = async (id) => (await call('GET', `/admin/access/users/${id}/grants`, a4, undefined, { quiet: true })).body;
  const a1 = await g(ID.A1), a2 = await g(ID.A2), a3 = await g(ID.A3), a4g = await g(ID.A4), s1 = await g(ID.S1);
  check('A1 APCS only; A2 CNTT-TCTA-KHMT only; A3 catalog_maintainer only; A4 access_manager only; S1 none',
    a1.programs.map((p) => p.programCode).join() === 'APCS' && !a1.permissions.length &&
    a2.programs.map((p) => p.programCode).join() === 'CNTT-TCTA-KHMT' && !a2.permissions.length &&
    !a3.programs.length && a3.permissions.map((p) => p.permission).join() === 'catalog_maintainer' &&
    !a4g.programs.length && a4g.permissions.map((p) => p.permission).join() === 'access_manager' &&
    !s1.programs.length && !s1.permissions.length);
  const c24 = await curriculum(a4, 'APCS', 2024);
  check('CS420 offeringTerms null', courseIn(c24, 'Kiến thức Computer Science (A): tự chọn', 'CS420')?.offeringTerms === null);
  check('no test group or ZZ course linked in APCS 2024', groupStartingWith(c24, 'Nhóm thử').length === 0 && !JSON.stringify(c24).includes('"ZZ'));
  check('no ZZ course linked in CNTT-TCTA-KHMT 2025', !JSON.stringify(await curriculum(a4, 'CNTT-TCTA-KHMT', 2025)).includes('"ZZ'));
  for (const code of ['ZZADM07A', 'ZZADM07B', 'ZZADM05S', 'ZZL0001']) check(`GET /courses/${code} 404`, (await call('GET', `/courses/${code}`, a4, undefined, { quiet: true })).status === 404);
  const baa = (await call('GET', '/courses/BAA00104', a4, undefined, { quiet: true })).body;
  check('BAA00104: N0, 2 credits, 11 memberships', baa.nameEn === 'History of Vietnamese Communist Party' && baa.credits === 2 && baa.memberships.length === 11);
}

console.log(mismatches ? `${mismatches} MISMATCH(ES)` : 'All checks OK');
