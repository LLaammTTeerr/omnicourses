// Retest of TC-B2-PLAN-02a (#137) and PLAN-02c (#138) on staging (docs/test/test-cases-b2.md §3). Synthetic b2- accounts only.
//   node a-plan-02-retest.mjs
// P (b2-s5) in two headless Chrome contexts, A and B, at 1280 × 900 in English (no Edge on the test machine). Never prints a token.
import { BASE, PASSWORD, launch, newPage, signIn, settle, where, mark, sent, fmt, toasts, clearToasts, pageToken, shot, sleep } from './b-lib.mjs';
import { call, check, failureCount, log, signInApi } from './c-lib.mjs';

const P = 'b2-s5@example.com';
const ID = 'e3ab2633-ac3b-4938-b374-23cfb81d0bd3';
const chip = (page) => page.locator('[data-test="save-state"]').innerText({ timeout: 500 }).then((s) => s.trim()).catch(() => null);
const codes = (page) => page.locator('li[data-test^="tile-"]').evaluateAll((l) => l.map((e) => e.dataset.test.slice(5)).filter((c) => !/^(group|taken|issue-)/.test(c)));
const show = (j) => JSON.stringify(j.terms?.map((t) => [`${t.term.year}-${t.term.number}`, t.placements.map((p) => p.courseCode)]));
async function addCS163(page) {
  await page.fill('#course-search', 'CS163');
  await sleep(200);
  await page.locator('[data-test="add-CS163"]').click();
}
async function idle(page) {
  await sleep(400);
  for (let i = 0; i < 80; i++) { if ((await chip(page)) === 'Saved' && (await page.locator('[data-test="issues-panel"]').getAttribute('aria-busy', { timeout: 500 }).catch(() => null)) === 'false') return; await sleep(100); }
}
/** Signs in on the sign-in page the app has opened, keeping its ?redirect=. */
async function signInHere(page, email) {
  await page.fill('#sign-in-email', email);
  await page.fill('#sign-in-password', PASSWORD);
  const [res] = await Promise.all([page.waitForResponse((r) => r.url().endsWith('/api/auth/sign-in')), page.click('button[type=submit]')]);
  console.log(`  UI sign-in on ${where(page)} → ${res.status()}`);
  await settle(page, 1000);
}
log('a-plan-02-retest');

console.log('--- before: P\'s plan reset to CS160 only (the 22 November run of PLAN-02c left CS160 and CS163)');
const reset = (await signInApi(P)).token;
await call('GET', `/plans/${ID}`, { token: reset, show });
await call('PUT', `/plans/${ID}/placements`, { token: reset, show, body: { terms: [{ term: { year: 2026, number: 1 }, placements: [{ kind: 'course', courseCode: 'CS160' }] }] } });

const browser = await launch();
const A = await newPage(browser, { lang: 'en', height: 900 });
const B = await newPage(browser, { lang: 'en', height: 900 });

console.log('--- PLAN-02a (#137)');
await signIn(A, P);
await A.goto(`${BASE}/plans/${ID}`, { waitUntil: 'networkidle' });
await idle(A);
console.log(`  A: ${where(A)}, chip ${await chip(A)}, board ${JSON.stringify(await codes(A))}`);
await signIn(B, P);
await B.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
await settle(B, 800);
const rows = await B.locator('[data-test="sessions"] tbody tr').evaluateAll((l) => l.map((r) => r.innerText.replace(/\s+/g, ' ').trim()));
console.log(`  B: Settings → Devices signed in: ${JSON.stringify(rows)}`);
await B.locator('[data-test="sessions"] tbody tr').nth(1).locator('button').click();
await sleep(300);
const dialog = (await B.locator('dialog[open][role="alertdialog"]').innerText()).replace(/\s+/g, ' ');
await B.locator('dialog[open][role="alertdialog"] button').last().click();
await settle(B, 600);
console.log(`  B: revoke dialog "${dialog}" confirmed; toasts ${JSON.stringify(await toasts(B))}; rows now ${await B.locator('[data-test="sessions"] tbody tr').count()}`);
const m = mark(A);
await clearToasts(A);
await addCS163(A);
const seen = [];
const t0 = Date.now();
while (Date.now() - t0 < 4000) { const c = await chip(A); seen.push(c ?? `(no chip) ${where(A)}`); await sleep(50); }
const states = [...new Set(seen)];
const ta = await toasts(A);
await shot(A, 'a-plan-02a-retest-after-401.png');
console.log(`  A: requests ${fmt(sent(A, m))}; states ${JSON.stringify(states)}; toasts ${JSON.stringify(ta)}; now at ${where(A)}`);
check('PLAN-02a', 'the 401 save never shows "Saved" for the CS163 change, and A says that the change was not saved',
  sent(A, m).some((r) => r.method === 'PUT' && r.status === 401) && !states.includes('Saved') && ta.some((t) => /not saved/i.test(t)), { states, toasts: ta });
