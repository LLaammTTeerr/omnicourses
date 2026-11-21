// Deletes every synthetic account the B1 run created on staging, through the app's own account
// deletion (DELETE /api/users/me with the password, ADR 0004). Run last: signing in to a deleted
// account restores it. Sign-in and deletion each accept 10 requests a minute, so one account
// every 7 seconds. It also records the 202 and the purge date of each deletion.
// Usage: API=<…/api> LEDGER=<file with one email per line> node cleanup.mjs
import { readFileSync } from 'node:fs';

const API = process.env.API ?? 'https://stag-omnicourses.lamter.cc/api';
const PW = 'correct horse battery';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const post = (method, path, body, token) =>
  fetch(API + path, {
    method,
    headers: { 'content-type': 'application/json', 'user-agent': 'B1 acceptance run (Node 22 fetch)', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });

const emails = [...new Set(readFileSync(process.env.LEDGER, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean))];
if (emails.some((e) => !/^b1-run-[0-9a-f]{6}-[a-z0-9]+@example\.com$/.test(e))) throw new Error('The ledger holds an address this run did not make');
console.log(`${new Date().toISOString()} ${emails.length} accounts to delete on ${API}`);
let deleted = 0;
for (const email of emails) {
  let line = email;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const signIn = await post('POST', '/auth/sign-in', { email, password: PW });
    if (signIn.status === 429) { await sleep(65_000); continue; }
    if (signIn.status !== 200) { line += ` sign-in ${signIn.status}: NOT DELETED`; break; }
    const { token, accountRestored } = await signIn.json();
    const del = await post('DELETE', '/users/me', { password: PW }, token);
    if (del.status === 429) { await sleep(65_000); continue; }
    const body = await del.json().catch(() => ({}));
    const after = await fetch(API + '/users/me', { headers: { authorization: `Bearer ${token}` } });
    line += ` delete ${del.status} purgeAfter ${body.purgeAfter ?? '-'}${accountRestored ? ' (was already deleted once; the sign-in restored it)' : ''}; the same token afterwards: ${after.status}`;
    if (del.status === 202) deleted++;
    break;
  }
  console.log(line);
  await sleep(7_000);
}
console.log(`${new Date().toISOString()} deleted ${deleted} of ${emails.length}`);
