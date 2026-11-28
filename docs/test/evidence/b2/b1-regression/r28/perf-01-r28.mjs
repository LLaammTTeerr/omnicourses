// TC-B1-PERF-01b-h: dashboard and audit load time (docs/test/test-cases-b1.md §4).
//
// Run by the tester, who supplies P's password through the environment:
//   PowerShell:  $env:B1_PASSWORD = '<password>'; node perf-01.mjs
//   Git Bash:    B1_PASSWORD='<password>' node perf-01.mjs
// Optional: B1_BASE (default https://omnicourses.lamter.cc), B1_REPO (where node_modules/playwright is).
//
// Chrome runs headed; leave the computer alone until it prints the summary (about 10 minutes).
// The password and the session token are never printed or written to the output.

import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = process.env.B1_REPO ?? 'E:/Project/omnicourses';
const { chromium } = createRequire(join(REPO, 'package.json'))('playwright');
// r28: copied to b1-regression/r28/ for the 28 Nov rerun; changes: DASHBOARD_R28, park() and PACE_MS below.

const BASE = (process.env.B1_BASE ?? 'https://omnicourses.lamter.cc').replace(/\/$/, '');
const EMAIL = process.env.B1_EMAIL ?? 'b1-perf@example.com';
const PASSWORD = process.env.B1_PASSWORD;
if (!PASSWORD) {
  console.error('Set B1_PASSWORD to P\'s password first.');
  process.exit(1);
}

// §4 Network profile: 10 Mbps down, 2 Mbps up, 50 ms round trip, no CPU throttling.
const PROFILE = { offline: false, latency: 50, downloadThroughput: 1250000, uploadThroughput: 250000 };
const LIMIT_MS = 2000;
const SIGN_IN_GAP_MS = 7000; // sign-in accepts 10 a minute from one address (§1 Rate limits)

// §4 Fixture: every expected value of each page, as the Vietnamese screen formats it.
const COMMON = {
  'credits-toward-total': '164 / 163 TC',
  'gpa-average': '7,77',
  'gpa-accumulated-average': '7,77',
  'gpa-classification': 'Khá',
  'graduation-status': 'Đạt mọi điều kiện kiểm tra được',
};
// 28 Nov (r28): #214 rebuilt the dashboard without graduation-status, credits-accumulated, gpa-average and
// gpa-classification, so the dashboard's run stops when the three figures it still shows are drawn: 164 of 163
// credits, 0 remaining and the accumulated average. The audit keeps every figure of the case.
const DASHBOARD_R28 = { 'credits-toward-total': '164', 'credits-remaining': '0', 'gpa-accumulated-average': '7,77/10' };
const PAGES = {
  dashboard: { path: '/dashboard', navLabel: 'Tổng quan', values: DASHBOARD_R28, absent: ['gpa-four-point'] },
  audit: { path: '/audit', navLabel: 'Xét tốt nghiệp', values: { ...COMMON, 'gpa-four-point': '3,3' }, absent: [] },
};

