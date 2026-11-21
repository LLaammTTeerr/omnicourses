// TC-B2-ADM-02a and b on staging (docs/test/test-cases-b2.md §6), with the pre-run grant check.
// Node 22, no dependencies: node docs/test/evidence/b2/a-adm-02ab.mjs. Prints statuses and bodies, never a token.
const API = 'https://stag-omnicourses.lamter.cc/api';
const PASSWORD = 'correct horse battery';
const APCS = 'd3f524f8-e51b-42dd-91ac-013b15d5e033';

const call = async (method, path, { token, body } = {}) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(API + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, body: json };
};
const signIn = async (name) => (await call('POST', '/auth/sign-in', { body: { email: `b2-${name}@example.com`, password: PASSWORD } })).body.token;
const show = (label, r) => console.log(`${label} → ${r.status} ${JSON.stringify(r.body)}`);

console.log(`Run at ${new Date().toISOString()}`);
const t = Object.fromEntries(await Promise.all(['a1', 'a2', 'a3', 'a4', 's1'].map(async (n) => [n, await signIn(n)])));
const ids = {};
for (const n of Object.keys(t)) ids[n] = (await call('GET', '/users/me', { token: t[n] })).body.id;
console.log('User IDs:', JSON.stringify(ids));

console.log('\n== Pre-run: grants, as A4 ==');
for (const n of Object.keys(t)) show(`GET /admin/access/users/{${n}}/grants`, await call('GET', `/admin/access/users/${ids[n]}/grants`, { token: t.a4 }));

const apcs24 = (await call('GET', '/programs/APCS/curricula/2024', { token: t.s1 })).body.id;
console.log(`{APCS24} = ${apcs24} (GET /programs/APCS/curricula/2024)`);
const adminList = await call('GET', '/admin/programs', { token: t.a1 });
show('A1 GET /admin/programs', adminList);

const W = { method: 'PUT', path: `/admin/programs/${APCS}/cohorts/${apcs24}/courses/CS420/offering-terms`, body: { terms: [1, 2] } };
const C = { method: 'POST', path: '/admin/catalog/courses', body: { code: 'ZZADM02', nameVi: 'Học phần thử ADM-02', credits: 3 } };
const G = { method: 'PUT', path: `/admin/access/users/${ids.s1}/programs/${APCS}` };
const send = (name, w, token) => call(w.method, w.path, { token, body: w.body }).then((r) => (show(`${name} ${w.method} ${w.path}`, r), r));

const R = async () => {
  const cur = await call('GET', '/programs/APCS/curricula/2024', { token: t.s1 });
  const cs420 = cur.body.requirementGroups.flatMap((g) => g.courses).find((c) => c.code === 'CS420');
  console.log(`R1 GET /programs/APCS/curricula/2024 → ${cur.status}; CS420 offeringTerms = ${JSON.stringify(cs420?.offeringTerms)}`);
  show('R2 GET /courses/ZZADM02', await call('GET', '/courses/ZZADM02', { token: t.s1 }));
  show('R3 S1 GET /admin/programs', await call('GET', '/admin/programs', { token: t.s1 }));
};

console.log('\n== R before the run ==');
await R();

console.log('\n== TC-B2-ADM-02a: signed out ==');
for (const [n, w] of [['W', W], ['C', C], ['G', G]]) await send(n, w);
await R();

console.log('\n== TC-B2-ADM-02b: S1, no role ==');
show('S1 GET /admin/programs', await call('GET', '/admin/programs', { token: t.s1 }));
for (const [n, w] of [['W', W], ['C', C], ['G', G]]) await send(n, w, t.s1);
await R();
