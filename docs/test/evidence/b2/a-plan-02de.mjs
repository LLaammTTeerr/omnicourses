// TC-B2-PLAN-02d and e on staging (docs/test/test-cases-b2.md §3): crafted plan ids and crafted boards.
// Node 22, no dependencies. Prints statuses and bodies, never a token. Checks each expected result (OK / MISMATCH).
//   node docs/test/evidence/b2/a-plan-02de.mjs d          B creates "B plan"; A calls every plan route with B's id and an unknown id.
//   node docs/test/evidence/b2/a-plan-02de.mjs e <B id>   A's crafted boards against P1, and one as a new plan.
// A = b2-s3, B = b2-s4 (§1). The screen step of d (A opens /plans/<B id>) is done in the browser between the two runs.
import { isDeepStrictEqual } from 'node:util';

const API = 'https://stag-omnicourses.lamter.cc/api';
const PASSWORD = 'correct horse battery';
const UNKNOWN = '00000000-0000-4000-8000-000000000000';
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
  return (await res.json()).token;
};
const planBody = (name, courseCode) => ({ name, programCode: 'APCS', cohortYear: 2024, terms: [{ term: { year: 2026, number: 2 }, placements: [{ kind: 'course', courseCode }] }] });
const board = (...placements) => ({ terms: [{ term: { year: 2026, number: 2 }, placements }] });
const messageHas = (res, text) => JSON.stringify(res.body?.message ?? '').includes(text);

const [which, bId] = process.argv.slice(2);
console.log(`PLAN-02${which} run at ${new Date().toISOString()}`);
const a = await signIn('b2-s3@example.com');
const b = await signIn('b2-s4@example.com');

