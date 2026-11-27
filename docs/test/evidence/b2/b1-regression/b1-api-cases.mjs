// The API parts of the B1 cases (docs/test/test-cases-b1.md §7 and §8), run against staging:
// ACAD-01a–g, ACAD-02a–f, PLAN-01a, b, d, f, the plans part of ACAD-01e, and DB-01b, d, e,
// DEP-01b, d and GUIDE-01n. Screen parts are in the a-* and p-* scripts.
// Usage: RUN=<id> TOKEN_CACHE=<file outside the repo> LEDGER=<file> node b1-api-cases.mjs [case prefix…]
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { account, API, audit, begin, call, check, email, eq, log, note, onboard, PW, row, saveTranscript, signInAgain, sleep, summary } from './lib.mjs';

const only = process.argv.slice(2);
const want = (id) => only.length === 0 || only.some((p) => id.startsWith(p));
const group = (a, name) => a.groups.find((g) => g.name === name);
const course = (g, code) => g.courses.find((c) => c.code === code);
const termOf = (a, y, n) => a.terms.find((t) => t.term.year === y && t.term.number === n);
const A_REQ = 'Kiến thức Computer Science (A): bắt buộc';
const A_ELE = 'Kiến thức Computer Science (A): tự chọn';
const NON_CS = 'Kiến thức Non Computer Science';
const C_ELE = 'Tự chọn Computer Science (C)';
const pick = (o, keys) => Object.fromEntries(keys.map((k) => [k, o?.[k]]));
const graded = (codes, term, grade = 7.0) => codes.map((c) => row(c, 'graded', grade, term));

// ---------------------------------------------------------------- B0 cases carried to B1
if (want('DB-01') || want('DEP-01')) {
  begin('DB-01b / DEP-01b (health on staging)');
  const h = await call('GET', '/health');
  check('200 and exactly {"status":"ok","database":"up"}', h.status === 200 && eq(h.json, { status: 'ok', database: 'up' }), `${h.status} ${h.text}`);

  begin('DB-01d (docs page and OpenAPI JSON)');
  const docs = await call('GET', '/docs');
  check('GET /api/docs answers 200 with HTML', docs.status === 200 && /html/.test(docs.headers.get('content-type') ?? ''), `${docs.status} ${docs.headers.get('content-type')}`);
  const doc = await call('GET', '/docs-json');
  check('JSON starts with "openapi":"3.2.0"', doc.text.startsWith('{"openapi":"3.2.0"'), doc.text.slice(0, 20));
  const tags = [...new Set(Object.values(doc.json.paths).flatMap((p) => Object.values(p).flatMap((o) => o.tags ?? [])))];
  check('groups include health, auth and users', ['health', 'auth', 'users'].every((t) => tags.includes(t)), tags.join(', '));
  check('a bearer scheme is declared', JSON.stringify(doc.json.components.securitySchemes ?? {}).includes('bearer'), Object.keys(doc.json.components.securitySchemes ?? {}).join(', '));
  const committed = JSON.parse(readFileSync(new URL('../../../../../src/backend/openapi.json', import.meta.url), 'utf8'));
  check('identical to src/backend/openapi.json of the tested commit', eq(doc.json, committed), `${Object.keys(doc.json.paths).length} paths`);

  begin('DB-01e / GUIDE-01n (every route without a token)');
  const PUBLIC = ['GET /api/health', 'GET /api/guides', 'GET /api/guides/{id}', 'POST /api/auth/sign-up', 'POST /api/auth/sign-in'];
  const guides = (await call('GET', '/guides')).json;
  const guideIds = (guides.guides ?? guides).map((g) => g.id);
  note(`published guides: ${guideIds.join(', ')}`);
  const open = [];
  let closed = 0;
  const guideRoutes = [];
  for (const [path, ops] of Object.entries(doc.json.paths)) {
    for (const method of Object.keys(ops)) {
      const key = `${method.toUpperCase()} ${path}`;
      if (path.startsWith('/api/guides')) guideRoutes.push(key);
      if (PUBLIC.includes(key)) continue;
      const url = path.replace(/^\/api/, '').replace(/\{[^}]+\}/g, randomUUID());
      const r = await call(method.toUpperCase(), url, method === 'get' || method === 'delete' ? {} : { body: {} });
      if (r.status === 401) closed++; else open.push(`${key} answered ${r.status}`);
    }
  }
  check('every route outside the five public ones answers 401', open.length === 0, `${closed} routes answered 401${open.length ? '; NOT 401: ' + open.join('; ') : ''}`);
  check('the guide routes in the document are exactly two, both GET', eq(guideRoutes.sort(), ['GET /api/guides', 'GET /api/guides/{id}']), guideRoutes.join(', '));
  const list = await call('GET', '/guides');
  check('GET /api/guides without a token: 200', list.status === 200, list.status);
  for (const id of guideIds) {
    const g = await call('GET', `/guides/${id}`);
    check(`GET /api/guides/${id} without a token: 200`, g.status === 200, g.status);
  }
  const missing = await call('GET', '/guides/no-such-guide');
  check('GET /api/guides/no-such-guide: 404', missing.status === 404, `${missing.status} ${missing.text}`);
  for (const id of ['zz-draft', 'zz-withdrawn', 'zz-fresh']) {
    const g = await call('GET', `/guides/${id}`);
    note(`GET /api/guides/${id} on staging: ${g.status} (the zz-* test guides are not loaded on staging, §6 item 12)`);
  }
  for (const m of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    const r = await call(m, '/guides', m === 'DELETE' ? {} : { body: {} });
    note(`${m} /api/guides without a token: ${r.status}`);
  }

  begin('DEP-01d (AUTH-01a and AUTH-01k on staging)');
  const address = email('dep01d');
  const { appendFileSync } = await import('node:fs');
  await sleep(21_000);
  const up = await call('POST', '/auth/sign-up', { body: { email: address, password: PW, displayName: 'Test Student', acceptedTerms: true } });
  if (up.status === 201) appendFileSync(process.env.LEDGER, address + '\n');
  check('sign-up 201 with token, expiresAt, user, accountRestored false', up.status === 201 && !!up.json?.token && up.json.accountRestored === false, `${up.status} keys: ${Object.keys(up.json ?? {}).join(', ')}; user keys: ${Object.keys(up.json?.user ?? {}).join(', ')}`);
  check('user has the email and display name', up.json?.user?.email === address && up.json?.user?.displayName === 'Test Student', pick(up.json?.user, ['email', 'displayName']));
  const days = (new Date(up.json?.expiresAt).getTime() - Date.now()) / 86_400_000;
  check('expiresAt about 7 days ahead (SESS-01l stand-in)', Math.abs(days - 7) < 0.01, up.json?.expiresAt);
  check('no password field in the body', !/password/i.test(up.text), 'no "password" in the response text');
  const inn = await signInAgain('dep01d');
  check('sign-in 200 with a different token, accountRestored false', inn.status === 200 && inn.json.token !== up.json.token && inn.json.accountRestored === false, inn.status);
}

