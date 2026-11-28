// PLAN-01c(2) follow-up: after a keyboard move that breaks CS470's prerequisite, a keyboard move back; are the issues refreshed?
import { BASE, launch, newPage, signIn, settle, sleep, mark, sent, fmt, pageToken } from './b-lib.mjs';
import { call, log } from './c-lib.mjs';
const id = 'a1e740c8-7b68-4766-85ad-7f6c7231b528';
const browser = await launch();
const page = await newPage(browser, { lang: 'en', height: 900 });
await signIn(page, 'b2-s15@example.com');
await page.goto(`${BASE}/plans/${id}`, { waitUntil: 'networkidle' });
await settle(page, 1500);
const state = async (label) => {
  const live = await page.locator('[data-test="issue-violation"]').allTextContents();
  const counts = (await page.locator('[data-test="issue-counts"]').innerText()).replace(/\s+/g, ' ');
  const stale = await page.locator('[data-test="issue-counts"].stale').count();
  const chip = (await page.locator('[data-test="save-state"]').innerText()).trim();
  const rows = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('section.trow[data-test^="term-"]')].map((e) => [e.dataset.test.slice(5), [...e.querySelectorAll('li[data-test^="tile-"]')].map((t) => t.dataset.test.slice(5)).filter((c) => !/^(group|taken|issue-)/.test(c))])));
  log(`${label}: chip ${chip}; counts "${counts}" stale=${stale}; live violations ${JSON.stringify(live.map((t) => t.slice(0, 80)))}; rows ${JSON.stringify(rows)}`);
};
const lift = async (keys) => {
  await page.locator('[data-test="tile-CS469"]').focus();
  await page.keyboard.press('Space');
  await sleep(1200);
  for (const k of keys) { await page.keyboard.press(k); await sleep(300); }
  await sleep(800);
  await page.keyboard.press('Enter');
};
await state('start');
let m = mark(page);
await lift(['ArrowDown', 'ArrowDown']);
await sleep(3000);
log(`requests: ${fmt(sent(page, m))}`);
await state('after CS469 → 2026-3');
m = mark(page);
await lift(['ArrowUp', 'ArrowUp']);
for (const t of [500, 1500, 3000, 6000]) { await sleep(t === 500 ? 500 : t - [500, 1500, 3000, 6000][[500, 1500, 3000, 6000].indexOf(t) - 1]); await state(`${t} ms after CS469 → 2026-1`); }
log(`requests: ${fmt(sent(page, m))}`);
const api = await call('GET', `/plans/${id}/issues`, { token: await pageToken(page), show: (j) => JSON.stringify((j.issues ?? j.placementIssues ?? j).filter?.((i) => i.kind === 'violation') ?? Object.keys(j)) });
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 1500);
await state('after reload');
await browser.close();
