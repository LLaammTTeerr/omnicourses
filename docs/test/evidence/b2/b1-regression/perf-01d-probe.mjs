// PERF-01d follow-up: on 27 Nov every warm reload of /dashboard timed out (30 s) in perf-01.mjs, while the cold loads
// (PERF-01c) and the in-app opens (PERF-01e) passed. This probe signs in as P, loads /dashboard, reloads it twice, and
// after each load prints what perf-01.mjs's READY check sees: the path, busy elements and each expected figure.
import { createRequire } from 'node:module';
import { join } from 'node:path';
const { chromium } = createRequire(join('E:/Project/omnicourses', 'package.json'))('playwright');
const BASE = 'https://stag-omnicourses.lamter.cc';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ locale: 'vi-VN', viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
await page.goto(`${BASE}/sign-in`);
await page.fill('input[type=email]', process.env.B1_EMAIL);
await page.fill('input[type=password]', process.env.B1_PASSWORD);
await page.click('button[type=submit]');
await page.waitForURL((u) => !u.pathname.startsWith('/sign-in'), { timeout: 30000 });
const state = () => page.evaluate(() => ({
  path: location.pathname,
  busy: [...document.querySelectorAll('[aria-busy="true"], [data-test="loading"]')].map((e) => `${e.tagName.toLowerCase()}.${[...e.classList].join('.')}[data-test=${e.dataset.test ?? ''}] "${e.textContent.trim().slice(0, 40)}"`),
  figures: Object.fromEntries(['credits-toward-total', 'gpa-average', 'gpa-accumulated-average', 'gpa-classification', 'graduation-status', 'gpa-four-point'].map((k) => [k, document.querySelector(`[data-test="${k}"]`)?.textContent.trim().replace(/\s+/g, ' ') ?? null])),
}));
await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
console.log('after goto', JSON.stringify(await state()));
for (const n of [1, 2]) {
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  console.log(`after reload ${n}`, JSON.stringify(await state()));
}
await browser.close();