// ---------------------------------------------------------------- TC-B1-ACAD-01
const fixturePath = new URL('../../../../../src/backend/test/fixtures/apcs-2024-completion.json', import.meta.url);
const fixtureBytes = readFileSync(fixturePath);
const FIXTURE_SHA = 'd0a0493f2fe62da8b070d853392100a9f47babac789f2c099ed69ccfdf3facde';

if (want('ACAD-01')) {
  const s = await account('m06');
  const ob = await onboard(s.token);
  const tr0 = await call('GET', '/users/me/transcript', { token: s.token });

  begin('ACAD-01a (API part)');
  if ((tr0.json?.rows ?? []).length === 0) {
    check('account onboarded to APCS 2024, no transcript saved', ob.status === 200 && tr0.status === 200, `onboarding ${ob.status}; transcript rows ${tr0.json.rows.length}`);
  } else {
    note(`rerun: the account already holds ${tr0.json.rows.length} rows; saving an empty transcript first`);
    await saveTranscript(s.token, []);
  }
  let r = await audit(s.token);
  let a = r.json;
  check('200', r.status === 200, r.status);
  check('credits', eq(a.credits, { accumulated: 0, towardTotal: 0, inProgressTowardTotal: 0, totalRequired: 163, remaining: 163, yearLevel: 1 }), a.credits);
  check('gpa.average and accumulatedAverage null', a.gpa.average === null && a.gpa.accumulatedAverage === null, a.gpa);
  check('terms and unmatchedCourses empty', a.terms.length === 0 && a.unmatchedCourses.length === 0, `${a.terms.length}, ${a.unmatchedCourses.length}`);
  const expectedGroups = { [A_REQ]: 40, [A_ELE]: 16, 'Kiến thức Math': 16, [NON_CS]: 26, 'Kiến thức Physics': 12, 'Kiến thức tốt nghiệp': 10, 'Tự chọn Math (B)': 8 };
  note(`groups: ${a.groups.map((g) => `${g.name} [required ${g.requiredCredits}, passed ${g.passedCredits}, remaining ${g.remainingCredits}, met ${g.met}]`).join(' | ')}`);
  check('eight groups', a.groups.length === 8, a.groups.length);
  for (const [name, min] of Object.entries(expectedGroups)) {
    const g = group(a, name);
    check(`${name}: passed 0, required and remaining ${min}`, g && g.passedCredits === 0 && g.requiredCredits === min && g.remainingCredits === min, g && pick(g, ['requiredCredits', 'passedCredits', 'remainingCredits']));
  }
  const c = group(a, C_ELE);
  check('(C): requiredCredits and remainingCredits null, met true', c && c.requiredCredits === null && c.remainingCredits === null && c.met === true, c && pick(c, ['requiredCredits', 'remainingCredits', 'met']));
  const cm = a.combinedMinimums.find((m) => m.name === 'Kiến thức tự chọn');
  check('combined minimum Kiến thức tự chọn at 0 of 43', cm && cm.credits === 0 && cm.creditsMin === 43, cm && pick(cm, ['name', 'credits', 'creditsMin', 'remainingCredits', 'met']));
  check('graduation.status not_yet', a.graduation.status === 'not_yet', a.graduation.status);
  check('no estimated graduation term in the audit', !/estimat|graduationTerm/i.test(Object.keys(a).join(',') + Object.keys(a.graduation).join(',')), Object.keys(a.graduation).join(', '));

  begin('ACAD-01b');
  r = await saveTranscript(s.token, [row('CS160', 'graded', 8.0, '2024-1'), row('CM102', 'graded', 7.0, '2024-1')]);
  check('save 200', r.status === 200, r.status);
  a = (await audit(s.token)).json;
  check('credits accumulated 8, towardTotal 8, remaining 155', a.credits.accumulated === 8 && a.credits.towardTotal === 8 && a.credits.remaining === 155, a.credits);
  check('gpa 7.5 / 7.5, classification good', a.gpa.average === 7.5 && a.gpa.accumulatedAverage === 7.5 && a.gpa.classification === 'good', a.gpa);
  check('(A) bắt buộc 4 of 40, CS160 passed', group(a, A_REQ).passedCredits === 4 && group(a, A_REQ).requiredCredits === 40 && course(group(a, A_REQ), 'CS160').status === 'passed', `${group(a, A_REQ).passedCredits}/${group(a, A_REQ).requiredCredits}, CS160 ${course(group(a, A_REQ), 'CS160').status}`);
  check('Non Computer Science 4 of 26, CM102 passed', group(a, NON_CS).passedCredits === 4 && group(a, NON_CS).requiredCredits === 26 && course(group(a, NON_CS), 'CM102').status === 'passed', `${group(a, NON_CS).passedCredits}/${group(a, NON_CS).requiredCredits}, CM102 ${course(group(a, NON_CS), 'CM102').status}`);
  let t = termOf(a, 2024, 1);
  check('term 2024-1: 8 credits, one violation below_minimum 8 / 10', t.credits === 8 && t.capViolations.length === 1 && t.capViolations[0].rule === 'below_minimum' && t.capViolations[0].credits === 8 && t.capViolations[0].limit === 10, { credits: t.credits, capViolations: t.capViolations.map((v) => pick(v, ['rule', 'credits', 'limit'])) });

  begin('ACAD-01d');
  const el = group(a, A_ELE);
  check('(A) tự chọn 0 of 16, met false', el.passedCredits === 0 && el.requiredCredits === 16 && el.met === false, pick(el, ['passedCredits', 'requiredCredits', 'met']));
  const unmet = a.graduation.unmet.find((u) => u.description === `Requirement group "${A_ELE}"`);
  check('graduation.unmet has the group, id group:<uuid>, citation Điều 17.3.b', unmet && /^group:[0-9a-f-]{36}$/.test(unmet.id) && unmet.citation === 'QĐ 1175/QĐ-KHTN Điều 17.3.b', unmet);
  const nc = a.graduation.notChecked;
  check('notChecked ids are exactly the five', eq(nc.map((n) => n.id).sort(), ['defence_education_certificate', 'foreign_language_standard', 'it_standard', 'no_prosecution_or_suspension', 'study_time_limit']), nc.map((n) => n.id).join(', '));
  const cites = Object.fromEntries(nc.map((n) => [n.id, n.citation]));
  check('they cite Điều 17.3.a, 17.3.c, 17.3.d, 17.3.e and 2.7', /17\.3\.a$/.test(cites.no_prosecution_or_suspension) && /17\.3\.c$/.test(cites.defence_education_certificate) && /17\.3\.d$/.test(cites.foreign_language_standard) && /17\.3\.e$/.test(cites.it_standard) && /Điều 2\.7$/.test(cites.study_time_limit), cites);
  check('none of the five is listed as met', !a.graduation.met.some((m) => nc.some((n) => n.id === m.id)), `met ids: ${a.graduation.met.map((m) => m.id).join(', ') || 'none'}`);

  begin('ACAD-01e (audit part)');
  const loads = [
    ['(1) 9 credits', ['CS160', 'BAA00101', 'BAA00102'], 9, [['below_minimum', 9, 10]]],
    ['(2) 10 credits', ['CS160', 'CS163', 'BAA00102'], 10, []],
    ['(3) 22 credits', ['CS160', 'CS163', 'CS201', 'CS202', 'CS250', 'BAA00102'], 22, []],
    ['(4) 23 credits', ['CS160', 'CS163', 'CS201', 'CS202', 'BAA00101', 'BAA00102', 'BAA00103'], 23, [['above_maximum', 23, 22]]],
  ];
  for (const [label, codes, credits, violations] of loads) {
    r = await saveTranscript(s.token, graded(codes, '2024-1'));
    a = (await audit(s.token)).json;
    t = termOf(a, 2024, 1);
    const seen = t.capViolations.map((v) => [v.rule, v.credits, v.limit]);
    check(`${label}: save 200, trainingType advanced, kind main, caps 10–22, ${credits} credits`, r.status === 200 && a.trainingType === 'advanced' && t.kind === 'main' && eq(t.caps, { min: 10, max: 22 }) && t.credits === credits, { save: r.status, trainingType: a.trainingType, kind: t.kind, caps: t.caps, credits: t.credits });
    check(`${label}: capViolations ${JSON.stringify(violations)}`, eq(seen, violations), seen);
    if (violations.length) check(`${label}: citation Điều 7.2 and a petition note`, t.capViolations[0].citation === 'QĐ 1175/QĐ-KHTN Điều 7.2' && !!t.capViolations[0].petition, pick(t.capViolations[0], ['citation', 'petition']));
  }

  begin('ACAD-01f');
  const term3 = [
    ['(1) 12 credits', ['CS160', 'CS163', 'CS201'], 12],
    ['(2) 13 credits', ['CS160', 'CS163', 'BAA00101', 'BAA00102'], 13],
    ['(3) 22 credits', ['CS160', 'CS163', 'CS201', 'CS202', 'CS250', 'BAA00102'], 22],
  ];
  for (const [label, codes, credits] of term3) {
    r = await saveTranscript(s.token, graded(codes, '2024-3'));
    a = (await audit(s.token)).json;
    t = termOf(a, 2024, 3);
    check(`${label} in 2024-3: kind main, caps 10–22, no violation`, r.status === 200 && t.kind === 'main' && eq(t.caps, { min: 10, max: 22 }) && t.credits === credits && t.capViolations.length === 0, { save: r.status, kind: t.kind, caps: t.caps, credits: t.credits, capViolations: t.capViolations });
    check(`${label}: nothing mentions a summer term or a 12-credit cap`, !/summer|"limit":12/.test(JSON.stringify(a.terms)), 'no "summer", no limit 12 in terms');
  }

  begin('ACAD-01c (API part)');
  const sha = createHash('sha256').update(fixtureBytes).digest('hex');
  check('fixture SHA-256 matches', sha === FIXTURE_SHA, sha);
  r = await call('PUT', '/users/me/transcript', { token: s.token, body: fixtureBytes, raw: true });
  check('PUT transcript with the file as the body: 200', r.status === 200, r.status);
  const rows = (await call('GET', '/users/me/transcript', { token: s.token })).json.rows;
  check('the API holds 45 rows', rows.length === 45, rows.length);
  a = (await audit(s.token)).json;
  check('graduation.status done, unmet empty', a.graduation.status === 'done' && a.graduation.unmet.length === 0, { status: a.graduation.status, unmet: a.graduation.unmet.length });
  check('credits as §6 item 13', eq(a.credits, { accumulated: 172, towardTotal: 164, inProgressTowardTotal: 0, totalRequired: 163, remaining: 0, yearLevel: 4 }), a.credits);
  check('gpa as §6 item 13', eq(a.gpa, { average: 7.77, accumulatedAverage: 7.77, accumulatedAverageFourPoint: 3.3, classification: 'good', gradedCredits: 164 }), a.gpa);
  check('every group met', a.groups.every((g) => g.met), a.groups.filter((g) => !g.met).map((g) => g.name).join(', ') || 'all 8 met');
  const cm2 = a.combinedMinimums.find((m) => m.name === 'Kiến thức tự chọn');
  check('Kiến thức tự chọn met, 44 of 43', cm2.met && cm2.credits === 44 && cm2.creditsMin === 43, pick(cm2, ['credits', 'creditsMin', 'met']));
  check('notChecked still lists the five conditions', a.graduation.notChecked.length === 5, a.graduation.notChecked.map((n) => n.id).join(', '));
  check('12 terms, 10 to 20 credits each, no cap violation', a.terms.length === 12 && a.terms.every((x) => x.credits >= 10 && x.credits <= 20 && x.capViolations.length === 0), a.terms.map((x) => `${x.term.year}-${x.term.number}:${x.credits}`).join(' '));
  check('no warning and no unmatched course', a.warnings.length === 0 && a.unmatchedCourses.length === 0, `${a.warnings.length} warnings, ${a.unmatchedCourses.length} unmatched`);

  begin('ACAD-01g (API part)');
  const signedOut = await call('GET', '/programs/APCS/curricula/2024');
  note(`without a token: ${signedOut.status}`);
  r = await call('GET', '/programs/APCS/curricula/2024', { token: s.token });
  check('200', r.status === 200, r.status);
  const cg = r.json.groups ?? r.json.requirementGroups ?? [];
  note(`curriculum keys: ${Object.keys(r.json).join(', ')}; groups: ${cg.map((g) => `${g.name} (${(g.courses ?? []).length})`).join(' | ')}`);
  check('the eight groups of ACAD-01a', eq(cg.map((g) => g.name).sort(), [...Object.keys(expectedGroups), C_ELE].sort()), cg.length);
  const req = cg.find((g) => g.name === A_REQ);
  const cs163 = req?.courses.find((x) => (x.code ?? x.courseCode) === 'CS163');
  check('CS163 in (A) bắt buộc, "Cấu trúc dữ liệu", 4 credits', cs163 && (cs163.nameVi ?? cs163.name) === 'Cấu trúc dữ liệu' && cs163.credits === 4, cs163);
  const all = cg.flatMap((g) => g.courses ?? []);
  const withData = all.filter((x) => x.prerequisites !== null || x.offeringTerms !== null);
  check('every course has prerequisites and offeringTerms null', all.length > 0 && all.every((x) => 'prerequisites' in x && 'offeringTerms' in x) && withData.length === 0, `${all.length} courses; with data: ${withData.map((x) => x.code).join(', ') || 'none'}`);
}

