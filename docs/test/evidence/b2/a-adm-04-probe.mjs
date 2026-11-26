// A probe for TC-B2-ADM-04c, run before the case was written (docs/test/test-cases-b2.md §6): does deleting an
// empty requirement group that a saved plan's slot names answer 409 referenced_item, as ADR 0011 asks?
//   node docs/test/evidence/b2/a-adm-04-probe.mjs
// Node, no dependencies. Never prints a token. Leaves staging as it found it: the plan and the group are removed.
const API = 'https://stag-omnicourses.lamter.cc/api';
const PASSWORD = 'correct horse battery';
const call = async (method, path, token, body) => {
  const res = await fetch(API + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  console.log(`${method} ${path} → ${res.status}${text ? ` ${text.slice(0, 400)}` : ''}`);
  try { return { status: res.status, body: JSON.parse(text) }; } catch { return { status: res.status, body: text }; }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const signIn = async (email) => {
  await sleep(7000); // sign-in: 10 a minute from one address (ADR 0002)
  const r = await call('POST', '/auth/sign-in', null, { email, password: PASSWORD });
  if (r.status !== 200) process.exit(2);
  return r.body.token;
};
// Every answer is printed (its first 400 characters), the sign-in answer too; the token in it is replaced by "…" below.
console.log(`ADM-04 probe at ${new Date().toISOString()}`);
const quiet = console.log;
console.log = (line) => quiet(String(line).replace(/"token":"[^"]+"/g, '"token":"…"'));
const a1 = await signIn('b2-a1@example.com');
const s6 = await signIn('b2-s6@example.com');
const apcs = (await call('GET', '/admin/programs', a1)).body.programs.find((p) => p.code === 'APCS');
const apcs24 = apcs.curricula.find((c) => c.cohortYear === 2024).id;
const groups = `/admin/programs/${apcs.id}/cohorts/${apcs24}/requirement-groups`;
const tg = await call('POST', groups, a1, { name: 'Nhóm thử ADM-04 (dò)', kind: 'elective' });
let plan;
try {
  plan = await call('POST', '/plans', s6, { name: 'ADM-04 probe', programCode: 'APCS', cohortYear: 2024, terms: [{ term: { year: 2026, number: 2 }, placements: [{ kind: 'slot', requirementGroupId: tg.body.id, credits: 4 }] }] });
  const del = await call('DELETE', `${groups}/${tg.body.id}`, a1);
  const after = (await call('GET', '/programs/APCS/curricula/2024', a1)).body.requirementGroups.some((g) => g.id === tg.body.id);
  const planAfter = await call('GET', `/plans/${plan.body.id}`, s6);
  quiet(`RESULT: group DELETE answered ${del.status}; the group ${after ? 'is still there' : 'is gone'}; the plan answers ${planAfter.status}`);
} finally {
  if (plan?.body?.id) await call('DELETE', `/plans/${plan.body.id}`, s6);
  if (tg.body?.id) await call('DELETE', `${groups}/${tg.body.id}`, a1);
  const left = (await call('GET', '/programs/APCS/curricula/2024', a1)).body.requirementGroups.filter((g) => g.name.startsWith('Nhóm thử ADM-04'));
  const plans = (await call('GET', '/plans', s6)).body;
  quiet(`CLEAN-UP: test groups left ${left.length}; S6 plans ${JSON.stringify((plans.plans ?? plans).map?.((p) => p.name) ?? plans)}`);
}
