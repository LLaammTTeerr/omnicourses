// PERF-01 follow-up (28 Nov, r28, staging 4b038fe): with the pointer parked and in headless Chrome, perf-01-r28.mjs
// still had a few runs that never met the stop condition in 30 s, on the dashboard and on the audit. This probe signs
// in as P. MODE unset: reloads /dashboard and /audit 15 times each (no network profile) and, 10 s after each load, prints where the
// page is, whether the page's figures are drawn, and the status of every /api/ request of that load. MODE=settled: reloads only once the page is drawn, as PERF-01d and g do. Never a token.
import { createRequire } from 'node:module';
const { chromium } = createRequire('E:/Project/omnicourses/package.json')('playwright');
const BASE = 'https://stag-omnicourses.lamter.cc';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await (await browser.newContext({ locale: 'vi-VN', viewport: { width: 1440, height: 900 } })).newPage();
let calls = [];
page.on('response', (r) => { const u = new URL(r.url()); if (u.pathname.startsWith('/api/')) calls.push(`${r.request().method()} ${u.pathname.replace(/[0-9a-f-]{36}/g, '{id}')} ${r.status()}`); });
page.on('requestfailed', (r) => { const u = new URL(r.url()); if (u.pathname.startsWith('/api/')) calls.push(`${r.method()} ${u.pathname} failed ${r.failure()?.errorText}`); });
await page.goto(`${BASE}/sign-in`);
await page.fill('input[type=email]', process.env.B1_EMAIL);
await page.fill('input[type=password]', process.env.B1_PASSWORD);
await page.click('button[type=submit]');
await page.waitForURL((u) => !u.pathname.startsWith('/sign-in'), { timeout: 30000 });
await page.mouse.move(1, 1);
const read = () => page.evaluate(() => ({
  path: location.pathname + location.search,
  busy: !!document.querySelector('[aria-busy="true"], [data-test="loading"]'),
  toward: document.querySelector('[data-test="credits-toward-total"]')?.textContent.trim() ?? null,
  gpa: document.querySelector('[data-test="gpa-accumulated-average"]')?.textContent.trim().replace(/\s+/g, ' ') ?? null,
  alert: [...document.querySelectorAll('[role="alert"]')].map((e) => e.textContent.trim()).join(' | ') || null,
}));
const ready = (route) => page.waitForFunction((r) => location.pathname === r && !document.querySelector('[aria-busy="true"], [data-test="loading"]') && !!document.querySelector('[data-test="gpa-accumulated-average"]') && /7,77/.test(document.querySelector('[data-test="gpa-accumulated-average"]').textContent), route, { timeout: 15000 }).then(() => true, () => false);
if (process.env.MODE === 'settled') {
  // Second part: like PERF-01d/g, reload only once the page is drawn; print each load that does not settle in 15 s.
  for (const route of ['/dashboard', '/audit']) {
    await page.goto(`${BASE}${route}`);
    console.log(`${route} first load drawn: ${await ready(route)}`);
    let bad = 0;
    for (let i = 0; i < 30; i++) {
      calls = [];
      await page.reload();
      const ok = await ready(route);
      if (!ok) { bad++; console.log(`${route} reload ${i + 1} NOT drawn in 15 s: ${JSON.stringify(await read())} | ${calls.join('; ')}`); }
      if (!ok && (await read()).path.startsWith('/sign-in')) break;
    }
    console.log(`${route}: ${bad} of the reloads not drawn`);
  }
} else {
  for (const route of ['/dashboard', '/audit']) {
    await page.goto(`${BASE}${route}`);
    for (let i = 0; i < 15; i++) {
      calls = [];
      await page.reload();
      await page.waitForTimeout(10000);
      console.log(`${route} load ${i + 1}: ${JSON.stringify(await read())} | ${calls.join('; ')}`);
    }
  }
}
await browser.close();