// ---------------------------------------------------------------- TC-B1-ACAD-02
if (want('ACAD-02')) {
  const s = await account('m06');
  await onboard(s.token);

  begin('ACAD-02a');
  let r = await saveTranscript(s.token, [row('CS160', 'graded', 5.0, '2024-1'), row('CS163', 'graded', 4.9, '2024-1'), row('CS201', 'pass', null, '2024-1'), row('CS202', 'fail', null, '2024-1'), row('CS250', 'exempt', null, '2024-1'), row('CS300', 'in_progress', null, '2024-2')]);
  let a = (await audit(s.token)).json;
  let g = group(a, A_REQ);
  const st = Object.fromEntries(['CS160', 'CS163', 'CS201', 'CS202', 'CS250', 'CS300'].map((c) => [c, course(g, c).status]));
  check('save 200; statuses', r.status === 200 && eq(st, { CS160: 'passed', CS163: 'failed', CS201: 'passed', CS202: 'failed', CS250: 'passed', CS300: 'in_progress' }), st);
  check('group: passed 12, in progress 4, remaining 24', g.passedCredits === 12 && g.inProgressCredits === 4 && g.remainingCredits === 24, pick(g, ['passedCredits', 'inProgressCredits', 'remainingCredits']));
  check('credits.accumulated 12, inProgressTowardTotal 4', a.credits.accumulated === 12 && a.credits.inProgressTowardTotal === 4, a.credits);
  check('gpa.average 4.95, accumulatedAverage 5.0, gradedCredits 4', a.gpa.average === 4.95 && a.gpa.accumulatedAverage === 5 && a.gpa.gradedCredits === 4, a.gpa);
  check('term 2024-1 failedCourseCodes CS163 and CS202', eq([...termOf(a, 2024, 1).failedCourseCodes].sort(), ['CS163', 'CS202']), termOf(a, 2024, 1).failedCourseCodes);

  begin('ACAD-02b');
  await saveTranscript(s.token, [row('CS160', 'graded', 3.0, '2024-1'), row('CS160', 'graded', 8.0, '2024-2')]);
  a = (await audit(s.token)).json;
  let c160 = course(group(a, A_REQ), 'CS160');
  check('first save: CS160 passed once with 8.0; accumulated 4; averages 8.0', c160.status === 'passed' && c160.grade === 8 && a.credits.accumulated === 4 && a.gpa.average === 8 && a.gpa.accumulatedAverage === 8, { status: c160.status, grade: c160.grade, accumulated: a.credits.accumulated, gpa: pick(a.gpa, ['average', 'accumulatedAverage']) });
  check('term 2024-1 keeps its sitting: average 3.0, failedCourseCodes CS160', termOf(a, 2024, 1).average === 3 && eq(termOf(a, 2024, 1).failedCourseCodes, ['CS160']), pick(termOf(a, 2024, 1), ['average', 'failedCourseCodes']));
  await saveTranscript(s.token, [row('CS160', 'graded', 3.0, '2024-1'), row('CS160', 'graded', 8.0, '2024-2'), row('CS160', 'graded', 6.0, '2024-3')]);
  a = (await audit(s.token)).json;
  c160 = course(group(a, A_REQ), 'CS160');
  check('second save: CS160 grade 6.0, accumulated still 4, accumulatedAverage 6.0', c160.grade === 6 && a.credits.accumulated === 4 && a.gpa.accumulatedAverage === 6, { grade: c160.grade, accumulated: a.credits.accumulated, accumulatedAverage: a.gpa.accumulatedAverage });

  begin('ACAD-02c');
  await saveTranscript(s.token, [...graded(['CS160', 'CS163', 'CS201', 'CS202'], '2024-1'), ...graded(['CS250', 'CS300', 'CS323', 'CS333'], '2024-2'), ...graded(['CS486', 'ECE341', 'CS251', 'CS252'], '2024-3'), ...graded(['CS311', 'CS320', 'CS350'], '2025-1')]);
  a = (await audit(s.token)).json;
  g = group(a, A_REQ);
  check('(A) bắt buộc 40 of 40, met', g.passedCredits === 40 && g.met, pick(g, ['passedCredits', 'requiredCredits', 'met']));
  g = group(a, A_ELE);
  const cGroup = group(a, C_ELE);
  check('(A) tự chọn passed 20 of 16, met, overflowOut 4 toward (C)', g.passedCredits === 20 && g.met && g.overflowOutCredits === 4 && g.overflowToGroupId === cGroup.id, pick(g, ['passedCredits', 'requiredCredits', 'met', 'overflowOutCredits']));
  check('(C): requiredCredits null, overflowIn 4, met', cGroup.requiredCredits === null && cGroup.overflowInCredits === 4 && cGroup.met, pick(cGroup, ['requiredCredits', 'overflowInCredits', 'met']));
  const cm = a.combinedMinimums.find((m) => m.name === 'Kiến thức tự chọn');
  check('Kiến thức tự chọn: credits 4, remaining 39', cm.credits === 4 && cm.remainingCredits === 39, pick(cm, ['credits', 'remainingCredits']));
  check('credits.towardTotal 60 (not 64), remaining 103', a.credits.towardTotal === 60 && a.credits.remaining === 103, a.credits);
  check('no term has a cap violation (16, 16, 16, 12)', eq(a.terms.map((x) => x.credits), [16, 16, 16, 12]) && a.terms.every((x) => x.capViolations.length === 0), a.terms.map((x) => `${x.term.year}-${x.term.number}:${x.credits}/${x.capViolations.length}`).join(' '));

  begin('ACAD-02f');
  await saveTranscript(s.token, [row('CS160', 'graded', 8.0, '2024-1'), row('ZZ999', 'graded', 9.0, '2025-1')]);
  a = (await audit(s.token)).json;
  check('unmatchedCourses is exactly ZZ999, passed true', a.unmatchedCourses.length === 1 && a.unmatchedCourses[0].code === 'ZZ999' && a.unmatchedCourses[0].passed === true, a.unmatchedCourses.map((u) => pick(u, ['code', 'passed'])));
  check('warnings has not_in_curriculum for ZZ999', a.warnings.some((w) => w.code === 'not_in_curriculum' && w.courseCode === 'ZZ999'), a.warnings.map((w) => pick(w, ['code', 'courseCode'])));
  check('counts toward nothing: accumulated 4, average 8.0', a.credits.accumulated === 4 && a.gpa.average === 8, { accumulated: a.credits.accumulated, average: a.gpa.average });
  check('term 2025-1 still shows 4 credits of load', termOf(a, 2025, 1).credits === 4, termOf(a, 2025, 1).credits);

  begin('ACAD-02d (API part)');
  const s7 = await account('m07');
  await onboard(s7.token);
  await saveTranscript(s7.token, [row('CS160', 'graded', 8.0, '2024-1')]);
  a = (await audit(s7.token)).json;
  check('first: accumulated 4, average 8.0', a.credits.accumulated === 4 && a.gpa.average === 8, { accumulated: a.credits.accumulated, average: a.gpa.average });
  await saveTranscript(s7.token, [row('CS160', 'graded', 8.0, '2024-1'), row('CS163', 'graded', 6.0, '2024-1')]);
  a = (await audit(s7.token)).json;
  check('second: accumulated 8, average 7.0, (A) bắt buộc passed 8', a.credits.accumulated === 8 && a.gpa.average === 7 && group(a, A_REQ).passedCredits === 8, { accumulated: a.credits.accumulated, average: a.gpa.average, passed: group(a, A_REQ).passedCredits });

  begin('ACAD-02e');
  const s8 = await account('m08');
  await onboard(s8.token);
  await saveTranscript(s8.token, [row('CM102', 'graded', 7.0, '2024-1')]);
  const read8 = async (label) => {
    const tr = (await call('GET', '/users/me/transcript', { token: s8.token }));
    const au = (await audit(s8.token));
    check(`${label}: transcript holds only CM102`, eq(tr.json.rows.map((x) => x.courseCode), ['CM102']), tr.json.rows.map((x) => x.courseCode));
    check(`${label}: accumulated 4, average 7.0`, au.json.credits.accumulated === 4 && au.json.gpa.average === 7, { accumulated: au.json.credits.accumulated, average: au.json.gpa.average });
    const taken = au.json.groups.flatMap((x) => x.courses).filter((x) => x.status !== 'not_taken').map((x) => x.code);
    check(`${label}: no course of the other account in either response`, !/"CS16[03]"|"CS201"/.test(tr.text) && eq(taken, ['CM102']) && au.json.unmatchedCourses.length === 0, `courses with a status: ${taken.join(', ')}`);
  };
  await read8('before');
  const r7 = await saveTranscript(s7.token, [row('CS201', 'graded', 9.0, '2024-1')]);
  note(`the other account saved CS201 9.0: ${r7.status}`);
  await read8('after');
}

