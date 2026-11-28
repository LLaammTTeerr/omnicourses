// PERF-01 follow-up (28 Nov, r28, staging 4b038fe): how many GET /api/users/me/audit one dashboard load sends, against
// one audit-page load, for P (the completion fixture, 12 terms). Run after a minute with no request, so no 429 can come
// from earlier loads. Prints the requests of each load; never a token.
import { createRequire } from 'node:module';
const { chromium } = createRequire('E:/Project/omnicourses/package.json')('playwright');
const BASE = 'https://stag-omnicourses.lamter.cc';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await (await browser.newContext({ locale: 'vi-VN', viewport: { width: 1440, height: 900 } })).newPage();
let calls = [];
page.on('request', (r) => { const u = new URL(r.url()); if (u.pathname.startsWith('/api/')) calls.push(`${r.method()} ${u.pathname}${u.search}`); });
await page.goto(`${BASE}/sign-in`);
await page.fill('input[type=email]', process.env.B1_EMAIL);
await page.fill('input[type=password]', process.env.B1_PASSWORD);
await page.click('button[type=submit]');
await page.waitForURL((u) => !u.pathname.startsWith('/sign-in'), { timeout: 30000 });
await page.mouse.move(1, 1);
for (const route of ['/audit', '/dashboard', '/audit', '/dashboard']) {
  await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
  calls = [];
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const audit = calls.filter((c) => c.startsWith('GET /api/users/me/audit'));
  console.log(`${route} reload: ${calls.length} API requests, ${audit.length} of them GET /api/users/me/audit: ${JSON.stringify(audit)}`);
}
await browser.close();
