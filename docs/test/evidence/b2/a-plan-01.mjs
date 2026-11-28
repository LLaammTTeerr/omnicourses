// TC-B2-PLAN-01a–f on staging (docs/test/test-cases-b2.md §2, cases 0.14). Synthetic b2- accounts only.
//   node a-plan-01.mjs <part>   part = a | b | c | d | e | f
// Account L (b2-s15) was signed up and onboarded through the API before part a. Each part signs in again in a new
// headless Chrome context at 1280 × 900 in English and opens L's "Default plan". Never prints a token.
import { isDeepStrictEqual } from 'node:util';
import { BASE, launch, newPage, signIn, settle, where, mark, sent, fmt, shot, focused, toasts, clearToasts, pageToken, sleep } from './b-lib.mjs';
import { call, check, failureCount, log, signInApi, PROGRAM } from './c-lib.mjs';

const part = process.argv[2];
const L = 'b2-s15@example.com';
const A1 = 'b2-a1@example.com';
const APCS24 = '4a941965-834b-4d5a-a9c3-91a0607c3cbc';
const OFFERING = `/admin/programs/${PROGRAM.APCS}/cohorts/${APCS24}/courses/CS420/offering-terms`;
log(`a-plan-01 ${part}`);

const T = (k) => `[data-test="term-${k}"]`;
const tile = (code) => `[data-test="tile-${code}"]`;
const cls = (page, sel) => page.locator(sel).first().getAttribute('class').catch(() => null);
const text = (page, sel) => page.locator(sel).first().innerText().catch(() => null);
const chip = (page) => text(page, '[data-test="save-state"]').then((s) => s?.trim());
const writes = (page, m) => sent(page, m).filter((r) => r.method !== 'GET' && !r.path.endsWith('/issues/drops'));
const drops = (page, m) => sent(page, m).filter((r) => r.path.endsWith('/issues/drops'));
const rowCodes = (page, key) => page.locator(`${T(key)} li[data-test^="tile-"]`).evaluateAll((l) => l.map((e) => e.dataset.test.slice(5)).filter((c) => c !== 'group' && c !== 'taken' && !c.startsWith('issue-')));
const board = async (page) => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-test^="term-"]')].filter((e) => e.tagName === 'SECTION').map((e) => [e.dataset.test.slice(5), [...e.querySelectorAll('li[data-test^="tile-"]')].map((t) => t.dataset.test.slice(5)).filter((c) => c !== 'group' && c !== 'taken' && !c.startsWith('issue-'))])));
const panel = (page) => text(page, '[data-test="issues-panel"]');
const announcer = (page) => page.locator('[data-test="announcer"]').textContent();

async function untilIdle(page, ms = 8000) {
  await sleep(400);
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const busy = await page.locator('[data-test="issues-panel"]').getAttribute('aria-busy').catch(() => 'true');
    const c = await chip(page);
    const stale = await page.locator('[data-test="issue-counts"].stale').count().catch(() => 1);
    if (busy === 'false' && c === 'Saved' && stale === 0) return true;
    await sleep(100);
  }
  return false;
}

/** Scrolls so that both points sit inside the viewport, away from the 80 px edge-scroll bands. Returns client points. */
async function frame(page, srcSel, dstSel) {
  const pageBox = async (sel) => page.locator(sel).first().evaluate((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y + scrollY, w: r.width, h: r.height }; });
  const s = await pageBox(srcSel);
  const d = dstSel ? await pageBox(dstSel) : null;
  const sy = s.y + Math.min(s.h / 2, 30);
  const dy = d ? d.y + Math.min(d.h / 2, 30) : sy;
  const top = Math.max(0, Math.min(sy, dy) - 160);
  await page.evaluate((y) => window.scrollTo(0, y), top);
  await sleep(150);
  const scroll = await page.evaluate(() => scrollY);
  return { src: { x: s.x + Math.min(s.w / 2, 60), y: sy - scroll }, dst: d && { x: d.x + d.w / 2, y: dy - scroll } };
}

async function grabAt(page, p) {
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x + 4, p.y + 4, { steps: 2 });
  await page.mouse.move(p.x + 12, p.y + 12, { steps: 3 });
  await sleep(150);
}
async function glide(page, to) {
  await page.mouse.move(to.x, to.y, { steps: 15 });
  await sleep(150);
}
/** Waits until no row is in the "checking" drop state. */
async function previewDone(page, ms = 6000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if ((await page.locator('section.trow.checking').count()) === 0) return true;
    await sleep(100);
  }
  return false;
}
/** Moves the pointer onto the row (top part), re-measuring after each preview so that growing rows do not shift it off. */
async function aim(page, sel) {
  for (let i = 0; i < 4; i++) {
    const b = await page.locator(sel).first().boundingBox();
    if (!b) return;
    if (b.y + 30 > 820) { await page.evaluate((dy) => window.scrollBy(0, dy), b.y + 30 - 600); await sleep(200); continue; }
    await glide(page, { x: b.x + b.width / 2, y: Math.max(b.y + Math.min(b.height / 2, 30), 90) });
    await previewDone(page);
    await sleep(150);
    const cl = (await cls(page, sel)) ?? '';
    if (/over/.test(cl)) return;
  }
}
async function search(page, q) {
  await page.fill('#course-search', q);
  await sleep(200);
}
async function pointerDrop(page, srcSel, dstSel) {
  const f = await frame(page, srcSel, dstSel);
  await grabAt(page, f.src);
  await glide(page, f.dst);
  await previewDone(page);
  await aim(page, dstSel);
  await page.mouse.up();
  await sleep(300);
}
async function act(page, code, name) {
  await page.locator(tile(code)).hover();
  await sleep(150);
  await page.locator(`${tile(code)} [data-test="${name}"]`).click();
}
async function ensureRow(page, key) {
  for (let i = 0; i < 5 && (await page.locator(T(key)).count()) === 0; i++) { await page.click('[data-test="add-row"]'); await sleep(250); console.log(`  setup: Add Term pressed (row ${key} needed; empty rows are not saved)`); }
}
async function chooseAddTo(page, label) {
  await page.locator('[data-test="add-to"]').click();
  await page.locator('[role="option"]', { hasText: label }).first().click();
  await sleep(150);
}
async function openPlan(page, name = 'Default plan') {
  await page.goto(`${BASE}/plans`, { waitUntil: 'networkidle' });
  await settle(page, 800);
  if ((await page.locator('h1').innerText()) !== name) {
    await page.locator('[data-test="plan-tab"]').filter({ hasText: new RegExp(`^\\s*${name}\\s*$`) }).click();
    await settle(page, 500);
  }
  await untilIdle(page);
}
async function planId(page) { return where(page).match(/\/plans\/([0-9a-f-]{36})/)?.[1]; }
async function apiPlan(page, id) { return (await call('GET', `/plans/${id}`, { token: await pageToken(page), quiet: true })).json; }
const terms = (plan) => plan.terms.map((t) => `${t.term.year}-${t.term.number}: ${t.placements.map((p) => p.courseCode ?? `slot(${p.credits})`).join(',')}`);