// ---------------------------------------------------------------- TC-B1-PLAN-01 (API cases)
if (want('PLAN-01') || want('ACAD-01e-plans')) {
  const s1 = await account('ms1');
  const s2 = await account('ms2');
  await onboard(s1.token);
  await onboard(s2.token);
  const place = (token, id, terms) => call('PUT', `/plans/${id}/placements`, { token, body: { terms } });
  const T = (year, number, codes) => ({ term: { year, number }, placements: codes.map((courseCode) => ({ kind: 'course', courseCode })) });
  const shape = (p) => (p.terms ?? []).map((t) => `${t.term.year}-${t.term.number}: ${t.placements.map((x) => x.courseCode ?? x.kind).join(',')}`).join(' | ') || '(no placements)';

  if (want('PLAN-01')) {
    begin('PLAN-01a');
    const before = (await call('GET', '/plans', { token: s1.token })).json.plans;
    note(`S1 plans before: ${before.map((p) => p.name).join(', ') || 'none'}`);
    const p1 = await call('POST', '/plans', { token: s1.token, body: { name: 'Standard 4-Year', programCode: 'APCS', cohortYear: 2024 } });
    const p2 = await call('POST', '/plans', { token: s1.token, body: { name: 'Fast Track', programCode: 'APCS', cohortYear: 2024 } });
    check('both POSTs answer 201 with an id', p1.status === 201 && p2.status === 201 && !!p1.json.id && !!p2.json.id, `${p1.status}, ${p2.status}`);
    const s2plan = await call('POST', '/plans', { token: s2.token, body: { name: 'S2 Other Plan', programCode: 'APCS', cohortYear: 2024 } });
    const list = (await call('GET', '/plans', { token: s1.token })).json.plans;
    const mine = list.filter((p) => [p1.json.id, p2.json.id].includes(p.id));
    check('the list holds both, each with id, name and curriculum.code APCS2024', mine.length === 2 && mine.every((p) => p.curriculum.code === 'APCS2024') && eq(mine.map((p) => p.name).sort(), ['Fast Track', 'Standard 4-Year']), list.map((p) => `${p.name} [${p.curriculum.code}]`));
    check('nothing of S2’s in S1’s list', s2plan.status === 201 && !list.some((p) => p.id === s2plan.json.id || p.name === 'S2 Other Plan'), `S2 made "S2 Other Plan" (${s2plan.status}); S1 lists ${list.length} plans`);

    begin('PLAN-01b (API part)');
    const id = p1.json.id;
    let r = await place(s1.token, id, [T(2024, 1, ['CS160']), T(2024, 2, ['CS163'])]);
    let p = (await call('GET', `/plans/${id}`, { token: s1.token })).json;
    check('first PUT 200; read has CS160 in 2024-1 and CS163 in 2024-2, terms as {year, number}', r.status === 200 && shape(p) === '2024-1: CS160 | 2024-2: CS163' && eq(Object.keys(p.terms[0].term).sort(), ['number', 'year']), `${r.status}; ${shape(p)}`);
    r = await place(s1.token, id, [T(2024, 2, ['CS163'])]);
    p = (await call('GET', `/plans/${id}`, { token: s1.token })).json;
    check('after PUT of only 2024-2: terms holds only 2024-2 with CS163', r.status === 200 && shape(p) === '2024-2: CS163', `${r.status}; ${shape(p)}`);
    r = await place(s1.token, id, [{ term: { year: 2024, number: 1 }, placements: [] }]);
    p = (await call('GET', `/plans/${id}`, { token: s1.token })).json;
    check('PUT with an empty 2024-1 term is refused with 400; the plan still shows only CS163 in 2024-2', r.status === 400 && shape(p) === '2024-2: CS163', `${r.status} ${JSON.stringify(r.json?.message)}; ${shape(p)}`);
    const fast = (await call('GET', `/plans/${p2.json.id}`, { token: s1.token })).json;
    check('"Fast Track" still has no placements', (fast.terms ?? []).length === 0, shape(fast));

    begin('PLAN-01d');
    const beforeS2 = (await call('GET', `/plans/${id}`, { token: s1.token })).text;
    const drop = { terms: [], placement: { kind: 'course', courseCode: 'CS160' }, targets: [{ year: 2026, number: 1 }] };
    const calls = [
      ['GET', `/plans/${id}`], ['PATCH', `/plans/${id}`, { name: 'x' }], ['PUT', `/plans/${id}/placements`, { terms: [] }],
      ['POST', `/plans/${id}/duplicate`], ['GET', `/plans/${id}/issues`], ['POST', `/plans/${id}/issues`, { terms: [] }],
      ['POST', `/plans/${id}/issues/drops`, drop], ['DELETE', `/plans/${id}`],
    ];
    const ghost = randomUUID();
    for (const [method, path, body] of calls) {
      const theirs = await call(method, path, { token: s2.token, body });
      const unknown = await call(method, path.replace(id, ghost), { token: s2.token, body });
      check(`S2 ${method} ${path.replace(id, '<S1 plan>')}: 404, the same as for an unknown id`, theirs.status === 404 && unknown.status === 404 && theirs.text === unknown.text, `${theirs.status} ${theirs.text} | unknown id: ${unknown.status}`);
    }
    const afterS2 = (await call('GET', `/plans/${id}`, { token: s1.token })).text;
    check('read as S1, the plan is unchanged', beforeS2 === afterS2, shape(JSON.parse(afterS2)));
    const s2list = (await call('GET', '/plans', { token: s2.token })).json.plans;
    check('S2 got no copy from the duplicate call', !s2list.some((x) => /Standard 4-Year/.test(x.name)), s2list.map((x) => x.name));

    begin('PLAN-01f');
    const s9 = await account('m09');
    await onboard(s9.token);
    const p9 = await call('POST', '/plans', { token: s9.token, body: { name: 'Standard 4-Year', programCode: 'APCS', cohortYear: 2024 } });
    r = await place(s9.token, p9.json.id, [T(2024, 1, ['CS160'])]);
    const ex = await call('GET', '/users/me/export', { token: s9.token });
    const plans = ex.json.tables.plans ?? [];
    const placements = ex.json.tables.plan_placements ?? [];
    check('export 200; tables.plans holds the plan with the account’s user_id', ex.status === 200 && plans.length === 1 && plans[0].id === p9.json.id && plans[0].user_id === s9.id, `${ex.status}; plans: ${plans.length}; user_id is the account's: ${plans[0]?.user_id === s9.id}`);
    check('tables.plan_placements holds its placement with the account’s user_id', placements.length === 1 && placements[0].user_id === s9.id && JSON.stringify(placements[0]).includes('CS160'), `placements: ${placements.length}; keys: ${Object.keys(placements[0] ?? {}).join(', ')}`);
    note(`export tables: ${Object.entries(ex.json.tables).map(([k, v]) => `${k} (${v.length})`).join(', ')}`);
  }

  begin('ACAD-01e (plans part, API)');
  const cap = await call('POST', '/plans', { token: s2.token, body: { name: 'Caps 01e', programCode: 'APCS', cohortYear: 2024 } });
  const capLoads = [
    [9, ['CS160', 'BAA00101', 'BAA00102'], 'load_below_minimum', 10],
    [10, ['CS160', 'CS163', 'BAA00102'], null],
    [22, ['CS160', 'CS163', 'CS201', 'CS202', 'CS250', 'BAA00102'], null],
    [23, ['CS160', 'CS163', 'CS201', 'CS202', 'BAA00101', 'BAA00102', 'BAA00103'], 'load_above_maximum', 22],
  ];
  for (const [credits, codes, code, limit] of capLoads) {
    const put = await place(s2.token, cap.json.id, [T(2024, 1, codes)]);
    const iss = (await call('GET', `/plans/${cap.json.id}/issues`, { token: s2.token })).json;
    const t = iss.terms.find((x) => x.term.year === 2024 && x.term.number === 1);
    const load = iss.issues.filter((i) => i.code.startsWith('load_'));
    check(`${credits} credits: PUT 200, term caps 10–22, credits ${credits}`, put.status === 200 && eq(t.caps, { min: 10, max: 22 }) && t.credits === credits, { put: put.status, caps: t.caps, credits: t.credits, kind: t.kind });
    if (code) check(`${credits} credits: one ${code}, kind flag, credits ${credits}, limit ${limit}, citation Điều 7.2`, load.length === 1 && load[0].code === code && load[0].kind === 'flag' && load[0].credits === credits && load[0].limit === limit && load[0].citation === 'QĐ 1175/QĐ-KHTN Điều 7.2', load.map((i) => pick(i, ['code', 'kind', 'credits', 'limit', 'citation'])));
    else check(`${credits} credits: no load issue`, load.length === 0, load.map((i) => i.code));
    note(`${credits} credits: issue codes: ${Object.entries(iss.issues.reduce((m, i) => ({ ...m, [`${i.code}/${i.kind}`]: (m[`${i.code}/${i.kind}`] ?? 0) + 1 }), {})).map(([k, v]) => `${k} x${v}`).join(', ')}`);
  }
}

log(`API under test: ${API}`);
summary();
