// TC-B2-PERF-01a–f on staging (docs/test/test-cases-b2.md §9). Synthetic account Q (b2-s7) only.
//   node a-perf-01.mjs prep        a: fixture, transcript, plan and CS420 checks through the API (makes Q's plan if missing)
//   node a-perf-01.mjs a           a: V, P and C once each, no network profile
//   node a-perf-01.mjs b           b: the profile: /api/health ×10 and the largest JavaScript file
//   node a-perf-01.mjs V|P|C       c, d, e: 5 warm-ups and 30 measured runs with the profile
//   node a-perf-01.mjs o-setup     f: CS420's offering terms set to [1, 2] (A1)
//   node a-perf-01.mjs O           f: 5 warm-ups and 30 measured runs of O
//   node a-perf-01.mjs o-cleanup   f: CS420's offering terms back to null (A1)
// Chrome runs headed unless HEADLESS=1. Never prints a token.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { BASE, EVIDENCE, chromium, PW_VERSION, pageToken, signIn } from './b-lib.mjs';
import { account, call, check, failureCount, log, PROGRAM, secret, signInApi, sleep } from './c-lib.mjs';

const part = process.argv[2] ?? 'prep';
const Q = 'b2-s7@example.com';
const A1 = 'b2-a1@example.com';
const APCS24 = '4a941965-834b-4d5a-a9c3-91a0607c3cbc';
const OFFERING = `/admin/programs/${PROGRAM.APCS}/cohorts/${APCS24}/courses/CS420/offering-terms`;
const FIXTURE = JSON.parse(readFileSync(path.join(EVIDENCE, 'perf-01-plan.json'), 'utf8'));
const PROFILE = { offline: false, latency: 50, downloadThroughput: 1250000, uploadThroughput: 250000 };
const LIMIT_MS = 300;
const STOP_TIMEOUT_MS = 20000;
const RUN_GAP_MS = 4000;
const WARMUPS = 5;
const MEASURED = 30;

const EDITS = {
  V: { code: 'MTH346', from: '2028-1', to: '2028-2', keys: ['ArrowDown'], expect: 'valid' },
  P: { code: 'CS470', from: '2029-2', to: '2028-3', keys: ['ArrowUp', 'ArrowUp'], expect: 'violation' },
  O: { code: 'CS420', from: '2028-1', to: '2028-3', keys: ['ArrowDown', 'ArrowDown'], expect: 'violation' },
  C: { code: 'CS163', from: '2026-2', to: '2026-1', keys: ['ArrowUp'], expect: 'flag' },
};

const shape = (terms) => terms.map((t) => ({ term: { year: t.term.year, number: t.term.number }, placements: t.placements.map((p) => ({ kind: p.kind, courseCode: p.courseCode ?? null })) }));
const fixtureShape = shape(FIXTURE.terms);

async function qPlan(token) {
  const list = await call('GET', '/plans', { token, quiet: true });
  return list.json.plans.find((p) => p.name === 'PERF-01') ?? null;
}

function offeringOf(node, code) {
  if (Array.isArray(node)) { for (const x of node) { const r = offeringOf(x, code); if (r !== undefined) return r; } return undefined; }
  if (node && typeof node === 'object') {
    if (node.code === code && 'offeringTerms' in node) return node.offeringTerms;
    for (const v of Object.values(node)) { const r = offeringOf(v, code); if (r !== undefined) return r; }
  }
  return undefined;
}

async function boardIsFixture(token, id, label) {
  const plan = await call('GET', `/plans/${id}`, { token, quiet: true });
  const same = isDeepStrictEqual(shape(plan.json.terms), fixtureShape);
  const placements = plan.json.terms.reduce((n, t) => n + t.placements.length, 0);
  check('PERF-01', `${label}: GET /api/plans/{id} holds the fixture's terms and placements in order`, same, { terms: plan.json.terms.length, placements });
  return same;
}