async function start() {
  const browser = await launch();
  const page = await newPage(browser, { lang: 'en', height: 900 });
  await signIn(page, L);
  await openPlan(page);
  const id = await planId(page);
  log(`plan ${id}; board ${JSON.stringify(await board(page))}`);
  return { browser, page, id };
}

async function rowsInfo(page) {
  return page.evaluate(() => [...document.querySelectorAll('section.trow[data-test^="term-"]')].map((e) => ({
    key: e.dataset.test.slice(5),
    cls: e.className.replace(/\s+/g, ' ').trim(),
    load: e.querySelector('[data-test="load"]')?.textContent.replace(/\s+/g, ' ').trim() ?? null,
    delta: e.querySelector('[data-test="load-delta"]')?.textContent.trim() ?? null,
    placeholder: e.querySelector('[data-test="placeholder"]')?.textContent.replace(/\s+/g, ' ').trim() ?? null,
    reason: e.querySelector('[data-test="drop-reason"]')?.textContent.trim() ?? null,
    flags: [...e.querySelectorAll('[data-test^="row-issue-"]')].map((x) => x.textContent.replace(/\s+/g, ' ').trim()),
  })));
}

if (part === 'a') {
  const { browser, page, id } = await start();
  console.log('--- PLAN-01a (1)');
  let m0 = mark(page);
  await page.click('[data-test="add-row"]');
  await sleep(300);
  console.log(`  setup: Add Term pressed once so that Term 2 2026–2027 exists; requests ${fmt(sent(page, m0))}`);
  await search(page, 'CS160');
  let m = mark(page);
  let f = await frame(page, '[data-test="pool-CS160"]', T('2026-1'));
  await grabAt(page, f.src);
  await previewDone(page);
  await glide(page, f.dst);
  await previewDone(page);
  const over1 = await rowsInfo(page);
  const prev1 = await text(page, '[data-test="issues-preview"]');
  await shot(page, 'a-plan-01a-hover.png');
  const f2 = await frame(page, '[data-test="pool-CS160"]', T('2026-2')).catch(() => null);
  if (f2) await glide(page, f2.dst);
  await sleep(300);
  const over2 = await rowsInfo(page);
  const prev2 = await text(page, '[data-test="issues-preview"]');
  console.log(`  hover 2026-1: ${JSON.stringify(over1)}; issues-preview "${prev1}"`);
  console.log(`  hover 2026-2: ${JSON.stringify(over2)}; issues-preview "${prev2}"`);
  const dropsBody = drops(page, m)[0]?.body;
  console.log(`  drop preview requests: ${fmt(drops(page, m))}; body targets ${dropsBody && JSON.stringify(JSON.parse(dropsBody).targets)}`);
  await page.keyboard.press('Escape');
  await sleep(700);
  const after1 = await rowsInfo(page);
  const ghosts = await page.locator('.ghost-tile').count();
  check('PLAN-01a', '(1) one batched POST …/issues/drops for the eligible rows and no PUT; rows show drop tone, placeholder CS160 +4 cr, load-delta +4, issues-preview',
    drops(page, m).length === 1 && writes(page, m).length === 0 && over1.some((r) => r.key === '2026-1' && /(ok|unknown|bad|warn)-drop/.test(r.cls) && /CS160/.test(r.placeholder ?? '') && /\+4/.test(r.placeholder ?? '') && r.delta === '+4') && !!prev1,
    { drops: drops(page, m).length, writes: fmt(writes(page, m)) });
  check('PLAN-01a', '(1) Escape: ghost gone, preview classes and placeholder cleared, no PUT',
    ghosts === 0 && after1.every((r) => !/-drop|checking/.test(r.cls) && !r.placeholder && !r.delta) && writes(page, m).length === 0, after1);

  console.log('--- PLAN-01a (2)');
  m = mark(page);
  await pointerDrop(page, '[data-test="pool-CS160"]', T('2026-1'));
  await untilIdle(page);
  const r2 = await rowsInfo(page);
  const p2 = await panel(page);
  console.log(`  requests ${fmt(sent(page, m))}`);
  console.log(`  rows ${JSON.stringify(r2)}`);
  console.log(`  issues panel: ${p2?.replace(/\s+/g, ' ')}`);
  const w2 = writes(page, m);
  const afterPut = sent(page, m).slice(sent(page, m).indexOf(w2[0]) + 1);
  check('PLAN-01a', '(2) one PUT …/placements 200, then GET …/issues 200; chip Saved; 4 / 22 credits; load_below_minimum flag citing Điều 7.2; requirement short counts',
    w2.length === 1 && w2[0].path.endsWith('/placements') && w2[0].status === 200 && afterPut.some((r) => r.method === 'GET' && r.path.endsWith('/issues') && r.status === 200) && (await chip(page)) === 'Saved' &&
    r2.find((r) => r.key === '2026-1')?.load?.startsWith('4 / 22') && /4 credits, below the minimum of 10/.test((await page.locator(`${T('2026-1')} [data-test^="row-issue-"]`).allTextContents()).join(' ') + p2) && /7\.2/.test(p2 + (await page.locator(`${T('2026-1')} [data-test^="row-issue-"]`).allTextContents()).join(' ')),
    { chip: await chip(page), load: r2.find((r) => r.key === '2026-1')?.load });

  console.log('--- PLAN-01a (3)');
  for (const code of ['CS163', 'CS201', 'CS202', 'MTH251', 'PH211']) {
    await search(page, code);
    m = mark(page);
    await pointerDrop(page, `[data-test="pool-${code}"]`, T('2026-1'));
    await untilIdle(page);
    console.log(`  ${code}: ${fmt(writes(page, m))}; row 2026-1 ${JSON.stringify(await rowCodes(page, '2026-1'))}`);
    await sleep(600);
  }
  await search(page, '');
  const r3 = await rowsInfo(page);
  const p3 = (await panel(page))?.replace(/\s+/g, ' ');
  console.log(`  rows ${JSON.stringify(r3)}`);
  console.log(`  issues panel: ${p3}`);
  await shot(page, 'a-plan-01a-24-credits.png');
  check('PLAN-01a', '(3) 24 credits in 2026-1: row has-flag and load_above_maximum "24 credits, above the maximum of 22. A petition can allow it." citing Điều 7.2',
    /has-flag/.test(r3.find((r) => r.key === '2026-1')?.cls ?? '') && p3.includes('24 credits, above the maximum of 22. A petition can allow it.') && /7\.2/.test(p3), r3.find((r) => r.key === '2026-1'));

  console.log('--- PLAN-01a (4)');
  m = mark(page);
  await pointerDrop(page, tile('PH211'), T('2026-2'));
  await untilIdle(page);
  const r4 = await rowsInfo(page);
  const p4 = (await panel(page))?.replace(/\s+/g, ' ');
  console.log(`  requests ${fmt(sent(page, m))}; rows ${JSON.stringify(r4)}`);
  console.log(`  issues panel: ${p4}`);
  const row1 = r4.find((r) => r.key === '2026-1'), row2 = r4.find((r) => r.key === '2026-2');
  check('PLAN-01a', '(4) PH211 moved: 2026-1 at 20 credits with no cap flag, 2026-2 at 4 credits flagged',
    row1?.load?.startsWith('20 /') && !/has-flag/.test(row1.cls) && row2?.load?.startsWith('4 /') && /has-flag/.test(row2.cls) && writes(page, m).length === 1, { row1, row2 });
  m = mark(page);
  f = await frame(page, tile('PH211'));
  await grabAt(page, f.src);
  await previewDone(page);
  const bin = await page.locator('[data-test="drop-bin"]').boundingBox();
  console.log(`  drop bin shown during the drag: ${JSON.stringify(bin)}`);
  if (bin) await glide(page, { x: bin.x + bin.width / 2, y: bin.y + bin.height / 2 });
  await sleep(200);
  await page.mouse.up();
  await sleep(400);
  await untilIdle(page);
  await search(page, 'PH211');
  const back = await page.locator('[data-test="pool-PH211"]').count();
  await search(page, '');
  console.log(`  requests ${fmt(sent(page, m))}; board ${JSON.stringify(await board(page))}`);
  check('PLAN-01a', '(4) dropping on the drop bin removes PH211, saves once, PH211 back in the pool',
    !!bin && (await page.locator(tile('PH211')).count()) === 0 && writes(page, m).length === 1 && back === 1, { writes: fmt(writes(page, m)), back });
  console.log(`  API: ${terms(await apiPlan(page, id)).join(' | ')}`);
  await browser.close();
}