// Runs in the page on every animation frame: the time of the first frame where every expected value is on screen and
// nothing is loading, or false. performance.now() counts from navigation start on a page load.
const READY = (exp) => {
  if (location.pathname !== exp.path) return false;
  if (document.querySelector('[aria-busy="true"], [data-test="loading"]')) return false;
  for (const [k, v] of Object.entries(exp.values)) {
    const el = document.querySelector(`[data-test="${k}"]`);
    if (!el || el.textContent.trim().replace(/\s+/g, ' ') !== v) return false;
  }
  for (const k of exp.absent) if (document.querySelector(`[data-test="${k}"]`)) return false;
  return performance.now();
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = { startedAt: new Date().toISOString(), base: BASE, profile: PROFILE, limitMs: LIMIT_MS, series: {} };
let lastSignIn = 0;

async function newSession(browser) {
  const context = await browser.newContext({ locale: 'vi-VN', viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', PROFILE);
  const api = [];
  page.on('requestfinished', (req) => {
    if (!req.url().includes('/api/')) return;
    const t = req.timing();
    api.push({ method: req.method(), path: new URL(req.url()).pathname, waitingMs: +(t.responseStart - t.requestStart).toFixed(1) });
  });
  return { context, page, cdp, api };
}

async function signIn(page) {
  const wait = lastSignIn + SIGN_IN_GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastSignIn = Date.now();
  await page.goto(`${BASE}/sign-in`);
  await page.fill('input[type=email]', EMAIL);
  await page.fill('input[type=password]', PASSWORD);
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.startsWith('/sign-in'), { timeout: 30000 });
  await park(page);
}

// r28: the pointer must not rest over the dashboard's donut or group list, where hovering shows a group's
// credits in the donut's centre in place of credits-toward-total (perf-01d-probe-r28.mjs). Park it in the corner after
// each click; the move is not part of what the page has to do.
const park = (page) => page.mouse.move(1, 1);

// r28: one dashboard load sends 7 GET /api/users/me/audit for P (dashboard-audit-calls-r28.mjs), so back-to-back
// reloads reach the 120-a-minute limit after about 17 loads and the page shows its 429 error. Each run therefore starts
// at least PACE_MS after the one before (7 x 60 / 120 = 3.5 s), as B2's PERF-01 paces its runs.
const PACE_MS = 4000;
let lastRun = 0;
async function measure(s, exp, act) {
  const wait = lastRun + PACE_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastRun = Date.now();
  s.api.length = 0;
  let ms;
  let error = null;
  try {
    ms = await act();
  } catch (e) {
    error = String(e.message ?? e).split('\n')[0];
  }
  await sleep(300); // let the last API timings arrive (diagnostic only)
  return { ms: ms === undefined ? null : +ms.toFixed(1), error, api: [...s.api] };
}

const pageLoad = (s, exp) => () =>
  s.page.goto(`${BASE}${exp.path}`, { waitUntil: 'commit' }).then(() => s.page.waitForFunction(READY, exp, { polling: 'raf', timeout: 30000 })).then((h) => h.jsonValue());

const reload = (s, exp) => () =>
  s.page.reload({ waitUntil: 'commit' }).then(() => s.page.waitForFunction(READY, exp, { polling: 'raf', timeout: 30000 })).then((h) => h.jsonValue());

const inApp = (s, exp) => async () => {
  // The clock starts at the click (§4): the first click event the page sees.
  await s.page.evaluate(() => {
    window.__b1Click = null;
    document.addEventListener('click', () => (window.__b1Click ??= performance.now()), { capture: true, once: true });
  });
  await s.page.click(`nav a[href="${exp.path}"]`);
  await park(s.page);
  const done = await s.page.waitForFunction(READY, exp, { polling: 'raf', timeout: 30000 }).then((h) => h.jsonValue());
  const clicked = await s.page.evaluate(() => window.__b1Click);
  return done - clicked;
};

async function backToGuides(s) {
  await s.page.click('nav a[href="/guides"]');
  await park(s.page);
  await s.page.waitForFunction(() => location.pathname === '/guides' && !!document.querySelector('main h1'), null, { polling: 'raf', timeout: 30000 });
}

function summarise(runs) {
  const ms = runs.map((r) => (r.ms === null ? Infinity : r.ms)).sort((a, b) => a - b);
  const at = (p) => ms[Math.min(ms.length - 1, Math.ceil(p * ms.length) - 1)];
  return { n: ms.length, median: at(0.5), p95: at(0.95), max: ms.at(-1), over: runs.filter((r) => r.ms === null || r.ms >= LIMIT_MS).length };
}

function record(id, label, warmups, runs) {
  const summary = summarise(runs);
  results.series[id] = { label, warmups, runs, summary, pass: summary.over === 0 };
  const fmt = (v) => (v === Infinity ? 'n/a' : `${Math.round(v)} ms`);
  console.log(`${id} ${label}: ${summary.n} runs, median ${fmt(summary.median)}, p95 ${fmt(summary.p95)}, max ${fmt(summary.max)}, ${summary.over} at or over 2 s -> ${summary.over === 0 ? 'PASS' : 'FAIL'}`);
  const errors = [...new Set([...warmups, ...runs].filter((r) => r.error).map((r) => r.error))];
  if (errors.length) console.log(`${id} errors (added 27 Nov): ${errors.join(' | ')}`);
}

async function perf01b(browser) {
  const s = await newSession(browser);
  await s.page.goto(`${BASE}/`);
  const out = await s.page.evaluate(async () => {
    const health = [];
    for (let i = 0; i < 10; i++) {
      const t0 = performance.now();
      await fetch('/api/health', { cache: 'no-store' });
      health.push(+(performance.now() - t0).toFixed(1));
    }
    const js = performance
      .getEntriesByType('resource')
      .filter((e) => /\.js(\?|$)/.test(e.name))
      .sort((a, b) => b.encodedBodySize - a.encodedBodySize)[0];
    const url = js.name;
    const t0 = performance.now();
    await (await fetch(url, { cache: 'no-store' })).arrayBuffer();
    const ms = +(performance.now() - t0).toFixed(1);
    const entry = performance.getEntriesByName(url).at(-1);
    return { health, js: { url: new URL(url).pathname, encodedBytes: entry.encodedBodySize, decodedBytes: entry.decodedBodySize, ms } };
  });
  const expectedMs = +((out.js.encodedBytes / PROFILE.downloadThroughput) * 1000 + PROFILE.latency).toFixed(0);
  results.series['PERF-01b'] = { ...out, js: { ...out.js, expectedMs }, healthAllAtLeast50: out.health.every((t) => t >= 50) };
  console.log(`PERF-01b health ms: ${out.health.join(', ')} (all >= 50: ${out.health.every((t) => t >= 50)})`);
  console.log(`PERF-01b largest JS ${out.js.url}: ${out.js.encodedBytes} bytes on the wire, ${out.js.ms} ms (profile predicts about ${expectedMs} ms)`);
  await s.context.close();
}

async function cold(browser, id, exp) {
  const runs = [];
  for (let i = 0; i < 5; i++) {
    const s = await newSession(browser);
    await signIn(s.page); // not timed
    await s.cdp.send('Network.clearBrowserCache');
    runs.push(await measure(s, exp, pageLoad(s, exp)));
    await s.context.close();
  }
  record(id, `${exp.path} cold cache`, [], runs);
}

async function warm(browser, id, exp) {
  const s = await newSession(browser);
  await signIn(s.page);
  await s.page.goto(`${BASE}${exp.path}`);
  const warmups = [];
  for (let i = 0; i < 5; i++) warmups.push(await measure(s, exp, reload(s, exp)));
  const runs = [];
  for (let i = 0; i < 30; i++) runs.push(await measure(s, exp, reload(s, exp)));
  record(id, `${exp.path} warm cache`, warmups, runs);
  await s.context.close();
}

async function inAppSeries(browser, id, exp) {
  const s = await newSession(browser);
  await signIn(s.page);
  await s.page.goto(`${BASE}/guides`);
  await backToGuides(s).catch(() => {});
  const warmups = [];
  const runs = [];
  for (let i = 0; i < 35; i++) {
    const r = await measure(s, exp, inApp(s, exp));
    (i < 5 ? warmups : runs).push(r);
    await backToGuides(s);
  }
  record(id, `${exp.path} in-app from Guides (${exp.navLabel})`, warmups, runs);
  await s.context.close();
}

const browser = await chromium.launch({ channel: 'chrome', headless: false });
results.chrome = browser.version();
console.log(`Chrome ${results.chrome}, base ${BASE}, profile ${JSON.stringify(PROFILE)}`);
try {
  await perf01b(browser);
  await cold(browser, 'PERF-01c', PAGES.dashboard);
  await warm(browser, 'PERF-01d', PAGES.dashboard);
  await inAppSeries(browser, 'PERF-01e', PAGES.dashboard);
  await cold(browser, 'PERF-01f', PAGES.audit);
  await warm(browser, 'PERF-01g', PAGES.audit);
  await inAppSeries(browser, 'PERF-01h', PAGES.audit);
} finally {
  await browser.close();
  results.finishedAt = new Date().toISOString();
  const out = join(dirname(fileURLToPath(import.meta.url)), `perf-01-${results.startedAt.replace(/[:.]/g, '-')}.json`);
  writeFileSync(out, JSON.stringify(results, null, 2));
  console.log(`Raw results: ${out}`);
}
