// TC-B2-ADM-02h on staging (docs/test/test-cases-b2.md §6): the last active access manager cannot remove its own grant.
// Node 22, no dependencies: node docs/test/evidence/b2/a-adm-02h.mjs. Prints statuses and bodies, never a token.
import { isDeepStrictEqual } from 'node:util';

const API = 'https://stag-omnicourses.lamter.cc/api';
const call = async (method, path, token) => {
  const res = await fetch(API + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  console.log(`${method} ${path} → ${res.status} ${JSON.stringify(body)}`);
  return { status: res.status, body };
};
let mismatches = 0;
const check = (label, ok) => {
  if (!ok) mismatches++;
  console.log(`  ${ok ? 'OK' : 'MISMATCH'}  ${label}`);
};

console.log(`Run at ${new Date().toISOString()}`);
const signIn = await fetch(`${API}/auth/sign-in`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'b2-a4@example.com', password: 'correct horse battery' }),
});
const a4 = (await signIn.json()).token;
const id = (await (await fetch(`${API}/users/me`, { headers: { Authorization: `Bearer ${a4}` } })).json()).id;

const before = await call('GET', `/admin/access/users/${id}/grants`, a4);
check('A4 holds access_manager before', before.body.permissions?.some((p) => p.permission === 'access_manager'));
const refused = await call('DELETE', `/admin/access/users/${id}/global/access_manager`, a4);
check('DELETE 409 last_access_manager', refused.status === 409 && refused.body.code === 'last_access_manager');
if (refused.status === 200) console.log('  !! A4 lost access_manager: staging has no access manager. Lâm must run admin:bootstrap again (zero-manager recovery).');
const after = await call('GET', `/admin/access/users/${id}/grants`, a4);
check('grants unchanged', isDeepStrictEqual(after.body, before.body));
const still = await call('GET', '/admin/access/programs', a4);
check('A4 still does access-manager work (200)', still.status === 200);

console.log(`\nDone: ${mismatches} mismatch(es).`);