if (part === 'b') {
  const { browser, page, id } = await start();
  console.log('--- PLAN-01b (1)');
  let m = mark(page);
  await search(page, 'cs469');
  const shown = await page.locator('[data-test^="pool-CS"]').evaluateAll((l) => l.map((e) => e.dataset.test));
  await chooseAddTo(page, 'Term 1 2026–2027');
  await page.locator('[data-test="add-CS469"]').focus();
  await page.keyboard.press('Enter');
  await untilIdle(page);
  const said1 = await announcer(page);
  await search(page, 'cs470');
  if ((await page.locator(T('2026-2')).count()) === 0) { await page.click('[data-test="add-row"]'); await sleep(300); console.log('  setup: Add Term pressed so that Term 2 2026–2027 exists (an empty row is not saved, so the reload of part b dropped it)'); }
  await chooseAddTo(page, 'Term 2 2026–2027');
  await page.locator('[data-test="add-CS470"]').focus();
  await page.keyboard.press('Enter');
  await untilIdle(page);
  const said2 = await announcer(page);
  await search(page, '');
  console.log(`  search cs469 showed ${JSON.stringify(shown)}; announcer "${said1}" then "${said2}"; requests ${fmt(writes(page, m))}`);
  check('PLAN-01b', '(1) search filters; CS469 → 2026-1 and CS470 → 2026-2 each saved and announced',
    isDeepStrictEqual(shown, ['pool-CS469']) && writes(page, m).length === 2 && said1 === 'Added CS469 to Term 1 2026–2027.' && said2 === 'Added CS470 to Term 2 2026–2027.' && (await rowCodes(page, '2026-1')).includes('CS469') && (await rowCodes(page, '2026-2')).includes('CS470'), await board(page));

  console.log('--- PLAN-01b (2)');
  m = mark(page);
  await page.click('[data-test="add-row"]');
  await sleep(300);
  console.log(`  setup: Add Term pressed once so that Term 3 2026–2027 exists (the board ended at 2026-2); requests ${fmt(sent(page, m))}`);
  m = mark(page);
  await page.locator(tile('CS470')).focus();
  await page.keyboard.press('Space');
  await sleep(200);
  const liftCls = await cls(page, tile('CS470'));
  const liftSaid = await announcer(page);
  await previewDone(page);
  await page.keyboard.press('ArrowDown');
  await sleep(300);
  const target = await page.locator('section.trow.drop-target').getAttribute('data-test');
  const targetSaid = await announcer(page);
  await previewDone(page);
  await page.keyboard.press('Escape');
  await sleep(400);
  const escWrites = writes(page, m).length;
  const escSaid = await announcer(page);
  check('PLAN-01b', '(2) Space lifts (class lifted, one batched POST …/issues/drops, announced); ArrowDown targets 2026-3 and announces it; Escape cancels with no PUT',
    / lifted/.test(` ${liftCls}`) && drops(page, m).length === 1 && liftSaid.startsWith('Lifted CS470 in Term 2 2026–2027') && target === 'term-2026-3' && targetSaid === 'CS470 would move to Term 3 2026–2027.' && escWrites === 0,
    { liftCls, drops: drops(page, m).length, liftSaid, target, targetSaid, escSaid });
  m = mark(page);
  await page.locator(tile('CS470')).focus();
  await page.keyboard.press('Space');
  await previewDone(page);
  await page.keyboard.press('ArrowDown');
  await previewDone(page);
  await page.keyboard.press('Enter');
  await untilIdle(page);
  const foc = await focused(page);
  check('PLAN-01b', '(2) Space, ArrowDown, Enter moves CS470 to 2026-3, saves once, focus stays on CS470',
    (await rowCodes(page, '2026-3')).includes('CS470') && writes(page, m).length === 1 && /tile-CS470/.test(foc), { writes: fmt(writes(page, m)), focus: foc });

  console.log('--- PLAN-01b (3)');
  m = mark(page);
  await act(page, 'CS470', 'earlier');
  await untilIdle(page);
  const foc3 = await focused(page);
  const at2 = (await rowCodes(page, '2026-2')).includes('CS470');
  check('PLAN-01b', '(3) "earlier" moves CS470 to 2026-2 and keeps focus on it', at2 && /tile-CS470/.test(foc3) && writes(page, m).length === 1, { focus: foc3 });
  m = mark(page);
  await page.keyboard.press('Control+z');
  await untilIdle(page);
  check('PLAN-01b', '(3) Ctrl+Z puts CS470 back in 2026-3 and saves', (await rowCodes(page, '2026-3')).includes('CS470') && writes(page, m).length === 1, { writes: fmt(writes(page, m)) });
  const row1 = await rowCodes(page, '2026-1');
  m = mark(page);
  await page.locator(tile('CS163')).focus();
  await page.keyboard.press('Delete');
  await untilIdle(page);
  const foc4 = await focused(page);
  const scrolledBy = await page.evaluate(() => scrollY);
  console.log(`  2026-1 before Delete: ${JSON.stringify(row1)}; focus after: ${foc4}`);
  check('PLAN-01b', '(3) Delete removes CS163, saves once, focus moves to an adjacent tile of 2026-1',
    (await page.locator(tile('CS163')).count()) === 0 && writes(page, m).length === 1 && /tile-(CS160|CS201)/.test(foc4), { focus: foc4, scrollY: scrolledBy });

  console.log('--- PLAN-01b (4)');
  m = mark(page);
  await page.click('[data-test="what-if"]');
  await page.waitForURL((u) => !u.pathname.endsWith(id), { timeout: 10000 }).catch(() => {});
  await untilIdle(page);
  const copyId = await planId(page);
  const h1 = await page.locator('h1').innerText();
  console.log(`  ${fmt(sent(page, m))}; now on ${copyId} "${h1}"`);
  m = mark(page);
  await page.locator(tile('CS470')).focus();
  await page.keyboard.press('Delete');
  await untilIdle(page);
  const copyBoard = await board(page);
  await page.locator('[data-test="plan-tab"]', { hasText: /^Default plan$/ }).click();
  await untilIdle(page);
  const origBoard = await board(page);
  await page.reload({ waitUntil: 'networkidle' });
  await untilIdle(page);
  const origReload = await board(page);
  const list = (await call('GET', '/plans', { token: await pageToken(page), quiet: true })).json.plans.map((p) => `${p.name} ${p.id} courses=${p.preview.courseCount}`);
  const orig = await apiPlan(page, id), copy = await apiPlan(page, copyId);
  console.log(`  copy board ${JSON.stringify(copyBoard)}; original board ${JSON.stringify(origBoard)}; after reload ${JSON.stringify(origReload)}`);
  console.log(`  GET /api/plans: ${JSON.stringify(list)}`);
  console.log(`  API original: ${terms(orig).join(' | ')}; copy: ${terms(copy).join(' | ')}`);
  check('PLAN-01b', '(4) POST …/duplicate made "What-if: Default plan" in its own tab; CS470 removed only in the copy; the original keeps CS470 before and after reload',
    sent(page, 0).some((r) => r.method === 'POST' && r.path.endsWith('/duplicate')) && h1 === 'What-if: Default plan' && !JSON.stringify(copyBoard).includes('CS470') && JSON.stringify(origBoard).includes('CS470') && JSON.stringify(origReload).includes('CS470') && terms(orig).join().includes('CS470') && !terms(copy).join().includes('CS470'),
    { h1 });
  await browser.close();
}

