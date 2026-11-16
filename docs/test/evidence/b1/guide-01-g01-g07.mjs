// TC-B1-GUIDE-01 run again on G01 and G07 after #112 (docs/test/test-cases-b1.md §3), signed out, on production.
//
//   node guide-01-g01-g07.mjs > guide-01-g01-g07-output.txt
//
// Optional: B1_BASE (default https://omnicourses.lamter.cc), B1_REPO (the checkout whose content files and
// node_modules/playwright are used). Uses no account, no token and no password. GUIDE-01a is a reading of the
// content files and PR #112 (results file). GUIDE-01e and the signed-in half of GUIDE-01l need S1 and are done by hand.
// Screenshots are written next to this script as guide-01-rerun-*.png; they show public guide pages only.

import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = process.env.B1_REPO ?? join(HERE, '../../../..');
const req = createRequire(join(REPO, 'package.json'));
const { chromium } = req('playwright');
const PW_VERSION = req('playwright/package.json').version;
const BASE = (process.env.B1_BASE ?? 'https://omnicourses.lamter.cc').replace(/\/$/, '');
const HOST = new URL(BASE).host;

const PUBLISHED = ['accounts-and-portals', 'grades-and-transcript'];
const DRAFTS = ['register-courses', 'pay-tuition'];
const CODE = { 'accounts-and-portals': 'G01', 'register-courses': 'G02', 'pay-tuition': 'G06', 'grades-and-transcript': 'G07' };
const LIVE_CODES = PUBLISHED.map((id) => CODE[id]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString(), ...a);
const tally = { ok: 0, fail: 0, blocked: 0 };
function check(id, label, ok, observed) {
  tally[ok ? 'ok' : 'fail']++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${id}: ${label}${observed === undefined ? '' : ` | observed: ${typeof observed === 'string' ? observed : JSON.stringify(observed)}`}`);
  return ok;
}
/** A part of a case that cannot pass while G02 and G06 are drafts: neither a pass nor a defect. */
function blocked(id, label, observed) {
  tally.blocked++;
  console.log(`BLOCKED ${id}: ${label} | observed: ${typeof observed === 'string' ? observed : JSON.stringify(observed)}`);
}
const oneLine = (s) => (s ?? '').replace(/\s+/g, ' ').trim();

async function http(method, path, { body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'User-Agent': 'B1 GUIDE-01 rerun (Node fetch)', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, text, json };
}

/** Every https address in a guide's two content files: what each link on its page must equal exactly. */
function contentUrls(id) {
  const urls = new Set();
  for (const lang of ['vi', 'en']) {
    const src = readFileSync(join(REPO, `src/backend/src/guides/content/${id}.${lang}.ts`), 'utf8');
    for (const u of src.match(/https:\/\/[^'"`\s]+/g) ?? []) urls.add(u);
  }
  return urls;
}

/** JSON keys anywhere in a body that would be personal data (GUIDE-01l). */
const PERSONAL_KEYS = /^(email|displayName|display_name|program|programId|cohort|transcript|transcripts|plan|plans|planId|user|userId|user_id|token|password|passwordHash)$/i;
function personalKeys(value, found = new Set()) {
  if (Array.isArray(value)) value.forEach((v) => personalKeys(v, found));
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) { if (PERSONAL_KEYS.test(k)) found.add(k); personalKeys(v, found); }
  return found;
}

const browser = await chromium.launch({ channel: 'chrome', headless: true });
log(`Chrome ${browser.version()} (headless) through Playwright ${PW_VERSION}; server ${BASE}`);

/** A new private context (no storage, no cookies), screen language set before the app starts. */
async function newPage(lang = 'vi') {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript((l) => { try { if (!localStorage.getItem('omnicourse.lang')) localStorage.setItem('omnicourse.lang', l); } catch {} }, lang);
  const page = await context.newPage();
  page.errors = [];
  page.requests = [];
  page.guideResponses = [];
  page.on('console', (m) => m.type() === 'error' && page.errors.push(m.text()));
  page.on('pageerror', (e) => page.errors.push(`pageerror: ${e.message}`));
  page.on('request', (r) => page.requests.push({ url: r.url(), method: r.method(), auth: Boolean(r.headers().authorization) }));
  page.on('response', async (r) => {
    if (!r.url().includes('/api/guides')) return;
    let body = null;
    try { body = await r.text(); } catch {}
    page.guideResponses.push({ path: r.url().replace(BASE, ''), status: r.status(), auth: Boolean(r.request().headers().authorization), body });
  });
  return page;
}
const listedIds = (page) => page.$$eval('[data-test^="guide-"]', (lis) => lis.map((li) => li.dataset.test.replace(/^guide-/, '')));
const mainText = async (page) => oneLine(await page.locator('main').innerText());