if (part === 'prep') {
  const q = await account(Q);
  log(`Q ${q.created ? 'signed up and onboarded now' : 'already existed'}`);
  const tr = await call('GET', '/users/me/transcript', { token: q.token, quiet: true });
  check('PERF-01a', 'the transcript has no row', tr.status === 200 && tr.json.rows.length === 0, tr.json?.rows?.length);
  let plan = await qPlan(q.token);
  if (!plan) {
    const made = await call('POST', '/plans', { token: q.token, body: { name: 'PERF-01', programCode: 'APCS', cohortYear: 2024, terms: FIXTURE.terms }, quiet: true });
    check('PERF-01a', 'POST /api/plans "PERF-01" with the fixture 201', made.status === 201, made.status);
    plan = made.json;
  }
  log(`Q's plan PERF-01 = ${plan.id}`);
  await boardIsFixture(q.token, plan.id, 'PERF-01a');
  const cur = await call('GET', '/programs/APCS/curricula/2024', { token: q.token, quiet: true });
  const cs420 = offeringOf(cur.json, 'CS420');
  check('PERF-01a', 'CS420 reads "offeringTerms": null', cs420 === null, cs420);
  const all = await call('GET', '/plans', { token: q.token, quiet: true });
  log(`Q has ${all.json.plans.length} plan(s): ${JSON.stringify(all.json.plans.map((p) => p.name))}`);
}

