// TC-B2-PLAN-02a–c on staging (docs/test/test-cases-b2.md §3): the "browser B" side, as P.
// Only Chrome could be driven for this run, so this script stands in for Edge: it is a second client with its own session.
// Node 22, no dependencies. Prints statuses, session ids and user agents, and plan bodies; never a token.
//   node docs/test/evidence/b2/a-plan-02abc.mjs revoke <planId>   sign in as P, list P's sessions, revoke the newest Chrome session
//   node docs/test/evidence/b2/a-plan-02abc.mjs get <planId>      sign in as P and read the plan: which courses it holds
const API = 'https://stag-omnicourses.lamter.cc/api';
const call = async (method, path, token) => {
  const res = await fetch(API + path, { method, headers: { Authorization: `Bearer ${token}` } });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, body };
};

const [what, planId] = process.argv.slice(2);
console.log(`PLAN-02 ${what} run at ${new Date().toISOString()}`);
const res = await fetch(`${API}/auth/sign-in`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'b2-s5@example.com', password: 'correct horse battery' }) });
console.log(`POST /auth/sign-in (b2-s5, as browser B) → ${res.status}`);
const token = (await res.json()).token;

if (what === 'revoke') {
  const list = await call('GET', '/auth/sessions', token);
  console.log(`GET /auth/sessions → ${list.status}`);
  for (const s of list.body) console.log(`  ${s.id} ${s.current ? '(this client)' : ''} created ${s.createdAt} ${s.userAgent}`);
  const chrome = list.body.filter((s) => !s.current && /Chrome\//.test(s.userAgent ?? '')).sort((x, y) => y.createdAt.localeCompare(x.createdAt))[0];
  if (!chrome) throw new Error('No Chrome session of P to revoke');
  const del = await call('DELETE', `/auth/sessions/${chrome.id}`, token);
  console.log(`DELETE /auth/sessions/${chrome.id} (Chrome, browser A) → ${del.status} ${JSON.stringify(del.body)}`);
}
const plan = await call('GET', `/plans/${planId}`, token);
const courses = (plan.body.terms ?? []).flatMap((t) => t.placements.map((p) => `${t.term.year}/${t.term.number} ${p.courseCode ?? `slot ${p.requirementGroupId}`}`));
console.log(`GET /plans/${planId} → ${plan.status} updatedAt ${plan.body.updatedAt} placements: ${courses.join(', ') || 'none'}`);
