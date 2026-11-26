// Shared helpers of the planner screen run (PLAN-01 Screen cases, ACAD-01e planner part, USER-01j) on staging.
// Run a case script with: node p-<case>.mjs   (from this folder; needs the repository's node_modules).
// Tokens are never printed. The state file with the session tokens lives outside the repository (P_STATE).
import { createRequire } from 'node:module';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
export const { chromium } = require('playwright-core');

export const SITE = process.env.SITE ?? 'https://stag-omnicourses.lamter.cc';
export const API = `${SITE}/api`;
export const RUN = process.env.RUN ?? '07ef42';
export const PASSWORD = 'correct horse battery';
const STATE = process.env.P_STATE ?? '/tmp/p-state.json';
const LEDGER = process.env.P_LEDGER ?? '/tmp/p-ledger.txt';
export const email = (n) => `b1-run-${RUN}-p${n}@example.com`;

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
export function log(...a) {
  console.log(`[${new Date().toISOString()}]`, ...a);
}
export const results = [];
/** Records one observation: ok true/false, or null for a note. */
export function check(id, what, ok, actual) {
  results.push({ id, what, ok });
  console.log(`${ok === null ? 'NOTE' : ok ? 'OK  ' : 'DIFF'} ${id} | ${what}${actual !== undefined ? ` | observed: ${typeof actual === 'string' ? actual : JSON.stringify(actual)}` : ''}`);
}
export function summary() {
  const by = {};
  for (const r of results) {
    by[r.id] ??= { ok: 0, diff: 0 };
    if (r.ok === true) by[r.id].ok++;
    if (r.ok === false) by[r.id].diff++;
  }
  console.log(`SUMMARY ${JSON.stringify(by)} elapsed ${Math.round((Date.now() - t0) / 1000)}s`);
}

function readState() {
  return existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : {};
}
function saveToken(mail, token) {
  const s = readState();
  s[mail] = token;
  writeFileSync(STATE, JSON.stringify(s));
}

export async function call(token, method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text };
}

async function limited(fn, what) {
  let r = await fn();
  if (r.status === 429) {
    log(`429 at ${what}: waiting 65 s and retrying once`);
    await sleep(65000);
    r = await fn();
  }
  return r;
}

/** A usable API token for the account: the saved one, else a sign-in, else a sign-up (recorded in the ledger). */
export async function tokenFor(mail, { fresh = false } = {}) {
  const saved = readState()[mail];
  if (saved && !fresh) {
    const me = await call(saved, 'GET', '/users/me');
    if (me.status === 200) return saved;
  }
  let r = await limited(() => call(null, 'POST', '/auth/sign-in', { email: mail, password: PASSWORD }), 'sign-in');
  if (r.status === 401) {
    r = await limited(() => call(null, 'POST', '/auth/sign-up', { email: mail, password: PASSWORD, displayName: 'Test Student', acceptedTerms: true }), 'sign-up');
    if (r.status === 201) {
      appendFileSync(LEDGER, `${mail}\n`);
      log(`signed up ${mail}`);
    }
  } else log(`signed in ${mail}: ${r.status}`);
  if (!r.json?.token) throw new Error(`no session for ${mail}: ${r.status} ${r.text.slice(0, 200)}`);
  if (!fresh) saveToken(mail, r.json.token);
  return r.json.token;
}

export async function browser() {
  const b = await chromium.launch({ headless: true });
  log(`Chromium ${b.version()} headless, Playwright ${require('playwright-core/package.json').version}, viewport 1280x800`);
  return b;
}

/**
 * A browser context signed in as the account. The app keeps the token in sessionStorage and exchanges it on every
 * page load, so the saved token is handed to the page and the page's current one is saved back by `keep`.
 */