async function session({ profile }) {
  const browser = await chromium.launch({ channel: 'chrome', headless: process.env.HEADLESS === '1', args: ['--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'] });
  log(`Chrome ${browser.version()} (${process.env.HEADLESS === '1' ? 'headless' : 'headed'}, playwright-core ${PW_VERSION}), profile ${profile ? JSON.stringify(PROFILE) : 'off'}`);
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'light' });
  await context.addInitScript(() => { try { if (!localStorage.getItem('omnicourse.lang')) localStorage.setItem('omnicourse.lang', 'en'); } catch {} });
  const page = await context.newPage();
  page.on('dialog', (d) => d.dismiss());
  page.requests = [];
  page.timings = [];
  page.on('requestfinished', (r) => {
    const u = new URL(r.url());
    if (!u.pathname.startsWith('/api/')) return;
    const t = r.timing();
    page.timings.push({ method: r.method(), path: u.pathname.replace(/[0-9a-f-]{36}/g, '{id}'), serverMs: +(t.responseStart - t.requestStart).toFixed(1), at: Date.now() });
  });
  page.on('response', (r) => { if (r.url().includes('/api/') && r.status() === 429) page.saw429 = true; });
  await signIn(page, Q);
  const token = await pageToken(page);
  secret(token, '…');
  const plan = await qPlan(token);
  if (profile) {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', PROFILE);
  }
  await page.goto(`${BASE}/plans/${plan.id}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-test="issues-panel"][aria-busy="false"]');
  await sleep(1000);
  const fresh = await pageToken(page);
  secret(fresh, '…');
  return { browser, page, token: fresh, plan };
}

const BASELINE = () => {
  const panel = document.querySelector('[data-test="issues-panel"]');
  const counts = document.querySelector('[data-test="issue-counts"]');
  if (!panel || panel.getAttribute('aria-busy') !== 'false' || !counts || counts.classList.contains('stale')) return null;
  return {
    counts: counts.textContent.trim().replace(/\s+/g, ' '),
    violations: document.querySelectorAll('[data-test="issue-violation"]').length,
    flags: document.querySelectorAll('[data-test="issue-flag"]').length,
  };
};

async function baseline(page) {
  return (await page.waitForFunction(BASELINE, null, { polling: 'raf', timeout: STOP_TIMEOUT_MS })).jsonValue();
}

const INSTALL = ([edit, base]) => {
  window.__t0 = null;
  window.__t1 = null;
  window.__failed = false;
  const drawn = () => {
    if (!document.querySelector(`[data-test="term-${edit.to}"] [data-test="tile-${edit.code}"]`)) return false;
    if (document.querySelector('[data-test="issues-panel"]')?.getAttribute('aria-busy') !== 'false') return false;
    const counts = document.querySelector('[data-test="issue-counts"]');
    if (!counts || counts.classList.contains('stale')) return false;
    const violations = [...document.querySelectorAll('[data-test="issue-violation"]')];
    const flags = [...document.querySelectorAll('[data-test="issue-flag"]')];
    if (edit.expect === 'valid') return violations.length === 0 && flags.length === 0 && counts.textContent.trim().replace(/\s+/g, ' ') === base.counts;
    if (edit.expect === 'violation') {
      return violations.length === 1 && flags.length === 0
        && violations[0].querySelector('[data-test="issue-text"]').textContent.includes(edit.code)
        && !!document.querySelector(`[data-test="term-${edit.to}"] [data-test="tile-${edit.code}"] [data-test="tile-issue-violation"]`);
    }
    return flags.length === 1 && violations.length === 0 && !!document.querySelector(`[data-test="term-${edit.to}"] [data-test="row-issue-flag"]`);
  };
  window.addEventListener('keydown', (e) => { if (e.key === 'Enter' && window.__t0 === null) window.__t0 = performance.now(); }, { capture: true, once: true });
  const frame = () => {
    if (window.__t0 !== null) {
      if (document.querySelector('[data-test="issues-failed"]')) { window.__failed = true; return; }
      if (drawn()) { window.__t1 = performance.now(); return; }
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
};

async function oneRun(s, edit, base) {
  const { page } = s;
  page.saw429 = false;
  const tile = `[data-test="term-${edit.from}"] [data-test="tile-${edit.code}"]`;
  await page.focus(tile);
  await page.keyboard.press(' ');
  await page.waitForSelector(`${tile}.lifted`, { timeout: 5000 });
  for (const k of edit.keys) await page.keyboard.press(k);
  const target = `[data-test="term-${edit.to}"]`;
  await page.waitForFunction((sel) => { const row = document.querySelector(sel); return row && row.classList.contains('drop-target') && !row.classList.contains('checking'); }, target, { polling: 'raf', timeout: STOP_TIMEOUT_MS });
  await page.evaluate(INSTALL, [edit, base]);
  const from = Date.now();
  await page.keyboard.press('Enter');
  let ms = null;
  let error = null;
  try {
    await page.waitForFunction(() => window.__t1 !== null || window.__failed, null, { timeout: STOP_TIMEOUT_MS });
    const r = await page.evaluate(() => ({ t0: window.__t0, t1: window.__t1, failed: window.__failed }));
    if (r.failed) error = 'issues-failed shown';
    else ms = +(r.t1 - r.t0).toFixed(1);
  } catch { error = `stop condition not met within ${STOP_TIMEOUT_MS / 1000} s`; }
  if (page.saw429) error = `${error ? `${error}; ` : ''}a 429 answer`;
  await sleep(300);
  const server = page.timings.filter((t) => t.at >= from && ((t.method === 'PUT' && t.path.endsWith('/placements')) || (t.method === 'GET' && t.path.endsWith('/issues')))).slice(0, 2).map((t) => `${t.method} ${t.serverMs}`);
  await page.focus(`[data-test="term-${edit.to}"] [data-test="tile-${edit.code}"]`).catch(() => {});
  await page.keyboard.press('Control+z');
  await page.waitForSelector(tile, { timeout: STOP_TIMEOUT_MS });
  const back = await baseline(page);
  const undone = back.counts === base.counts && back.violations === base.violations && back.flags === base.flags;
  return { ms, error, server, undone };
}

function summarise(runs) {
  const ms = runs.map((r) => (r.ms === null ? Infinity : r.ms)).sort((a, b) => a - b);
  const at = (p) => ms[Math.min(ms.length - 1, Math.ceil(p * ms.length) - 1)];
  return { n: ms.length, median: at(0.5), p95: at(0.95), max: ms.at(-1), atOrOver: runs.filter((r) => r.ms === null || r.ms >= LIMIT_MS).length };
}

async function series(name, { warmups, measured, profile, timed = true, s: given }) {
  const edit = EDITS[name];
  const s = given ?? await session({ profile });
  await boardIsFixture(s.token, s.plan.id, `${name}: before the series`);
  const base = await baseline(s.page);
  log(`board as saved: ${JSON.stringify(base)}`);
  const runs = [];
  for (let i = 0; i < warmups + measured; i++) {
    const started = Date.now();
    const r = await oneRun(s, edit, base);
    const kind = i < warmups ? `warm-up ${i + 1}` : `run ${i - warmups + 1}`;
    console.log(`  ${name} ${kind}: ${r.ms === null ? 'n/a' : `${r.ms} ms`}${r.error ? ` VOID (${r.error})` : ''}; server ${r.server.join(', ') || 'n/a'}; undo back to saved: ${r.undone}`);
    runs.push({ kind, ...r });
    if (r.error || !r.undone) { log(`STOPPED: run void or undo did not restore the board`); break; }
    const wait = started + RUN_GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
  }
  await boardIsFixture(s.token, s.plan.id, `${name}: after the series`);
  if (!given) await s.browser.close();
  const counted = runs.filter((r) => r.kind.startsWith('run'));
  const sum = summarise(counted);
  const fmtMs = (v) => (v === Infinity ? 'n/a' : `${v} ms`);
  const complete = counted.length === measured && counted.every((r) => !r.error);
  console.log(`${name}: ${sum.n} measured runs, median ${fmtMs(sum.median)}, p95 ${fmtMs(sum.p95)}, max ${fmtMs(sum.max)}, ${sum.atOrOver} at or over ${LIMIT_MS} ms`);
  if (timed) check(`PERF-01 ${name}`, `${measured} measured runs, each under ${LIMIT_MS} ms with the expected result`, complete && sum.atOrOver === 0, sum);
  else check(`PERF-01a ${name}`, 'the edit drew its expected result and Ctrl+Z brought back the saved board (time not judged: no profile)', complete && counted.every((r) => r.undone), counted.map((r) => r.ms));
  const file = path.join(EVIDENCE, `a-perf-01-${name.toLowerCase()}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(file, JSON.stringify({ edit: name, ...edit, profile: profile ? PROFILE : null, limitMs: LIMIT_MS, baseline: base, runs, summary: sum }, null, 1));
  log(`saved ${path.basename(file)}`);
}