if (part === 'c') {
  const { browser, page, id } = await start();
  console.log('--- PLAN-01c setup: CS470 back to 2026-2');
  let m = mark(page);
  if ((await rowCodes(page, '2026-3')).includes('CS470')) {
    await act(page, 'CS470', 'earlier');
    await untilIdle(page);
  }
  console.log(`  ${fmt(writes(page, m))}; board ${JSON.stringify(await board(page))}; panel counts "${(await text(page, '[data-test="issue-counts"]'))?.replace(/\s+/g, ' ')}"`);
  console.log('--- PLAN-01c (1)');
  if ((await page.locator(T('2026-3')).count()) === 0) { await page.click('[data-test="add-row"]'); await sleep(300); console.log('  setup: Add Term pressed so that 2026-3 exists'); }
  m = mark(page);
  const f = await frame(page, tile('CS469'), T('2026-3'));
  await grabAt(page, f.src);
  await previewDone(page);
  await glide(page, f.dst);
  await previewDone(page);
  await aim(page, T('2026-3'));
  await sleep(300);
  const hov = (await rowsInfo(page)).find((r) => r.key === '2026-3');
  const prevNew = await page.locator('[data-test="preview-new"]').allTextContents();
  const prev = await text(page, '[data-test="issues-preview"]');
  await shot(page, 'a-plan-01c-bad-drop.png');
  console.log(`  hover 2026-3: ${JSON.stringify(hov)}; issues-preview "${prev}"; preview-new ${JSON.stringify(prevNew)}`);
  check('PLAN-01c', '(1) while over 2026-3: bad-drop, and the preview warns CS470 in 2026-2 would lose its prerequisite',
    /bad-drop/.test(hov?.cls ?? '') && prevNew.some((t) => t.includes('CS470 needs CS469 passed or placed in an earlier term.')), { reason: hov?.reason, prevNew });
  await page.mouse.up();
  let shook = false;
  for (let i = 0; i < 20 && !shook; i++) { shook = /\bshake\b/.test((await cls(page, tile('CS469'))) ?? ''); await sleep(50); }
  await untilIdle(page);
  const p1 = (await panel(page))?.replace(/\s+/g, ' ');
  const t470 = await cls(page, tile('CS470'));
  const badge = await page.locator(`${tile('CS470')} .flag-badge`).count();
  console.log(`  requests ${fmt(sent(page, m))}; CS470 class "${t470}"; badge ${badge}; panel: ${p1}`);
  check('PLAN-01c', '(1) drop saves (one PUT 200), CS469 shakes, CS470 has-violation with "!", prerequisite_not_met text and citation Điều 3.1.c',
    writes(page, m).length === 1 && writes(page, m)[0].status === 200 && shook && /has-violation/.test(t470 ?? '') && badge === 1 && p1.includes('CS470 needs CS469 passed or placed in an earlier term.') && /3\.1\.c/.test(p1), { shook });
  console.log('--- PLAN-01c (2)');
  m = mark(page);
  await page.locator(tile('CS469')).focus();
  await page.keyboard.press('Space');
  await previewDone(page);
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await previewDone(page);
  await page.keyboard.press('Enter');
  await untilIdle(page);
  const p2 = (await panel(page))?.replace(/\s+/g, ' ');
  console.log(`  live violation cards: ${JSON.stringify(await page.locator('[data-test="issue-violation"]').allTextContents())}`);
  check('PLAN-01c', '(2) CS469 back in 2026-1 clears prerequisite_not_met', (await rowCodes(page, '2026-1')).includes('CS469') && (await page.locator('[data-test="issue-violation"]').count()) === 0 && !/has-violation/.test((await cls(page, tile('CS470'))) ?? ''), { writes: fmt(writes(page, m)), board: await board(page) });

  console.log('--- PLAN-01c (3)');
  const a1 = (await signInApi(A1)).token;
  try {
    const w = await call('PUT', OFFERING, { token: a1, body: { terms: [1, 2] } });
    check('PLAN-01c', '(3) setup: A1 sets CS420 offering terms [1, 2]', w.status === 200, w.status);
    await page.reload({ waitUntil: 'networkidle' });
    await untilIdle(page);
    m = mark(page);
    await ensureRow(page, '2026-3');
    await search(page, 'CS420');
    await chooseAddTo(page, 'Term 3 2026–2027');
    await page.locator('[data-test="add-CS420"]').click();
    await untilIdle(page);
    await search(page, '');
    const p3 = (await panel(page))?.replace(/\s+/g, ' ');
    const c420 = await cls(page, tile('CS420'));
    console.log(`  CS420 in 2026-3: class "${c420}"; panel: ${p3}`);
    check('PLAN-01c', '(3) CS420 in 2026-3 shows not_offered "CS420 is not taught in term 3; it is taught in term 1, 2."',
      (await rowCodes(page, '2026-3')).includes('CS420') && p3.includes('CS420 is not taught in term 3; it is taught in term 1, 2.') && /has-violation/.test(c420 ?? ''), c420);
    await act(page, 'CS420', 'earlier');
    await untilIdle(page);
    const p3b = (await panel(page))?.replace(/\s+/g, ' ');
    console.log(`  live violation cards: ${JSON.stringify(await page.locator('[data-test="issue-violation"]').allTextContents())}`);
    check('PLAN-01c', '(3) moved to 2026-2, not_offered clears', (await rowCodes(page, '2026-2')).includes('CS420') && (await page.locator('[data-test="issue-violation"]', { hasText: 'is not taught' }).count()) === 0, { writes: fmt(writes(page, m)) });
  } finally {
    const d = await call('DELETE', OFFERING, { token: a1 });
    const cur = await call('GET', '/programs/APCS/curricula/2024', { token: a1, quiet: true });
    const ot = cur.json.requirementGroups.flatMap((g) => g.courses).find((c) => c.code === 'CS420').offeringTerms;
    check('PLAN-01c', '(3) clean-up: DELETE offering terms, CS420 reads offeringTerms null', [200, 204].includes(d.status) && ot === null, { status: d.status, offeringTerms: ot });
  }

  console.log('--- PLAN-01c (4)');
  await page.reload({ waitUntil: 'networkidle' });
  await untilIdle(page);
  const covBefore = (await page.locator('[data-test="coverage"]').innerText().catch(() => ''));
  const stripBefore = await page.locator('[data-test="strip-group"]').evaluateAll((l) => l.map((e) => e.getAttribute('title')));
  await ensureRow(page, '2026-3');
  m = mark(page);
  await chooseAddTo(page, 'Term 3 2026–2027');
  await page.locator('[data-test="slot-offer"]', { hasText: 'Kiến thức Computer Science (A): tự chọn' }).locator('[data-test="add-slot"]').click();
  await untilIdle(page);
  await page.locator('[data-test="coverage"] summary').click().catch(() => {});
  await sleep(300);
  const covAfter = (await page.locator('[data-test="coverage"]').innerText().catch(() => ''));
  const stripAfter = await page.locator('[data-test="strip-group"]').evaluateAll((l) => l.map((e) => e.getAttribute('title')));
  const slot = await page.locator(tile('slot')).first().innerText().catch(() => null);
  console.log(`  ${fmt(writes(page, m))}; slot tile "${slot?.replace(/\s+/g, ' ')}"`);
  console.log(`  strip before ${JSON.stringify(stripBefore)}`);
  console.log(`  strip after  ${JSON.stringify(stripAfter)}`);
  console.log(`  coverage after: ${covAfter.replace(/\s+/g, ' ')}`);
  const el = (arr) => arr.find((t) => t?.includes('Kiến thức Computer Science (A): tự chọn'));
  check('PLAN-01c', '(4) the 4-credit slot ("No course chosen") adds 4 planned credits to the elective group in the strip and coverage',
    /No course chosen/.test(slot ?? '') && el(stripBefore) !== el(stripAfter), { before: el(stripBefore), after: el(stripAfter) });
  console.log(`  API: ${terms(await apiPlan(page, id)).join(' | ')}`);
  await browser.close();
}

