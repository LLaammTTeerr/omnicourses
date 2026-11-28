// PERF-01 follow-up (28 Nov, r28): on 778d120 a few dashboard runs of perf-01-r28.mjs (first version) never met the
// stop condition in 30 s, while every audit run did. This probe signs in as P, reloads /dashboard 20 times (no network
// profile) and, 8 s after each load, prints the three figures the dashboard run waits for and whether anything is busy.
import { createRequire } from 'node:module';
const { chromium } = createRequire('E:/Project/omnicourses/package.json')('playwright');
const BASE = 'https://stag-omnicourses.lamter.cc';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await (await browser.newContext({ locale: 'vi-VN', viewport: { width: 1440, height: 900 } })).newPage();
await page.goto(`${BASE}/sign-in`);
await page.fill('input[type=email]', process.env.B1_EMAIL);
await page.fill('input[type=password]', process.env.B1_PASSWORD);
await page.click('button[type=submit]');
await page.waitForURL((u) => !u.pathname.startsWith('/sign-in'), { timeout: 30000 });
if (process.env.PARK === "1") await page.mouse.move(1, 1);
const read = () => page.evaluate(() => ({
  path: location.pathname,
  busy: !!document.querySelector('[aria-busy="true"], [data-test="loading"]'),
  toward: document.querySelector('[data-test="credits-toward-total"]')?.textContent.trim(),
  remaining: document.querySelector('[data-test="credits-remaining"]')?.textContent.trim(),
  gpa: document.querySelector('[data-test="gpa-accumulated-average"]')?.textContent.trim().replace(/\s+/g, ' '),
  term: document.querySelector('[data-test="term-label"]')?.textContent.trim(),
}));
for (let i = 0; i < 20; i++) {
  if (i === 0) await page.goto(`${BASE}/dashboard`); else await page.reload();
  await page.waitForTimeout(8000);
  console.log(`load ${i + 1}: ${JSON.stringify(await read())}`);
}
await browser.close();