export async function signedIn(b, mail, { lang = 'vi', fresh = false } = {}) {
  const token = await tokenFor(mail, { fresh });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, locale: 'vi-VN' });
  const page = await ctx.newPage();
  await page.goto(`${SITE}/privacy`);
  await page.evaluate(([t, l]) => { sessionStorage.setItem('omnicourse.session', t); localStorage.setItem('omnicourse.lang', l); }, [token, lang]);
  const keep = async () => {
    const t = await page.evaluate(() => sessionStorage.getItem('omnicourse.session')).catch(() => null);
    if (t && !fresh) saveToken(mail, t);
  };
  /** An API call from inside the page, with the page's current token. */
  const api = (method, path, body) =>
    page.evaluate(async ([m, p, bd]) => {
      const res = await fetch(`/api${p}`, {
        method: m,
        headers: { Authorization: `Bearer ${sessionStorage.getItem('omnicourse.session')}`, ...(bd !== null ? { 'Content-Type': 'application/json' } : {}) },
        body: bd !== null ? JSON.stringify(bd) : undefined,
      });
      const text = await res.text();
      let json = null;
      try { json = JSON.parse(text); } catch {}
      return { status: res.status, json };
    }, [method, path, body ?? null]);
  return { ctx, page, keep, api };
}

export const T = (page, name) => page.locator(`[data-test="${name}"]`);
export const text = async (loc) => ((await loc.first().textContent({ timeout: 5000 }).catch(() => null)) ?? '').replace(/\s+/g, ' ').trim();

export async function setLang(page, lang) {
  await page.evaluate((l) => localStorage.setItem('omnicourse.lang', l), lang);
  await page.reload();
  await page.waitForLoadState('networkidle');
}

/** Waits for the save chip to say saved (Đã lưu / Saved). */
export async function saved(page, timeout = 15000) {
  await page.waitForFunction(() => /Đã lưu|Saved/.test(document.querySelector('[data-test="save-state"]')?.textContent ?? '') && !/Đang lưu|Saving/.test(document.querySelector('[data-test="save-state"]')?.textContent ?? ''), null, { timeout });
  await page.waitForLoadState('networkidle').catch(() => {});
}

export async function openPlans(page) {
  await page.goto(`${SITE}/plans`);
  await page.waitForURL(/\/plans\/[0-9a-f-]{36}/, { timeout: 20000 });
  await T(page, 'status-strip').waitFor({ timeout: 20000 });
  await page.waitForLoadState('networkidle').catch(() => {});
}

/** New plan from the tabs. Returns the dialog body text and the new plan's id. */
export async function newPlan(page, name) {
  await T(page, 'new-plan').click();
  await page.locator('#plan-name').waitFor();
  const body = await text(page.locator('#plan-name-body'));
  await page.locator('#plan-name').fill(name);
  const before = page.url();
  await page.locator('.plan-name-form button[type=submit]').click();
  await page.waitForFunction((u) => location.href !== u && /\/plans\/[0-9a-f-]{36}/.test(location.pathname), before, { timeout: 15000 });
  await page.waitForFunction((n) => document.querySelector('h1')?.textContent?.trim() === n, name, { timeout: 15000 });
  await page.waitForLoadState('networkidle').catch(() => {});
  return { body, id: page.url().split('/').pop() };
}

/** Sets "Thêm vào / Add to" to the n-th row (0-based). */
export async function addTo(page, n) {
  await T(page, 'add-to').click();
  await page.locator('.ui-select.open [role=option]').nth(n).click();
}
export async function addCourse(page, code) {
  await T(page, `add-${code}`).scrollIntoViewIfNeeded();
  await T(page, `add-${code}`).click();
}
export const rowKeys = (page) => page.$$eval('.rows > section', (els) => els.map((e) => e.getAttribute('data-test')));
/** The board as shown: for each row, its name, load text and course tiles. */
export const board = (page) =>
  page.$$eval('.rows > section', (els) =>
    els.map((e) => ({
      row: e.getAttribute('data-test'),
      name: e.querySelector('h3')?.textContent?.trim(),
      load: (e.querySelector('[data-test="load"]')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
      tiles: [...e.querySelectorAll('.tiles > li[data-test^="tile-"]')].map((t) => t.getAttribute('data-test').slice(5)),
    })),
  );
export async function shot(page, file) {
  await page.screenshot({ path: new URL(file, import.meta.url).pathname });
}