if (part === 'd') {
  const { browser, page, id } = await start();
  const wrap = () => page.evaluate(() => {
    const real = window.fetch.bind(window);
    const delayed = { issues: false, drops: false };
    window.__wrapLog = [];
    window.fetch = (url, init = {}) => {
      const u = String(url);
      const method = (init.method ?? 'GET').toUpperCase();
      const kind = method === 'GET' && /\/plans\/[^/]+\/issues$/.test(u) ? 'issues' : method === 'POST' && u.endsWith('/issues/drops') ? 'drops' : null;
      if (kind && !delayed[kind]) {
        delayed[kind] = true;
        window.__wrapLog.push(`${kind} delayed at ${Math.round(performance.now())}`);
        return new Promise((r) => setTimeout(r, 3000)).then(() => real(url, init)).then((res) => { window.__wrapLog.push(`${kind} delayed answer handed back at ${Math.round(performance.now())}`); return res; });
      }
      if (kind) window.__wrapLog.push(`${kind} sent at ${Math.round(performance.now())} (not delayed)`);
      return real(url, init);
    };
  });
  let m;
  if (process.argv[3] !== 'only2') {
  console.log('--- PLAN-01d (1)');
  console.log(`  start: ${JSON.stringify(await board(page))}`);
  await wrap();
  m = mark(page);
  await act(page, 'CS470', 'earlier');
  await page.waitForRequest((r) => r.method() === 'GET' && /\/issues$/.test(r.url()), { timeout: 5000 });
  await sleep(100);
  await page.locator(tile('CS470')).focus();
  await page.keyboard.press('Delete');
  const samples = [];
  const t0 = Date.now();
  while (Date.now() - t0 < 4500) {
    samples.push({ t: Date.now() - t0, stale: await page.locator('section.trow.stale').count(), counts: (await text(page, '[data-test="issue-counts"]'))?.replace(/\s+/g, ' '), viol: await page.locator('[data-test="issue-violation"]').count() });
    await sleep(250);
  }
  const p = (await panel(page))?.replace(/\s+/g, ' ');
  const strip = (await text(page, '[data-test="status-strip"]'))?.replace(/\s+/g, ' ');
  console.log(`  requests ${fmt(sent(page, m))}; wrapper ${JSON.stringify(await page.evaluate(() => window.__wrapLog))}`);
  console.log(`  samples ${JSON.stringify(samples)}`);
  console.log(`  after 4.5 s: panel ${p}; strip ${strip}`);
  check('PLAN-01d', '(1) edit 1 (CS470 into 2026-1 with CS469 in the same term) then edit 2 (CS470 removed) within 500 ms: rows stale until edit 2\'s report; the late 1-violation report of edit 1 is ignored; panel and strip keep 0 violations',
    samples.some((s) => s.stale > 0) && (await page.locator('[data-test="issue-violation"]').count()) === 0 && samples.slice(-6).every((s) => s.viol === 0 && s.stale === 0) && /No violation/i.test(strip), { last: samples.at(-1) });

  }
  console.log('--- PLAN-01d (2)');
  await page.reload({ waitUntil: 'networkidle' });
  await untilIdle(page);
  await wrap();
  m = mark(page);
  let f = await frame(page, tile('CS420'), T('2026-3'));
  await grabAt(page, f.src);
  await sleep(200);
  await page.keyboard.press('Escape');
  await sleep(450);
  await search(page, 'CS163');
  f = await frame(page, '[data-test="pool-CS163"]', T('2026-3'));
  await grabAt(page, f.src);
  await glide(page, f.dst);
  await aim(page, T('2026-3'));
  const seen = [];
  const t1 = Date.now();
  while (Date.now() - t1 < 4000) {
    const rows = await rowsInfo(page);
    seen.push(...rows.filter((r) => r.reason || r.placeholder).map((r) => `${r.key}:${r.placeholder ?? ''}|${r.reason ?? ''}`));
    await sleep(250);
  }
  const prev = await text(page, '[data-test="issues-preview"]');
  await page.keyboard.press('Escape');
  await sleep(500);
  await search(page, '');
  const uniq = [...new Set(seen)];
  console.log(`  requests ${fmt(sent(page, m))}; wrapper ${JSON.stringify(await page.evaluate(() => window.__wrapLog))}`);
  console.log(`  row placeholders/reasons seen during the CS163 drag: ${JSON.stringify(uniq)}; issues-preview "${prev}"`);
  check('PLAN-01d', '(2) after the CS420 drag is cancelled, its late preview never shows: no row names CS420 during or after the CS163 drag; no PUT',
    uniq.length > 0 && uniq.every((s) => !s.includes('CS420')) && uniq.some((s) => s.includes('CS163')) && writes(page, m).length === 0 && !(prev ?? '').includes('CS420'), { writes: fmt(writes(page, m)) });
  await page.reload({ waitUntil: 'networkidle' });
  console.log(`  reloaded to clear the wrapper; API: ${terms(await apiPlan(page, id)).join(' | ')}`);
  await browser.close();
}