// ------------------------------------------------------------------ API: what production serves (GUIDE-01n, l)
log('---- API, no token');
const list = await http('GET', '/api/guides');
const listIdsApi = list.json?.guides?.map((g) => g.id) ?? [];
log('GET /api/guides:', list.status, JSON.stringify(listIdsApi), `${list.text.length} bytes`);
const bodies = { '/api/guides': list.text };
for (const id of [...PUBLISHED, ...DRAFTS, 'no-such-guide']) {
  const r = await http('GET', `/api/guides/${id}`);
  bodies[`/api/guides/${id}`] = r.text;
  const t = r.json?.texts ?? {};
  log(`GET /api/guides/${id}:`, r.status, r.status === 200 ? `langs ${Object.keys(t)}; ${['vi', 'en'].map((l) => t[l] && `${l}: "${t[l].title}" v${t[l].version} checked ${t[l].lastCheckedOn} by ${t[l].lastCheckedBy}`).filter(Boolean).join('; ')}` : r.text.slice(0, 120));
}
check('GUIDE-01n', 'GET /api/guides answers 200 without a token and lists exactly G01 and G07 (G02 and G06 are drafts)', list.status === 200 && JSON.stringify([...listIdsApi].sort()) === JSON.stringify([...PUBLISHED].sort()), `${list.status} ${JSON.stringify(listIdsApi)}`);

// ------------------------------------------------------------------ GUIDE-01b: the list, signed out, Vietnamese
log('---- GUIDE-01b');
const lp = await newPage('vi');
await lp.goto(`${BASE}/guides`, { waitUntil: 'networkidle' });
await lp.waitForSelector('[data-test^="guide-"]', { timeout: 15000 });
const sections = await lp.$$eval('section.group', (secs) => secs.map((s) => ({
  group: document.getElementById(s.getAttribute('aria-labelledby'))?.textContent.trim(),
  entries: [...s.querySelectorAll('li.entry')].map((li) => {
    const a = li.querySelector('[data-test=portal]');
    return {
      id: li.dataset.test.replace(/^guide-/, ''),
      title: li.querySelector('[data-test=title]')?.textContent.trim(),
      meta: li.querySelector('.meta')?.textContent.replace(/\s+/g, ' ').trim(),
      chips: li.querySelector('.chips')?.textContent.replace(/\s+/g, ' ').trim(),
      link: a && { href: a.getAttribute('href'), text: a.textContent.replace(/\s+/g, ' ').trim(), target: a.target, rel: a.rel },
    };
  }),
})));
for (const s of sections) for (const e of s.entries) log(`list [${s.group}] ${CODE[e.id] ?? e.id}: "${e.title}" | ${e.meta} | ${e.chips} | link ${JSON.stringify(e.link)}`);
const groupOf = Object.fromEntries(sections.flatMap((s) => s.entries.map((e) => [e.id, s.group])));
const everyEntryComplete = sections.every((s) => s.entries.every((e) => e.title && e.meta && e.link?.href?.startsWith('https://')));
check('GUIDE-01b', 'G01 is listed under "Tài khoản và cổng" (Accounts and portals) and G07 under the records group, with task, portal, account and direct link', groupOf['accounts-and-portals'] && groupOf['grades-and-transcript'] && everyEntryComplete && Object.keys(groupOf).length === 2, groupOf);
blocked('GUIDE-01b', 'the list shows the four B1 guides (G02 under Registration, G06 under Tuition and fees)', `${Object.keys(groupOf).length} listed: ${Object.keys(groupOf).map((id) => CODE[id] ?? id).join(', ')}; G02 and G06 are drafts`);
await lp.screenshot({ path: join(HERE, 'guide-01-rerun-list-vi.png'), fullPage: true });