if (part === 'a') {
  const s = await session({ profile: false });
  for (const name of ['V', 'P', 'C']) await series(name, { warmups: 0, measured: 1, profile: false, timed: false, s });
  await s.browser.close();
}

if (['V', 'P', 'C', 'O'].includes(part)) await series(part, { warmups: WARMUPS, measured: MEASURED, profile: true });

if (part === 'b') {
  const s = await session({ profile: true });
  const out = await s.page.evaluate(async () => {
    const health = [];
    for (let i = 0; i < 10; i++) {
      const t0 = performance.now();
      await fetch('/api/health', { cache: 'no-store' });
      health.push(+(performance.now() - t0).toFixed(1));
    }
    const js = performance.getEntriesByType('resource').filter((e) => e.name.endsWith('.js')).sort((a, b) => b.encodedBodySize - a.encodedBodySize)[0];
    const t0 = performance.now();
    const res = await fetch(js.name, { cache: 'no-store' });
    const bytes = (await res.arrayBuffer()).byteLength;
    return { health, js: { file: new URL(js.name).pathname, encodedBodySize: js.encodedBodySize, bytes, ms: +(performance.now() - t0).toFixed(1), encoding: res.headers.get('content-encoding') } };
  });
  console.log(`  /api/health ×10 (ms): ${out.health.join(', ')}`);
  console.log(`  largest JS ${out.js.file}: ${out.js.encodedBodySize} bytes on the wire (${out.js.bytes} decoded, ${out.js.encoding ?? 'no'} encoding), ${out.js.ms} ms; size / 1.25 MB/s = ${Math.round(out.js.encodedBodySize / 1250)} ms`);
  check('PERF-01b', 'every health request at least 50 ms', out.health.every((t) => t >= 50), out.health);
  await s.browser.close();
}

if (part === 'o-setup' || part === 'o-cleanup') {
  const a1 = (await signInApi(A1)).token;
  const r = part === 'o-setup'
    ? await call('PUT', OFFERING, { token: a1, body: { terms: [1, 2] } })
    : await call('DELETE', OFFERING, { token: a1 });
  check('PERF-01f', `${part}: 200 with terms ${part === 'o-setup' ? '[1, 2]' : 'null'}`, r.status === 200 && isDeepStrictEqual(r.json.terms, part === 'o-setup' ? [1, 2] : null), r.json);
  const cur = await call('GET', '/programs/APCS/curricula/2024', { token: a1, quiet: true });
  log(`CS420 in the curriculum: offeringTerms ${JSON.stringify(offeringOf(cur.json, 'CS420'))}`);
}

log(failureCount() ? `${failureCount()} FAIL(S)` : 'All checks ok');