if (part === 'e') {
  const { browser, page, id } = await start();
  console.log('--- PLAN-01e (1)');
  const before = await apiPlan(page, id);
  let m = mark(page);
  for (let i = 0; i < 40; i++) {
    const btn = page.locator('[data-test="add-row"]');
    if (await btn.isDisabled()) break;
    await btn.click();
    await sleep(80);
  }
  const count = await page.locator('section.trow[data-test^="term-"]').count();
  const disabled = await page.locator('[data-test="add-row"]').isDisabled();
  await page.locator('[data-test="add-row"]').click({ force: true, timeout: 2000 }).catch(() => {});
  await sleep(200);
  const count2 = await page.locator('section.trow[data-test^="term-"]').count();
  console.log(`  rows ${count} (then ${count2} after one more click); add-row disabled ${disabled}; requests while adding: ${fmt(sent(page, m))}`);
  await search(page, 'CS163');
  m = mark(page);
  const f = await frame(page, '[data-test="pool-CS163"]');
  await grabAt(page, f.src);
  await previewDone(page);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await sleep(400);
  await search(page, '');
  const body = drops(page, m)[0]?.body;
  const targets = body ? JSON.parse(body).targets.length : null;
  console.log(`  drop preview ${fmt(drops(page, m))}; targets ${targets}`);
  check('PLAN-01e', '(1) at 30 rows add-row is disabled and adds no 31st; the drop preview sends at most 30 targets', count === 30 && count2 === 30 && disabled && targets !== null && targets <= 30, { count, count2, disabled, targets });

  console.log('--- PLAN-01e (2)');
  const token = await pageToken(page);
  const cur = await call('GET', '/programs/APCS/curricula/2024', { token, quiet: true });
  const codes = cur.json.requirementGroups.flatMap((g) => g.courses.map((c) => c.code)).slice(0, 31);
  const t31 = codes.map((code, i) => ({ term: { year: 2026 + Math.floor(i / 3), number: (i % 3) + 1 }, placements: [{ kind: 'course', courseCode: code }] }));
  const put = await call('PUT', `/plans/${id}/placements`, { token, body: { terms: t31 } });
  const targets31 = t31.map((t) => t.term);
  const pd = await call('POST', `/plans/${id}/issues/drops`, { token, body: { terms: [], placement: { kind: 'course', courseCode: 'CS163' }, targets: targets31 } });
  const after = await apiPlan(page, id);
  check('PLAN-01e', '(2) PUT with 31 terms → 400 "terms must contain no more than 30 elements"', put.status === 400 && put.text.includes('terms must contain no more than 30 elements'), put.status);
  check('PLAN-01e', '(2) POST …/issues/drops with 31 targets → 400 "targets must contain no more than 30 elements"', pd.status === 400 && pd.text.includes('targets must contain no more than 30 elements'), pd.status);
  check('PLAN-01e', '(2) L\'s saved plan unchanged (updatedAt included)', isDeepStrictEqual(before, after), { before: before.updatedAt, after: after.updatedAt });
  await page.reload({ waitUntil: 'networkidle' });
  await untilIdle(page);
  console.log(`  after reload: ${await page.locator('section.trow[data-test^="term-"]').count()} rows`);
  await browser.close();
}

