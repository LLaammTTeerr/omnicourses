// Shared helpers for the B2 screen run on staging (a-screens.mjs, a-a11y-01.mjs).
// Chrome through playwright-core. Synthetic b2- accounts only (test cases §1). Tokens are read from the page to call
// the API and are never printed.
import { createRequire } from 'node:module';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, '../../../../node_modules/'));
export const { chromium } = require('playwright-core');
export const PW_VERSION = require('playwright-core/package.json').version;

export const BASE = 'https://stag-omnicourses.lamter.cc';
export const API = `${BASE}/api`;
export const PASSWORD = 'correct horse battery';
export const EVIDENCE = here;
export const ID = {
  A1: '32addfef-209b-4eba-b728-dfacb9856ead',
  A2: '46054d9c-2960-42c7-a80c-53a520e0cb65',
  A3: 'b41c5d8d-83f7-42b2-ab4b-a83810bd520e',
  A4: '925cb9c8-86de-4427-a8c8-72cf442dd074',
  S1: '8ca00334-e8f3-4cfc-b285-944db1a971a4',
};
export const EMAIL = { S1: 'b2-s1@example.com', T: 'b2-s8@example.com', A1: 'b2-a1@example.com', A2: 'b2-a2@example.com', A3: 'b2-a3@example.com', A4: 'b2-a4@example.com' };

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const log = (...a) => console.log(new Date().toISOString(), ...a);
let failures = 0;
export function check(id, label, ok, observed) {
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${id}: ${label}${observed === undefined ? '' : ` | observed: ${typeof observed === 'string' ? observed : JSON.stringify(observed)}`}`);
  return ok;
}
export const failureCount = () => failures;

// Sign-in allows 10 requests a minute from one address (ADR 0002). Every sign-in of every script, UI or API, waits
// until 7 s after the previous one, which a file in the temp folder records across processes.
const STAMP = path.join(os.tmpdir(), 'omnicourses-b2-last-sign-in.txt');
async function signInSlot() {
  const last = existsSync(STAMP) ? Number(readFileSync(STAMP, 'utf8')) || 0 : 0;
  const wait = last + 7000 - Date.now();
  if (wait > 0) await sleep(wait);
  writeFileSync(STAMP, String(Date.now()));
}

export async function api(method, route, token, body) {
  const res = await fetch(`${API}${route}`, {
    method,
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  console.log(`  API ${method} ${route} → ${res.status}${text && text.length < 400 ? ` ${text}` : ''}`);
  return { status: res.status, json };
}

/** API sign-in, for the "as X in Swagger" steps. Stops the run on a failure. */
export async function apiSignIn(email) {
  await signInSlot();
  const res = await fetch(`${API}/auth/sign-in`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: PASSWORD }) });
  console.log(`  API POST /auth/sign-in (${email}) → ${res.status}`);
  if (!res.ok) { console.log(`STOPPED: sign-in as ${email} answered ${res.status}`); process.exit(2); }
  return (await res.json()).token;
}

export async function launch() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  log(`Chrome ${browser.version()} (headless, playwright-core ${PW_VERSION})`);
  return browser;
}

/**
 * A new context and page at 1280 px, light theme and Vietnamese unless given. Records every /api/ request and every
 * toast text, so a case can check "sends nothing" and a toast that has already gone.
 */
export async function newPage(browser, { width = 1280, height = 800, lang = 'vi', theme = 'light' } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, colorScheme: theme, permissions: ['clipboard-read', 'clipboard-write'] });
  await context.addInitScript(([l, t]) => {
    try {
      if (!localStorage.getItem('omnicourse.lang')) localStorage.setItem('omnicourse.lang', l);
      if (!localStorage.getItem('omnicourse.theme')) localStorage.setItem('omnicourse.theme', t);
    } catch {}
    window.__toasts = [];
    const watch = () => {
      const el = document.querySelector('[data-test="toast"]');
      if (!el) return setTimeout(watch, 100);
      new MutationObserver(() => { const m = el.textContent.trim(); if (m) window.__toasts.push(m); }).observe(el, { childList: true, characterData: true, subtree: true });
    };
    document.addEventListener('DOMContentLoaded', watch);
  }, [lang, theme]);
  const page = await context.newPage();
  page.requests = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (u.pathname.startsWith('/api/')) page.requests.push({ method: r.method(), path: u.pathname + u.search, body: r.postData() ?? null, at: Date.now() });
  });
  page.on('requestfinished', async (r) => {
    const u = new URL(r.url());
    if (!u.pathname.startsWith('/api/')) return;
    const entry = [...page.requests].reverse().find((x) => x.path === u.pathname + u.search && x.method === r.method() && x.status === undefined);
    if (entry) entry.status = (await r.response())?.status() ?? null;
  });
  page.on('requestfailed', (r) => {
    const u = new URL(r.url());
    if (!u.pathname.startsWith('/api/')) return;
    const entry = [...page.requests].reverse().find((x) => x.path === u.pathname + u.search && x.method === r.method() && x.status === undefined);
    if (entry) entry.status = `failed: ${r.failure()?.errorText}`;
  });
  page.on('dialog', (d) => { page.lastDialog = d.message(); const answer = page.dialogAnswer ?? 'dismiss'; console.log(`  browser dialog "${d.message()}" → ${answer}`); answer === 'accept' ? d.accept() : d.dismiss(); });
  page.consoleErrors = [];
  page.on('pageerror', (e) => page.consoleErrors.push(e.message));
  return page;
}

/** Requests sent since `mark` (an index into page.requests), optionally only writes. */
export const mark = (page) => page.requests.length;
export const sent = (page, from, { writes = false } = {}) => page.requests.slice(from).filter((r) => !writes || r.method !== 'GET');
export const fmt = (reqs) => reqs.map((r) => `${r.method} ${r.path}${r.status === undefined ? '' : ` ${r.status}`}`).join('; ') || 'none';
export const toasts = (page) => page.evaluate(() => window.__toasts.slice());
export const clearToasts = (page) => page.evaluate(() => { window.__toasts.length = 0; });

/** DevTools "Network request blocking" stand-in: aborts matching requests as blocked by the client. */
export async function block(page, ...needles) {
  const handler = (route) => route.abort('blockedbyclient');
  const matcher = (url) => needles.some((n) => url.href.includes(n));
  await page.context().route(matcher, handler);
  return () => page.context().unroute(matcher, handler);
}

export async function settle(page, ms = 400) {
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  await sleep(ms);
}

export async function signIn(page, email) {
  await signInSlot();
  await page.goto(`${BASE}/sign-in`, { waitUntil: 'networkidle' });
  await page.fill('#sign-in-email', email);
  await page.fill('#sign-in-password', PASSWORD);
  const [res] = await Promise.all([page.waitForResponse((r) => r.url().endsWith('/api/auth/sign-in')), page.click('button[type=submit]')]);
  console.log(`  UI sign-in ${email} → ${res.status()}`);
  if (res.status() !== 200) { console.log(`STOPPED: sign-in as ${email} answered ${res.status()}`); process.exit(2); }
  await settle(page);
}

export const pageToken = (page) => page.evaluate(() => sessionStorage.getItem('omnicourse.session'));
export const where = (page) => page.url().replace(BASE, '');
export const bodyText = (page) => page.locator('body').innerText();
export const has = async (page, s) => (await bodyText(page)).includes(s);
export const shot = (page, name) => page.screenshot({ path: path.join(EVIDENCE, name) });
/** What has the focus: tag, id, data-test, aria-label and the start of its text. */
export const focused = (page) => page.evaluate(() => {
  const e = document.activeElement;
  if (!e || e === document.body) return 'body';
  return [e.tagName.toLowerCase(), e.id && `#${e.id}`, e.dataset.test && `[data-test=${e.dataset.test}]`, e.getAttribute('aria-label') && `"${e.getAttribute('aria-label')}"`, (e.innerText || e.value || '').trim().slice(0, 40)].filter(Boolean).join(' ');
});
export const goto = async (page, route) => { await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' }); await settle(page); };
/** Opens a route by typing it in the address bar: a full page load, as the cases' "type … in the address bar". */
export const addressBar = goto;