await sleep(7000);
await signInHere(A, P);
await idle(A);
const back = where(A), boardA = await codes(A);
console.log(`  A after signing in again: ${back}, board ${JSON.stringify(boardA)}`);
const apiB = await call('GET', `/plans/${ID}`, { token: await pageToken(B), show });
check('PLAN-02a', 'after signing in, A is back on the plan with CS160 and not CS163; B\'s GET /api/plans/{id} holds CS160 only',
  back === `/plans/${ID}` && JSON.stringify(boardA) === '["CS160"]' && show(apiB.json) === '[["2026-1",["CS160"]]]', { back, boardA });

console.log('--- PLAN-02c (#138)');
await A.reload({ waitUntil: 'networkidle' });
await idle(A);
console.log(`  A: chip ${await chip(A)}, board ${JSON.stringify(await codes(A))}`);
await A.evaluate(() => {
  const realFetch = window.fetch.bind(window);
  window.fetch = (url, init = {}) => {
    if (init.method === 'PUT' && String(url).endsWith('/placements')) {
      realFetch(url, { ...init, signal: undefined });
      return new Promise((_, reject) => init.signal?.addEventListener('abort', () => reject(init.signal.reason)));
    }
    return realFetch(url, init);
  };
});
const m2 = mark(A);
await clearToasts(A);
await addCS163(A);
const seq = [];
const t1 = Date.now();
while (Date.now() - t1 < 40000) {
  const c = await chip(A);
  if (seq.at(-1)?.chip !== c) seq.push({ t: Date.now() - t1, chip: c });
  await sleep(100);
}
const reqs = sent(A, m2).map((r) => ({ ...r, t: r.at - t1 }));
const boardC = await codes(A);
const errC = await A.locator('[data-test="save-error"]').count();
console.log(`  chip ${JSON.stringify(seq)}`);
console.log(`  requests ${reqs.map((r) => `${r.method} ${r.path} ${r.status ?? ''} @${r.t}ms`).join('; ')}`);
console.log(`  board ${JSON.stringify(boardC)}; save-error ${errC}; toasts ${JSON.stringify(await toasts(A))}`);
const iPut = reqs.findIndex((r) => r.method === 'PUT');
const reread = reqs.slice(iPut + 1).find((r) => r.method === 'GET' && r.path === `/api/plans/${ID}`);
const firstOther = seq.find((s) => s.chip !== 'Saving…');
check('PLAN-02c', 'chip "Saving…" until the outcome is known, never "Not saved"; a GET /api/plans/{id} follows the failed PUT before the chip changes; the board shows CS160 and CS163',
  seq[0]?.chip === 'Saving…' && !seq.some((s) => s.chip === 'Not saved') && !!reread && firstOther?.chip === 'Saved' && reread.t <= firstOther.t + 200 && JSON.stringify(boardC) === '["CS160","CS163"]' && errC === 0, { reread: reread && `${reread.t} ms`, firstOther });
await A.reload({ waitUntil: 'networkidle' });
await idle(A);
const boardR = await codes(A);
const apiC = await call('GET', `/plans/${ID}`, { token: await pageToken(B), show });
check('PLAN-02c', 'after the reload the board and the API both hold CS160 and CS163', JSON.stringify(boardR) === '["CS160","CS163"]' && show(apiC.json) === '[["2026-1",["CS160","CS163"]]]', boardR);
await browser.close();
log(failureCount() ? `${failureCount()} FAIL(S)` : 'All checks ok');