if (part === 'f') {
  const { browser, page, id } = await start();
  console.log('--- PLAN-01f (1)');
  await page.evaluate(() => {
    const real = window.fetch.bind(window);
    window.fetch = (url, init = {}) => (init.method === 'PUT' && String(url).endsWith('/placements') ? new Promise((r) => setTimeout(r, 3000)).then(() => real(url, init)) : real(url, init));
  });
  let m = mark(page);
  await act(page, 'CS420', 'earlier');
  await sleep(250);
  const during = {
    chip: await chip(page),
    otherTab: await page.locator('[data-test="plan-tab"]', { hasText: 'What-if' }).getAttribute('aria-disabled'),
    newPlan: await page.locator('[data-test="new-plan"]').isDisabled(),
    deletePlan: await page.locator('[data-test="delete-plan"]').isDisabled().catch(() => 'absent'),
    whatIf: await page.locator('[data-test="what-if"]').isDisabled(),
    beforeunload: await page.evaluate(() => { const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; }),
  };
  await clearToasts(page);
  await page.locator('[data-test="plan-tab"]', { hasText: 'What-if' }).click({ force: true }).catch((e) => console.log(`  tab click: ${e.message.split('\n')[0]}`));
  await sleep(200);
  const url1 = where(page);
  await page.locator('[data-test="back-to-list"]').click();
  await sleep(200);
  const url2 = where(page);
  const t = await toasts(page);
  console.log(`  while saving: ${JSON.stringify(during)}; after tab click ${url1}; after Plan list ${url2}; toasts ${JSON.stringify(t)}`);
  await untilIdle(page);
  await page.locator('[data-test="back-to-list"]').click();
  await settle(page);
  const url3 = where(page);
  check('PLAN-01f', '(1) while Saving…: leaving blocked, other tab aria-disabled, New plan/Delete/What-if disabled, beforeunload prevented; after the PUT settles, leaving works',
    during.chip === 'Saving…' && during.otherTab === 'true' && during.newPlan && during.deletePlan !== false && during.whatIf && during.beforeunload && url1.endsWith(id) && url2.endsWith(id) && url3 === '/plans/all', { url3 });
  await page.goto(`${BASE}/plans/${id}`, { waitUntil: 'networkidle' });
  await untilIdle(page);

  console.log('--- PLAN-01f (2) retest #137');
  const before = await apiPlan(page, id);
  const other = await signInApi(L);
  const list = await call('GET', '/auth/sessions', { token: other.token, show: (j) => JSON.stringify(j.map((s) => ({ current: s.current, createdAt: s.createdAt, ua: (s.userAgent ?? '').slice(0, 30) }))) });
  for (const s of list.json.filter((s) => !s.current)) await call('DELETE', `/auth/sessions/${s.id}`, { token: other.token, show: () => '' });
  console.log('  every other session of L revoked from a second client (the API session), the page\'s included');
  m = mark(page);
  await clearToasts(page);
  const states = [];
  await act(page, 'CS420', 'later');
  const t0 = Date.now();
  while (Date.now() - t0 < 3000) { states.push(await chip(page) ?? where(page)); await sleep(50); }
  const tt = await toasts(page);
  const saveErr = await page.locator('[data-test="save-error"]').count();
  console.log(`  requests ${fmt(sent(page, m))}; chip states ${JSON.stringify([...new Set(states)])}; toasts ${JSON.stringify(tt)}; save-error ${saveErr}; now at ${where(page)}`);
  await shot(page, 'a-plan-01f-401.png');
  const after = await apiPlan(page, id).catch(() => null);
  check('PLAN-01f', '(2) #137: PUT 401 → chip "Session expired · not saved", never "Saved"; no save-failed banner; toast says the session ended and the change was not saved',
    sent(page, m).some((r) => r.method === 'PUT' && r.status === 401) && states.includes('Session expired · not saved') && !states.slice(1).includes('Saved') && saveErr === 0 && tt.some((x) => x.includes('your last change was not saved')), { states: [...new Set(states)] });
  const a2 = await call('GET', `/plans/${id}`, { token: other.token, quiet: true });
  check('PLAN-01f', '(2) the API holds the plan as before the refused change', isDeepStrictEqual(terms(before), terms(a2.json)), terms(a2.json));

  console.log('--- PLAN-01f (3) retest #138');
  await signIn(page, L);
  await page.goto(`${BASE}/plans/${id}`, { waitUntil: 'networkidle' });
  await untilIdle(page);
  console.log(`  signed in again; at ${where(page)}; board ${JSON.stringify(await board(page))}`);
  await page.evaluate(() => {
    const realFetch = window.fetch.bind(window);
    window.fetch = (url, init = {}) => {
      if (init.method === 'PUT' && String(url).endsWith('/placements')) {
        realFetch(url, { ...init, signal: undefined });
        return new Promise((_, reject) => init.signal?.addEventListener('abort', () => reject(init.signal.reason)));
      }
      return realFetch(url, init);
    };
  });
  m = mark(page);
  await clearToasts(page);
  await search(page, 'CS250');
  await chooseAddTo(page, 'Term 3 2026–2027');
  await page.locator('[data-test="add-CS250"]').click();
  await search(page, '');
  const seq = [];
  const t2 = Date.now();
  while (Date.now() - t2 < 42000) {
    const c = await chip(page);
    if (seq.at(-1)?.chip !== c) seq.push({ t: Date.now() - t2, chip: c });
    await sleep(100);
  }
  await untilIdle(page);
  const reqs = sent(page, m);
  const iPut = reqs.findIndex((r) => r.method === 'PUT');
  const after3 = reqs.slice(iPut + 1);
  const saveErr3 = await page.locator('[data-test="save-error"]').count();
  console.log(`  chip sequence ${JSON.stringify(seq)}; requests ${fmt(reqs)}; toasts ${JSON.stringify(await toasts(page))}; save-error ${saveErr3}`);
  const onBoard = JSON.stringify(await board(page)).includes('CS250');
  await page.reload({ waitUntil: 'networkidle' });
  await untilIdle(page);
  const api3 = await apiPlan(page, id);
  console.log(`  after reload: ${terms(api3).join(' | ')}`);
  check('PLAN-01f', '(3) #138: chip stays "Saving…" until the outcome is known; after the lost PUT a GET /api/plans/{id} re-reads the plan; chip Saved, CS250 kept, no false alert; GET …/issues refreshed',
    seq.every((s) => ['Saving…', 'Saved'].includes(s.chip)) && seq.at(-1).chip === 'Saved' && after3.some((r) => r.method === 'GET' && r.path === `/api/plans/${id}`) && after3.some((r) => r.path.endsWith('/issues')) && onBoard && saveErr3 === 0 && terms(api3).join().includes('CS250'), seq);
  await browser.close();
}

log(failureCount() ? `${failureCount()} FAIL(S)` : 'All checks ok');
