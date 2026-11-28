// PERF-01d/g follow-up (28 Nov, r28, staging 4b038fe): the warm series of perf-01-r28.mjs signs in, opens the page and reloads
// at once. This probe does the same under the PERF profile, three times per page, and prints where each reload lands and the
// /api/auth/refresh answers, to see whether the reload meets #255 (a reload during the session refresh signs the student out).
// WAIT=1 waits until the page is drawn before the first reload. Never prints a token.
import { createRequire } from 'node:module';
const { chromium } = createRequire('E:/Project/omnicourses/package.json')('playwright');
const BASE = 'https://stag-omnicourses.lamter.cc';
const PROFILE = { offline: false, latency: 50, downloadThroughput: 1250000, uploadThroughput: 250000 };
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (const route of ['/dashboard', '/audit']) {
  for (let i = 1; i <= 3; i++) {
    const context = await browser.newContext({ locale: 'vi-VN', viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', PROFILE);
    const auth = [];
    page.on('response', (r) => { if (r.url().includes('/api/auth/')) auth.push(`${r.request().method()} ${new URL(r.url()).pathname} ${r.status()}`); });
    page.on('requestfailed', (r) => { if (r.url().includes('/api/auth/')) auth.push(`${r.method()} ${new URL(r.url()).pathname} failed ${r.failure()?.errorText}`); });
    await page.goto(`${BASE}/sign-in`);
    await page.fill('input[type=email]', process.env.B1_EMAIL);
    await page.fill('input[type=password]', process.env.B1_PASSWORD);
    await page.click('button[type=submit]');
    await page.waitForURL((u) => !u.pathname.startsWith('/sign-in'), { timeout: 30000 });
    await page.goto(`${BASE}${route}`);
    if (process.env.WAIT === '1') await page.waitForSelector('[data-test="credits-toward-total"]', { timeout: 30000 }).catch(() => {});
    auth.length = 0;
    await page.reload({ waitUntil: 'commit' });
    await sleep(8000);
    console.log(`${route} try ${i}${process.env.WAIT === '1' ? ' (waited for the first draw)' : ''}: after the reload at ${new URL(page.url()).pathname}${new URL(page.url()).search}; ${auth.join('; ') || 'no auth request'}`);
    await context.close();
    await sleep(8000);
  }
}
await browser.close();
