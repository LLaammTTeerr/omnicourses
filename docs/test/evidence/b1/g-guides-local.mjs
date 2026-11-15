// GUIDE-01i, j, k on a local test database seeded with `npm run db:seed -w src/backend -- --guide-fixtures`,
// and, in a second part, the mechanical checks of GUIDE-01b, c, d, f, g, h, l, m on the published G01 and G07.
// The local build is a commit LATER than the tested B1 build: the second part is not a B1 result.
// Usage: APP=http://localhost:5176 API=http://localhost:3056/api node g-guides-local.mjs
import { chromium, check, log, EVIDENCE } from './a-lib.mjs';

const APP = process.env.APP ?? 'http://localhost:5176';
const API = process.env.API ?? 'http://localhost:3056/api';
const get = async (path) => { const r = await fetch(API + path); const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch {} return { status: r.status, text, json }; };

const browser = await chromium.launch({ headless: true });
log(`Chromium ${browser.version()} headless, playwright-core 1.64.1; app ${APP}; API ${API}`);
async function open(lang, path) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.addInitScript((l) => localStorage.setItem('omnicourse.lang', l), lang);
  const page = await context.newPage();
  page.requests = [];
  page.on('request', (r) => page.requests.push({ url: r.url(), method: r.method(), auth: r.headers().authorization ?? null }));
  await page.goto(APP + path);
  await page.waitForLoadState('networkidle');
  return page;
}
const text = (page, sel) => page.locator(sel).first().innerText().catch(() => null);
const listed = (page) => page.locator('[data-test^="guide-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-test').replace('guide-', '')));
async function search(page, q) {
  await page.fill('#guide-search', q);
  await page.waitForTimeout(250);
  return (await listed(page)).sort();
}

const list = (await get('/guides')).json.guides;
log(`GET /api/guides: ${list.map((g) => `${g.id} [${Object.keys(g.texts).join(',')}]`).join('; ')}`);
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
log(`test day in Vietnam time: ${today}`);

// ------------------------------------------------------------------ GUIDE-01i
for (const [id, has, screen] of [['zz-vi-only', 'vi', 'en'], ['zz-en-only', 'en', 'vi']]) {
  const page = await open(screen, `/guides/${id}`);
  const h1 = await text(page, 'article.guide h1');
  const notes = await page.locator('article.guide header [role=note]').allInnerTexts();
  const notFound = await page.locator('[data-test="not-found"]').count();
  const steps = await page.locator('[data-test="steps"] li').count();
  check('GUIDE-01i', `${id} with the screen in ${screen}: shows the ${has} text, not blank and not "not found"`, notFound === 0 && steps > 0 && (has === 'vi' ? h1 === `Hướng dẫn thử ${id}` : h1 === `Test guide ${id}`), { h1, steps, notFound });
  check('GUIDE-01i', `${id}: a note says it exists only in that language`, notes.length === 1 && notes[0].length > 0, notes);
  if (id === 'zz-vi-only') await page.screenshot({ path: `${EVIDENCE}/g-guide-01i-vi-only-in-english.png` });
  await page.context().close();
}
for (const screen of ['vi', 'en']) {
  const page = await open(screen, '/guides');
  for (const id of ['zz-vi-only', 'zz-en-only']) {
    const found = await search(page, id);
    const chips = await page.locator(`[data-test="guide-${id}"] .chips`).innerText().catch(() => null);
    check('GUIDE-01i', `search "${id}" with the screen in ${screen} finds it`, found.length === 1 && found[0] === id, { found, chips: chips?.replace(/\n/g, ' | ') });
  }
  await page.context().close();
}