if (which === 'd') {
  const created = await call('POST', '/plans', b, planBody('B plan', 'CS163'));
  check('B creates its plan (201)', created.status === 201);
  const id = created.body.id;
  const b0 = (await call('GET', `/plans/${id}`, b, undefined, { quiet: true })).body;
  console.log(`  B's plan id ${id}; B0 updatedAt ${b0.updatedAt}`);
  const routes = [
    ['GET', (x) => `/plans/${x}`, undefined],
    ['GET', (x) => `/plans/${x}/issues`, undefined],
    ['POST', (x) => `/plans/${x}/issues`, { terms: [] }],
    ['POST', (x) => `/plans/${x}/issues/drops`, { terms: [], placement: { kind: 'course', courseCode: 'CS160' }, targets: [{ year: 2026, number: 2 }] }],
    ['PATCH', (x) => `/plans/${x}`, { name: 'Mine now' }],
    ['PUT', (x) => `/plans/${x}/placements`, { terms: [] }],
    ['POST', (x) => `/plans/${x}/duplicate`, {}],
    ['DELETE', (x) => `/plans/${x}`, undefined],
  ];
  for (const [method, path, body] of routes) {
    const theirs = await call(method, path(id), a, body);
    const unknown = await call(method, path(UNKNOWN), a, body);
    check(`${method} ${path('{id}')}: 404 "No plan with this id" for B's id, the same as for the unknown id`,
      theirs.status === 404 && messageHas(theirs, 'No plan with this id') && isDeepStrictEqual(theirs.body, unknown.body) && theirs.status === unknown.status);
  }
  const list = await call('GET', '/plans', a);
  check("A's list holds no plan of B's and no copy of it", !(list.body.plans ?? []).some((p) => p.id === id || p.name === 'B plan' || p.name === 'Mine now'));
  const after = await call('GET', `/plans/${id}`, b, undefined, { quiet: true });
  check("B's plan equals B0, updatedAt included", isDeepStrictEqual(after.body, b0));
} else if (which === 'e') {
  if (!bId) throw new Error("Pass B's plan id from the d run");
  const TA = { rows: [
    { courseCode: 'CS160', courseName: 'Nhập môn Tin học', credits: 4, result: 'graded', grade: 8.5, term: { year: 2024, number: 1 } },
    { courseCode: 'CM102', courseName: 'Tư duy độc lập', credits: 4, result: 'graded', grade: 7.5, term: { year: 2024, number: 1 } },
    { courseCode: 'MTH251', courseName: 'Vi tích phân I', credits: 4, result: 'graded', grade: 7.0, term: { year: 2024, number: 1 } },
  ] };
  check('A saves T-A (200)', (await call('PUT', '/users/me/transcript', a, TA, { quiet: true })).status === 200);
  const p1 = (await call('POST', '/plans', a, planBody('A plan 1', 'CS160'), { quiet: true })).body.id;
  const p2 = (await call('POST', '/plans', a, planBody('A plan 2', 'CS163'), { quiet: true })).body.id;
  console.log(`  P1 ${p1}, P2 ${p2}`);
  const snapshot = async () => ({
    p1: (await call('GET', `/plans/${p1}`, a, undefined, { quiet: true })).body,
    p2: (await call('GET', `/plans/${p2}`, a, undefined, { quiet: true })).body,
    bPlan: (await call('GET', `/plans/${bId}`, b, undefined, { quiet: true })).body,
    transcript: (await call('GET', '/users/me/transcript', a, undefined, { quiet: true })).body,
    list: (await call('GET', '/plans', a, undefined, { quiet: true })).body,
  });
  const before = await snapshot();
  console.log(`  A's plans before: ${before.list.plans.map((p) => p.name).join(', ')}`);
  const apcs25 = await call('GET', '/programs/APCS/curricula/2025', a, undefined, { quiet: true });
  const g25 = apcs25.body.requirementGroups[0].id;
  console.log(`  G25 = ${g25} (${apcs25.body.requirementGroups[0].name}, ${apcs25.body.code})`);
  const crafted = [
    ['Unknown code', [{ kind: 'course', courseCode: 'ZZ999' }], 'No course in the catalog has the code ZZ999'],
    ['Malformed code', [{ kind: 'course', courseCode: "CS160' OR '1'='1" }], 'terms.0.placements.0.courseCode must be 2–20 capital letters or digits'],
    ["Another curriculum's group", [{ kind: 'slot', requirementGroupId: g25, credits: 4 }], `Requirement group ${g25} is not in the plan's curriculum`],
    ['Unknown group', [{ kind: 'slot', requirementGroupId: UNKNOWN, credits: 4 }], `Requirement group ${UNKNOWN} is not in the plan's curriculum`],
    ['The same course twice', [{ kind: 'course', courseCode: 'CS160' }, { kind: 'course', courseCode: 'CS160' }], 'course CS160 is placed twice'],
  ];
  for (const [label, placements, message] of crafted) {
    const res = await call('PUT', `/plans/${p1}/placements`, a, board(...placements));
    check(`${label}: 400 with "${message}"`, res.status === 400 && messageHas(res, message));
  }
  const post = await call('POST', '/plans', a, { name: 'Crafted', programCode: 'APCS', cohortYear: 2024, ...board(...crafted[0][1]) });
  check('POST of the first crafted board as a new plan: 400', post.status === 400);
  const after = await snapshot();
  console.log(`  A's plans after: ${after.list.plans.map((p) => p.name).join(', ')}`);
  check('A still has exactly P1 and P2 (no "Crafted")', isDeepStrictEqual(after.list.plans.map((p) => p.id).sort(), [p1, p2].sort()));
  check('P1 unchanged, updatedAt included', isDeepStrictEqual(after.p1, before.p1));
  check('P2 unchanged, updatedAt included', isDeepStrictEqual(after.p2, before.p2));
  check("B's plan unchanged", isDeepStrictEqual(after.bPlan, before.bPlan));
  check("A's transcript unchanged", isDeepStrictEqual(after.transcript, before.transcript));
} else {
  console.log('Use d or e.');
  process.exit(2);
}
console.log(`\nDone: ${mismatches} mismatch(es).`);
