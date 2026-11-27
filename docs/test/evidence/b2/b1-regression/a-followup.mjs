// Follow-ups of track A: UI-01b (the signed-in page names the student), USER-01u as written (the S1 account of this
// run, with the Prepare data), and UI-01g last (11 wrong sign-ins in a minute: it uses up the sign-in limit).
import { readFileSync } from 'node:fs';
import { launch, newPage, BASE, RUN, email, screenSignIn, pageToken, api, check, log, shot, where, sleep } from './a-lib.mjs';

const browser = await launch();

// ---- UI-01b: "Test Student" on the signed-in page
let page = await newPage(browser);
const r1 = await screenSignIn(page, email('02'));
await page.waitForURL(/dashboard/, { timeout: 15000 }).catch(() => {});
await page.locator('[data-test="who"]').waitFor({ timeout: 15000 }).catch(() => {});
const places = await page.evaluate(() => [...document.querySelectorAll('body *')].filter((e) => e.children.length === 0 && e.textContent.includes('Test Student') && e.offsetParent !== null).map((e) => `${e.closest('aside, nav, header, main')?.tagName.toLowerCase() ?? '?'} .${e.className}`));
await shot(page, 'a-ui-01b-dashboard.png');
await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
const inSettings = await page.locator('[data-test="display-name"]').innerText().catch(() => null);
check('UI-01b', 'after a screen sign-in the signed-in page shows "Test Student"', r1.status() === 200 && (places.length > 0 || inSettings === 'Test Student'), { signIn: r1.status(), onDashboard: places, settingsDisplayName: inSettings });
await page.context().close();

// ---- USER-01u as written, on this run's S1
page = await newPage(browser);
const S1 = `b1-run-${RUN}-us1@example.com`;
const r2 = await screenSignIn(page, S1);
await page.waitForURL(/dashboard|onboarding/, { timeout: 15000 }).catch(() => {});
await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
const button = page.locator('#data .srow button').first();
const [download] = await Promise.all([page.waitForEvent('download'), button.click()]);
const saved = JSON.parse(readFileSync(await download.path(), 'utf8'));
const viaApi = (await api('GET', '/users/me/export', { token: await pageToken(page) })).json;
const count = (x) => Object.fromEntries(Object.entries(x.tables).map(([k, v]) => [k, v.length]));
check('USER-01u', `as ${S1}: "${(await button.innerText()).trim()}" saves a JSON file with the same tables and row counts as the API export taken right after`, r2.status() === 200 && JSON.stringify(count(saved)) === JSON.stringify(count(viaApi)) && saved.user.email === S1, { signIn: r2.status(), file: download.suggestedFilename(), fileTables: count(saved), apiTables: count(viaApi) });
await page.context().close();

// ---- UI-01g, last
page = await newPage(browser);
await page.goto(`${BASE}/sign-in`, { waitUntil: 'networkidle' });
const attempts = [];
const started = Date.now();
for (let i = 1; i <= 11; i++) {
  await page.fill('#sign-in-email', email('03'));
  await page.fill('#sign-in-password', 'not the password!');
  const [res] = await Promise.all([page.waitForResponse((r) => r.url().endsWith('/api/auth/sign-in')), page.click('button[type=submit]')]);
  await page.locator('button[type=submit]:not([disabled])').waitFor();
  await sleep(250);
  attempts.push({ n: i, at: new Date().toISOString(), status: res.status(), message: await page.locator('[data-test="failure"]').innerText().catch(() => null) });
}
for (const a of attempts) log(`UI-01g attempt ${a.n}: ${a.status} | ${a.message} | at ${a.at}`);
await shot(page, 'a-ui-01g-11th.png');
const last = attempts[10];
check('UI-01g', '11 wrong sign-ins within a minute: ten say "invalid email or password" (401), the 11th says to wait and try again (429)', Date.now() - started < 60000 && attempts.slice(0, 10).every((a) => a.status === 401 && /không đúng/.test(a.message ?? '')) && last.status === 429 && !/không đúng/.test(last.message ?? ''), { seconds: Math.round((Date.now() - started) / 1000), statuses: attempts.map((a) => a.status).join(','), eleventh: last.message, stillOn: where(page) });
log('UTC time of the last sign-in attempt:', last.at);
await browser.close();