// ------------------------------------------------------------------ GUIDE-01j
const minus = (ymd, months) => { const [y, m, d] = ymd.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1 - months, 1)); const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate(); t.setUTCDate(Math.min(d, last)); return t.toISOString().slice(0, 10); };
const dayBefore = (ymd) => new Date(Date.parse(ymd + 'T00:00:00Z') - 86_400_000).toISOString().slice(0, 10);
const edge = minus(today, 6);
const expected = { 'zz-fresh': [today, false], 'zz-six-months': [edge, false], 'zz-six-months-and-a-day': [dayBefore(edge), true] };
const fmt = (ymd, lang) => { const [y, m, d] = ymd.split('-'); return lang === 'vi' ? `${d}/${m}/${y}` : null; };
for (const [id, [on, stale]] of Object.entries(expected)) {
  const apiText = (await get(`/guides/${id}`)).json.texts.vi;
  check('GUIDE-01j', `${id}: the API gives version 1 and last checked ${on} (worked out here from the test day), outOfDate ${stale}`, apiText.version === 1 && apiText.lastCheckedOn === on && apiText.outOfDate === stale, { version: apiText.version, lastCheckedOn: apiText.lastCheckedOn, outOfDate: apiText.outOfDate });
  for (const lang of ['vi', 'en']) {
    const page = await open(lang, `/guides/${id}`);
    const version = (await text(page, '[data-test="version"]'))?.replace(/\n/g, ' | ');
    const warning = await page.locator('[data-test="out-of-date"]').allInnerTexts();
    const steps = await page.locator('[data-test="steps"] li').count();
    const portal = await page.locator('[data-test="open-portal"]').count();
    const dateShown = lang === 'vi' ? version?.includes(fmt(on, 'vi')) : /\d{4}/.test(version ?? '');
    check('GUIDE-01j', `${id} (${lang}): shows its version and last-checked date`, !!version && /1/.test(version) && dateShown, version);
    check('GUIDE-01j', `${id} (${lang}): ${stale ? 'warns that the portal may have changed, with the date' : 'no out-of-date warning'}`, stale ? warning.length === 1 && (lang !== 'vi' || warning[0].includes(fmt(on, 'vi'))) : warning.length === 0, warning.map((w) => w.replace(/\n/g, ' | ')));
    check('GUIDE-01j', `${id} (${lang}): fully readable (steps and the portal link are there)`, steps === 2 && portal === 1, { steps, portal });
    if (stale && lang === 'vi') await page.screenshot({ path: `${EVIDENCE}/g-guide-01j-out-of-date.png` });
    await page.context().close();
  }
}

// ------------------------------------------------------------------ GUIDE-01k
const unknown = await get('/guides/no-such-guide');
for (const id of ['zz-draft', 'zz-withdrawn']) {
  const r = await get(`/guides/${id}`);
  check('GUIDE-01k', `GET /api/guides/${id}: the same answer as the unknown guide`, r.status === 404 && r.text === unknown.text, `${r.status} ${r.text}`);
  check('GUIDE-01k', `${id} is not in GET /api/guides`, !list.some((g) => g.id === id), list.map((g) => g.id));
  for (const lang of ['vi', 'en']) {
    const page = await open(lang, '/guides');
    const found = await search(page, id);
    const noMatch = await page.locator('[data-test="no-match"]').count();
    check('GUIDE-01k', `search "${id}" (${lang}): not listed, not found`, found.length === 0 && noMatch === 1, { found, noMatch });
    await page.context().close();
  }
  const page = await open('vi', `/guides/${id}`);
  const ref = await open('vi', '/guides/no-such-guide');
  const a = await text(page, '[data-test="not-found"]');
  const b = await text(ref, '[data-test="not-found"]');
  const apiCall = page.requests.find((q) => q.url.includes(`/api/guides/${id}`));
  check('GUIDE-01k', `/guides/${id} shows the same page as the unknown guide`, !!a && a === b && (await page.locator('article.guide').count()) === 0, a?.replace(/\n/g, ' | '));
  check('GUIDE-01k', `/guides/${id}: the page asked the API for it`, !!apiCall, apiCall?.url.replace(API, '/api'));
  if (id === 'zz-draft') await page.screenshot({ path: `${EVIDENCE}/g-guide-01k-draft.png` });
  await page.context().close(); await ref.context().close();
}