// ------------------------------------------------------------------ GUIDE-01c: search, Vietnamese then English
const QUERIES = [
  ['học phí', ['G06']], ['hoc phi', ['G06']], ['HỌC PHÍ', ['G06']], ['  hoc   phi  ', ['G06'], 'spaces around and between'],
  ['học phí'.normalize('NFD'), ['G06'], 'học phí as decomposed Unicode (NFD)'],
  ['hoc ph', ['G02', 'G06', 'G07']], ['tuition', ['G06']], ['đăng ký học phần', ['G02']], ['dang ky hoc phan', ['G02']],
  ['ĐĂNG KÝ', ['G02']], ['dkhp', ['G02']], ['register', ['G02']], ['bảng điểm', ['G07']], ['bang diem', ['G07']],
  ['transcript', ['G07']], ['tài khoản', ['G01']], ['tai khoan', ['G01']],
  ['%', []], ['_', []], ["'", []], ['\\', []], ['a'.repeat(500), [], '500 letters a'], ['', ['G01', 'G02', 'G06', 'G07'], 'empty'],
];
for (const lang of ['vi', 'en']) {
  log(`---- GUIDE-01c, screen in ${lang}`);
  if (lang === 'en') {
    const before = lp.url();
    await lp.click('.lang-btn');
    await sleep(400);
    log('switched with the language button; html lang =', await lp.getAttribute('html', 'lang'), '| address unchanged:', lp.url() === before);
  }
  let allOk = true;
  for (const [q, expected, label] of QUERIES) {
    await lp.fill('input[type=search]', q);
    await sleep(350);
    const ids = (await listedIds(lp)).map((id) => CODE[id] ?? id).sort();
    const noMatch = await lp.locator('[data-test="no-match"]').count();
    const want = expected.filter((c) => LIVE_CODES.includes(c)).sort();
    const ok = JSON.stringify(ids) === JSON.stringify(want) && (want.length > 0 || noMatch === 1);
    allOk &&= ok;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} [${lang}] ${JSON.stringify(label ?? q)} -> ${ids.join(', ') || (noMatch ? 'no-match message' : 'nothing, no message')} | case expects ${expected.join(', ') || 'none'}; with G02/G06 drafts: ${want.join(', ') || 'none + message'}`);
  }
  check('GUIDE-01c', `[${lang}] every query lists exactly its expected guides among G01 and G07, or the A2 message`, allOk);
  // The list narrows as you type.
  await lp.fill('input[type=search]', '');
  await sleep(300);
  const counts = [(await listedIds(lp)).length];
  for (const ch of 'tai khoan') { await lp.keyboard.type(ch); await sleep(250); counts.push((await listedIds(lp)).length); }
  check('GUIDE-01c', `[${lang}] typing "tai khoan" one key at a time narrows the list and never widens it`, counts.every((c, i) => i === 0 || c <= counts[i - 1]) && counts.at(-1) === 1, counts.join(' → '));
  check('GUIDE-01c', `[${lang}] no error while searching`, lp.errors.length === 0, lp.errors);
}

// ------------------------------------------------------------------ GUIDE-01d: no match, then cleared (both languages)
// UC-10 A2: "shows the task groups to browse". The page offers the groups that have a published guide
// (GuidesView.vue, groupsWithGuides), so with G01 and G07 that is two groups.
const groupsWithGuides = new Set(list.json.guides.map((g) => g.group)).size;
for (const lang of ['en', 'vi']) {
  log(`---- GUIDE-01d, screen in ${lang}`);
  if (lang === 'vi') { await lp.click('.lang-btn'); await sleep(400); }
  await lp.fill('input[type=search]', 'xyzzy');
  await sleep(350);
  const card = lp.locator('[data-test="no-match"]');
  const cardText = (await card.count()) ? oneLine(await card.innerText()) : null;
  const groupsShown = (await card.count()) ? await card.locator('ul.groups li').count() : 0;
  const body = await mainText(lp);
  const links = await lp.$$eval('main a', (as) => as.map((a) => a.getAttribute('href')));
  log(`xyzzy [${lang}]: ${cardText} | group items ${groupsShown} | links on page ${JSON.stringify(links)}`);
  check('GUIDE-01d', `[${lang}] "xyzzy": the page says no guide covers it yet and shows the task groups`, cardText !== null && groupsShown === groupsWithGuides, { groupsShown, groupsWithAGuide: groupsWithGuides });
  check('GUIDE-01d', `[${lang}] no Suggest a guide and no advisor link (B3)`, !/suggest a guide|đề xuất hướng dẫn|gợi ý hướng dẫn|advisor|cố vấn/i.test(body) && !links.some((h) => /advisor|suggest/i.test(h ?? '')));
  if (lang === 'vi') await lp.screenshot({ path: join(HERE, 'guide-01-rerun-no-match-vi.png'), fullPage: true });
  await lp.fill('input[type=search]', '');
  await sleep(350);
  const back = await listedIds(lp);
  check('GUIDE-01d', `[${lang}] once cleared, every published guide is back`, back.length === PUBLISHED.length, back.map((id) => CODE[id]).join(', '));
}

// ------------------------------------------------------------------ GUIDE-01h on the list
log('---- GUIDE-01h, list');
{
  const p = await newPage('vi');
  await p.goto(`${BASE}/guides`, { waitUntil: 'networkidle' });
  await p.waitForSelector('[data-test^="guide-"]');
  const read = () => p.$$eval('section.group', (secs) => secs.map((s) => `${document.getElementById(s.getAttribute('aria-labelledby'))?.textContent.trim()}: ${[...s.querySelectorAll('li.entry')].map((li) => `${li.querySelector('[data-test=title]')?.textContent.trim()} [${li.querySelector('.chips')?.textContent.replace(/\s+/g, ' ').trim()}]`).join('; ')}`));
  const vi = await read(); const urlVi = p.url();
  await p.click('.lang-btn'); await sleep(400);
  const en = await read(); const urlEn = p.url();
  log('vi:', JSON.stringify(vi)); log('en:', JSON.stringify(en));
  check('GUIDE-01h', 'list: titles, group names and the checked-on chip change language; the address does not change', JSON.stringify(vi) !== JSON.stringify(en) && urlVi === urlEn, { urlVi, urlEn });
}

// ------------------------------------------------------------------ Each published guide: f, h, l, m and UC-10 step 5
for (const id of PUBLISHED) {
  const code = CODE[id];
  log(`---- ${code} (${id})`);
  const p = await newPage('vi');
  await p.goto(`${BASE}/guides/${id}`, { waitUntil: 'networkidle' });
  await p.waitForSelector('h1');
  const urls = contentUrls(id);

  // UC-10 step 5, as seen on G01 and G07 (GUIDE-01e itself is on G02, a draft).
  const parts = await p.evaluate(() => ({
    h1: document.querySelector('main h1')?.textContent.trim(),
    headings: [...document.querySelectorAll('main h2, main h3')].map((h) => h.textContent.trim()),
    steps: document.querySelectorAll('[data-test=steps] > li').length,
    board: document.querySelectorAll('[data-test=board] > li').length,
    version: document.querySelector('[data-test=version]')?.innerText.replace(/\s*\n\s*/g, ' / ').trim(),
    outOfDate: Boolean(document.querySelector('[data-test=out-of-date]')),
  }));
  log(`${code} page:`, JSON.stringify(parts));

  // GUIDE-01f: every link on the page.
  const anchors = await p.$$eval('main a', (as) => as.map((a) => ({ href: a.getAttribute('href'), target: a.target, rel: a.rel, text: a.textContent.replace(/\s+/g, ' ').trim().slice(0, 70) })));
  const external = anchors.filter((a) => /^https?:/.test(a.href));
  const internal = anchors.filter((a) => !/^https?:/.test(a.href));
  for (const a of external) log(`  link ${a.href} | target=${a.target} rel="${a.rel}" | in content file: ${urls.has(a.href)} | "${a.text}"`);
  for (const a of internal) log(`  in-app link ${a.href} | "${a.text}"`);
  check('GUIDE-01f', `${code}: every outside link is an <a href> equal to an address of the content file, opening in a new tab with rel noopener`, external.length > 0 && external.every((a) => urls.has(a.href) && a.target === '_blank' && /\bnoopener\b/.test(a.rel)), `${external.length} outside links`);
  const openBtn = p.locator('[data-test=open-portal]');
  const openHref = await openBtn.getAttribute('href');
  const apiPortal = JSON.parse(bodies[`/api/guides/${id}`]).texts.vi.portal.url;
  const before = p.url();
  const [popup] = await Promise.all([p.waitForEvent('popup', { timeout: 15000 }), openBtn.click()]);
  await popup.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {});
  const firstNav = popup.url();
  await sleep(1500);
  log(`  Open portal: href ${openHref}; the new tab is at ${popup.url()} ("${await popup.title().catch(() => '?')}")`);
  check('GUIDE-01f', `${code}: "Mở …" opens ${apiPortal} in a new tab, with no query added, and the OmniCourse tab stays where it was`, openHref === apiPortal && urls.has(openHref) && p.url() === before && Boolean(firstNav), { openHref, newTab: popup.url(), omnicourseTab: p.url() });
  await popup.close();

  // GUIDE-01m: no password field, no form, no request to a portal from the OmniCourse page.
  const pw = await p.evaluate(() => document.querySelectorAll('input[type=password]').length);
  const forms = await p.evaluate(() => document.querySelectorAll('form').length);
  const portalHosts = new Set([...urls].map((u) => new URL(u).host));
  const offsite = p.requests.filter((r) => new URL(r.url).host !== HOST);
  log(`  requests from the OmniCourse tab to other hosts: ${JSON.stringify([...new Set(offsite.map((r) => new URL(r.url).host))])}`);
  check('GUIDE-01m', `${code}: no password field and no form on the page`, pw === 0 && forms === 0, { password: pw, forms });
  check('GUIDE-01m', `${code}: the OmniCourse tab sends no request to a portal address, before or after pressing its link`, !offsite.some((r) => portalHosts.has(new URL(r.url).host)));
  if (id === 'accounts-and-portals') {
    const text = await mainText(p);
    const sentence = text.match(/[^.]*kể cả OmniCourse[^.]*\./)?.[0];
    check('GUIDE-01m', 'G01 tells the student never to give their portal password to anyone, OmniCourse included', Boolean(sentence), sentence);
  }

  // GUIDE-01l, signed out.
  const gr = p.guideResponses;
  log(`  guide API requests: ${JSON.stringify(gr.map((r) => `${r.path} ${r.status} auth:${r.auth ? 'yes' : 'no'}`))}`);
  const keys = new Set(gr.flatMap((r) => { try { return [...personalKeys(JSON.parse(r.body))]; } catch { return []; } }));
  check('GUIDE-01l', `${code}: signed out, no guide request carries Authorization, and the bodies hold no personal field`, gr.length > 0 && gr.every((r) => !r.auth) && keys.size === 0, { requests: gr.length, personalKeys: [...keys] });
  check('GUIDE-01l', `${code}: the page's guide response is byte-for-byte the API's answer to a plain request`, gr.find((r) => r.path === `/api/guides/${id}`)?.body === bodies[`/api/guides/${id}`]);

  await p.screenshot({ path: join(HERE, `guide-01-rerun-${code.toLowerCase()}-vi.png`), fullPage: true });

  // GUIDE-01h on the guide.
  const readGuide = () => p.evaluate(() => ({
    h1: document.querySelector('main h1')?.textContent.trim(),
    crumb: document.querySelector('main nav, .crumbs, .breadcrumb')?.textContent.replace(/\s+/g, ' ').trim(),
    firstStep: document.querySelector('[data-test=steps] > li')?.textContent.replace(/\s+/g, ' ').trim().slice(0, 80),
    version: document.querySelector('[data-test=version]')?.innerText.replace(/\s*\n\s*/g, ' / ').trim(),
    lang: document.documentElement.lang,
  }));
  const vi = await readGuide(); const urlVi = p.url();
  await p.click('.lang-btn'); await sleep(500);
  const en = await readGuide(); const urlEn = p.url();
  log('  vi:', JSON.stringify(vi)); log('  en:', JSON.stringify(en));
  const num = (s) => s?.match(/\d+/)?.[0];
  check('GUIDE-01h', `${code}: title, group and text change language; the version number stays; the address does not change`, vi.h1 !== en.h1 && vi.firstStep !== en.firstStep && num(vi.version) === num(en.version) && urlVi === urlEn && vi.lang === 'vi' && en.lang === 'en', { urlVi, urlEn });
  log(`  GUIDE-01h ${code} dates: vi "${vi.version}" | en "${en.version}" (judged by eye: same day, each in its language's format)`);
  check(`GUIDE-01`, `${code}: no console error on the page`, p.errors.length === 0, p.errors);
}

// ------------------------------------------------------------------ GUIDE-01g: deep links in a fresh private context
log('---- GUIDE-01g');
for (const id of PUBLISHED) {
  const p = await newPage('vi');
  await p.goto(`${BASE}/guides/${id}`, { waitUntil: 'networkidle' });
  const first = await p.locator('main h1').textContent();
  await p.reload({ waitUntil: 'networkidle' });
  const again = await p.locator('main h1').textContent();
  const nf = await p.locator('[data-test="not-found"]').count();
  check('GUIDE-01g', `${CODE[id]}: /guides/${id} opens directly in a new private context, signed out, and again after a reload`, nf === 0 && first === again && Boolean(first?.trim()), { first, afterReload: again });
}
for (const id of ['no-such-guide', ...DRAFTS]) {
  const p = await newPage('vi');
  await p.goto(`${BASE}/guides/${id}`, { waitUntil: 'networkidle' });
  const card = p.locator('[data-test="not-found"]');
  const shown = await card.count();
  const link = shown ? await card.locator('a').first().getAttribute('href') : null;
  const apiStatus = p.guideResponses.find((r) => r.path === `/api/guides/${id}`)?.status;
  const label = id === 'no-such-guide' ? 'the unknown address' : `${CODE[id]} (draft) at /guides/${id}`;
  check(id === 'no-such-guide' ? 'GUIDE-01g' : 'GUIDE-01g (info)', `${label} shows "guide not found" with a link to Guides, and its API request answers 404`, shown === 1 && link === '/guides' && apiStatus === 404, { shown, link, apiStatus, text: shown ? oneLine(await card.innerText()) : null });
  if (id === 'no-such-guide') await p.screenshot({ path: join(HERE, 'guide-01-rerun-not-found-vi.png') });
}

// ------------------------------------------------------------------ GUIDE-01n: every route of the OpenAPI document, no token
log('---- GUIDE-01n');
const openapi = JSON.parse(readFileSync(join(REPO, 'src/backend/openapi.json'), 'utf8'));
const OPEN = { 'GET /api/health': [200], 'POST /api/auth/sign-up': [400], 'POST /api/auth/sign-in': [400], 'GET /api/guides': [200], 'GET /api/guides/{id}': [200] };
const statuses = {};
let unexpected = [];
for (const [path, ops] of Object.entries(openapi.paths)) {
  for (const method of Object.keys(ops).filter((m) => ['get', 'post', 'put', 'patch', 'delete'].includes(m))) {
    const key = `${method.toUpperCase()} ${path}`;
    const concrete = path.replace('{id}', path.startsWith('/api/guides') ? PUBLISHED[0] : '00000000-0000-0000-0000-000000000000').replace(/\{[^}]+\}/g, 'ZZ0000');
    const r = await http(method.toUpperCase(), concrete, { body: method === 'get' ? undefined : '{}' });
    statuses[r.status] = (statuses[r.status] ?? 0) + 1;
    const want = OPEN[key] ?? [401];
    if (!want.includes(r.status)) unexpected.push(`${key} -> ${r.status}`);
    if (OPEN[key]) log(`  ${key} -> ${r.status}`);
    await sleep(100);
  }
}
const guideOps = Object.entries(openapi.paths).filter(([p]) => p.startsWith('/api/guides')).flatMap(([p, ops]) => Object.keys(ops).map((m) => `${m.toUpperCase()} ${p}`));
log(`  every operation: ${JSON.stringify(statuses)}; guide operations in the document: ${JSON.stringify(guideOps)}`);
check('GUIDE-01n', 'guide routes answer 200 (404 for an unknown guide) and are GET only; every other route answers 401 except health, sign-up and sign-in', unexpected.length === 0 && guideOps.every((o) => o.startsWith('GET ')), unexpected.length ? unexpected : `${Object.values(statuses).reduce((a, b) => a + b, 0)} operations as expected`);

// ------------------------------------------------------------------ Where each outside address leads (information only)
log('---- outside addresses of G01 and G07 (information: status of a plain GET, no cookie)');
for (const u of new Set(PUBLISHED.flatMap((id) => [...contentUrls(id)]))) {
  try {
    const r = await fetch(u, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (B1 GUIDE-01 link check)' }, signal: AbortSignal.timeout(20000) });
    log(`  ${r.status} ${u}${r.url !== u ? ` -> ${r.url}` : ''}`);
  } catch (e) {
    log(`  error ${u}: ${e.cause?.code ?? e.message}`);
  }
}

await browser.close();
log(`done: ${tally.ok} ok, ${tally.fail} FAIL, ${tally.blocked} BLOCKED (G02 and G06 are drafts)`);
