// Shared helpers for the B1 screen run, track A (account, onboarding, audit, explorer, guide and sign-in screens).
// Headless Chromium through playwright-core, against staging. Synthetic example.com accounts only.
// Tokens are read from the page to call the API and are never printed.
import { createRequire } from 'node:module';
import { appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, '../../../../node_modules/'));
export const { chromium } = require('playwright-core');

export const BASE = process.env.B1_BASE ?? 'https://stag-omnicourses.lamter.cc';
export const API = `${BASE}/api`;
export const PASSWORD = 'correct horse battery';
export const NAME = 'Test Student';
export const RUN = '07ef42';
export const email = (nn) => `b1-run-${RUN}-a${nn}@example.com`;
export const EVIDENCE = here;
const LEDGER = process.env.B1_LEDGER;

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const log = (...a) => console.log(new Date().toISOString(), ...a);
export function check(id, label, ok, actual) {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${id}: ${label}${actual === undefined ? '' : ` | observed: ${typeof actual === 'string' ? actual : JSON.stringify(actual)}`}`);
  return ok;
}

export async function launch() {
  const browser = await chromium.launch({ headless: true });
  log(`Chromium ${browser.version()} (headless, playwright-core 1.64.1)`);
  return browser;
}

export async function newPage(browser, { width = 1280, height = 800, lang } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, acceptDownloads: true });
  if (lang) await context.addInitScript((l) => localStorage.setItem('omnicourse.lang', l), lang);
  const page = await context.newPage();
  page.consoleErrors = [];
  page.on('console', (m) => m.type() === 'error' && page.consoleErrors.push(m.text()));
  page.on('pageerror', (e) => page.consoleErrors.push(`pageerror: ${e.message}`));
  return page;
}

/** An API call with a token; `token` may be null. Retries once after 65 s on a 429 of the auth routes. */
export async function api(method, route, { token, body } = {}) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${API}${route}`, {
      method,
      headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}), 'User-Agent': 'B1 run track A (Node fetch)' },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    if (res.status === 429 && attempt === 0 && /auth\/sign-(up|in)/.test(route)) {
      log(`429 on ${route}: waiting 65 s and retrying once`);
      await sleep(65000);
      continue;
    }
    return { status: res.status, json, text, headers: res.headers };
  }
}

export function ledger(address) {
  if (LEDGER) appendFileSync(LEDGER, `${address}\n`);
}

/** Sign up through the API (setup only, not a screen case). Returns the token. */
export async function apiSignUp(address) {
  const r = await api('POST', '/auth/sign-up', { body: { email: address, password: PASSWORD, displayName: NAME, acceptedTerms: true } });
  if (r.status === 201) ledger(address);
  else throw new Error(`sign-up ${address}: ${r.status} ${r.text.slice(0, 200)}`);
  return r.json.token;
}

export async function apiOnboard(token, cohort = 2024, extra = {}) {
  return api('PUT', '/users/me/onboarding', { token, body: { program: 'APCS', cohort, targetGraduationTerm: null, creditsPerTerm: null, internshipTerm: null, finished: true, ...extra } });
}

/** The session token the page holds (sessionStorage). Never log the value. */
export const pageToken = (page) => page.evaluate(() => sessionStorage.getItem('omnicourse.session'));

/** Put a token into a fresh page's sessionStorage and open a path: the app then refreshes it like a reload. */
export async function openSignedIn(page, token, route = '/dashboard') {
  await page.goto(`${BASE}/sign-in`, { waitUntil: 'domcontentloaded' });
  await page.evaluate((t) => sessionStorage.setItem('omnicourse.session', t), token);
  await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
}

export async function screenSignUp(page, address) {
  await page.goto(`${BASE}/sign-up`, { waitUntil: 'networkidle' });
  await page.fill('#sign-up-displayName', NAME);
  await page.fill('#sign-up-email', address);
  await page.fill('#sign-up-password', PASSWORD);
  await page.check('#sign-up-consent');
  const [res] = await Promise.all([page.waitForResponse((r) => r.url().endsWith('/api/auth/sign-up')), page.click('button[type=submit]')]);
  if (res.status() === 201) ledger(address);
  await page.waitForLoadState('networkidle');
  return res.status();
}

export async function screenSignIn(page, address, password = PASSWORD) {
  if (!page.url().includes('/sign-in')) await page.goto(`${BASE}/sign-in`, { waitUntil: 'networkidle' });
  await page.fill('#sign-in-email', address);
  await page.fill('#sign-in-password', password);
  const [res] = await Promise.all([page.waitForResponse((r) => r.url().endsWith('/api/auth/sign-in')), page.click('button[type=submit]')]);
  await page.waitForLoadState('networkidle');
  return res;
}

export const mainText = async (page) => ((await page.locator('main, #main').first().innerText().catch(() => page.locator('body').innerText())) ?? '').replace(/\n+/g, ' | ').slice(0, 900);
export const shot = (page, name) => page.screenshot({ path: path.join(EVIDENCE, name) });
export const where = (page) => page.url().replace(BASE, '');