// ================================================================== Seen on a later commit, not on the tested build
console.log('\n=== LATER COMMIT ONLY: G01 (accounts-and-portals) and G07 (grades-and-transcript) as published by #112. Not a result for the B1 build. ===');
const L = 'later';
const real = ['accounts-and-portals', 'grades-and-transcript'];
{
  const page = await open('vi', '/guides');
  const groups = await page.locator('#guide-results h2').allInnerTexts();
  log(`groups on the list (with the zz-* guides loaded too): ${groups.join(' | ')}`);
  for (const id of real) {
    const entry = page.locator(`[data-test="guide-${id}"]`);
    const title = await entry.locator('[data-test="title"]').innerText();
    const meta = (await entry.locator('.meta').innerText()).replace(/\n/g, ' ');
    const link = entry.locator('[data-test="portal"]');
    const attrs = await link.evaluate((a) => ({ tag: a.tagName, href: a.getAttribute('href'), target: a.target, rel: a.rel }));
    const want = list.find((g) => g.id === id).texts.vi.portal.url;
    check(L, `GUIDE-01b: ${id} is listed with its task, portal, account and direct link`, !!title && meta.length > 3 && !!attrs.href, { title, meta });
    check(L, `GUIDE-01f: ${id}: the list link is an <a> with exactly the content file's address, new tab, rel noopener`, attrs.tag === 'A' && attrs.href === want && attrs.target === '_blank' && /noopener/.test(attrs.rel), attrs);
  }
  await page.context().close();
}
const queries = [['bảng điểm', 'grades-and-transcript'], ['bang diem', 'grades-and-transcript'], ['transcript', 'grades-and-transcript'], ['tài khoản', 'accounts-and-portals'], ['tai khoan', 'accounts-and-portals'], ['%', null], ['_', null], ["'", null], ['\\', null], ['a'.repeat(500), null], ['xyzzy', null]];
for (const lang of ['vi', 'en']) {
  const page = await open(lang, '/guides');
  for (const [q, want] of queries) {
    const found = (await search(page, q)).filter((id) => !id.startsWith('zz-'));
    const all = await listed(page);
    const label = q.length > 20 ? '500 letters a' : q;
    if (want) check(L, `GUIDE-01c (${lang}): "${label}" lists ${want} among the real guides`, found.length === 1 && found[0] === want, { real: found, withTestGuides: all });
    else check(L, `GUIDE-01c/d (${lang}): "${label}" lists nothing, with the no-match message`, all.length === 0 && (await page.locator('[data-test="no-match"]').count()) === 1, all);
  }
  const noMatch = (await text(page, '[data-test="no-match"]'))?.replace(/\n/g, ' | ');
  const suggest = await page.getByText(/Suggest a guide|Đề xuất hướng dẫn|advisor|cố vấn/i).count();
  check(L, `GUIDE-01d (${lang}): the no-match message shows task groups; no Suggest-a-guide or advisor link`, !!noMatch && suggest === 0, noMatch);
  const back = await search(page, '');
  check(L, `GUIDE-01d (${lang}): cleared, the two real guides are back`, real.every((id) => back.includes(id)), back);
  await page.context().close();
}
for (const id of real) {
  const page = await open('vi', `/guides/${id}`);
  const h1vi = await text(page, 'article.guide h1');
  await page.reload(); await page.waitForLoadState('networkidle');
  check(L, `GUIDE-01g: /guides/${id} opens directly, signed out, and again after a reload`, !!h1vi && (await text(page, 'article.guide h1')) === h1vi, h1vi);
  const portal = await page.locator('[data-test="open-portal"]').evaluate((a) => ({ tag: a.tagName, href: a.getAttribute('href'), target: a.target, rel: a.rel }));
  const want = list.find((g) => g.id === id).texts.vi.portal.url;
  check(L, `GUIDE-01f: ${id}: "Open portal" is an <a> with exactly the content file's address, new tab, rel noopener`, portal.tag === 'A' && portal.href === want && portal.target === '_blank' && /noopener/.test(portal.rel), portal);
  const counts = await page.evaluate(() => ({ passwordFields: document.querySelectorAll('input[type=password]').length, forms: document.querySelectorAll('form').length }));
  const hosts = [...new Set(page.requests.map((q) => new URL(q.url).host))];
  check(L, `GUIDE-01m: ${id}: no password field, no form, and no request to a portal address`, counts.passwordFields === 0 && counts.forms === 0 && !hosts.some((h) => /hcmus|example\.com/.test(h)), { ...counts, hosts });
  const apiCalls = page.requests.filter((q) => q.url.startsWith(API));
  check(L, `GUIDE-01l: ${id}: signed out, no API request carries an Authorization header`, apiCalls.length > 0 && apiCalls.every((q) => q.auth === null), apiCalls.map((q) => `${q.method} ${q.url.replace(API, '/api')}`));
  const body = (await get(`/guides/${id}`)).text;
  check(L, `GUIDE-01l: ${id}: the response holds no email, display name, program, cohort, transcript or plan field`, !/"(email|displayName|display_name|program|cohort|transcript|plans?)"\s*:/.test(body) && !/@example\.com|Test Student/.test(body), `${body.length} bytes; top-level keys: ${Object.keys(JSON.parse(body)).join(', ')}`);
  const version = (await text(page, '[data-test="version"]'))?.replace(/\n/g, ' | ');
  const en = await open('en', `/guides/${id}`);
  const h1en = await text(en, 'article.guide h1');
  const versionEn = (await text(en, '[data-test="version"]'))?.replace(/\n/g, ' | ');
  check(L, `GUIDE-01h: ${id}: the title and text change language, the address does not; version and date in each language's format`, !!h1en && h1en !== h1vi && new URL(en.url()).pathname === `/guides/${id}`, { vi: h1vi, en: h1en, versionVi: version, versionEn });
  if (id === 'grades-and-transcript') await page.screenshot({ path: `${EVIDENCE}/g-later-g07-vi.png` });
  await en.context().close(); await page.context().close();
}
const item = await get('/guides/accounts-and-portals');
check(L, 'GUIDE-01n: GET /api/guides/{id} without a token answers 200 for a published guide', item.status === 200, item.status);
await browser.close();
