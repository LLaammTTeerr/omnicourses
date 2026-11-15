// PLAN-01b (Screen part), PLAN-01c, PLAN-01l, PLAN-01k and PLAN-01j as the stand-in for S1:
// b1-run-<run>-p01@example.com, APCS 2024, the S1 transcript of test-cases-b1.md §1 (ZZ codes only).
import { T, addCourse, addTo, board, browser, call, check, email, log, newPlan, openPlans, saved, setLang, shot, signedIn, sleep, summary, text, tokenFor } from './p-lib.mjs';

const only = new Set((process.env.ONLY ?? 'b,c,l,k,j').split(','));
const mail = email('01');
const token = await tokenFor(mail);
const ob = await call(token, 'PUT', '/users/me/onboarding', { program: 'APCS', cohort: 2024, targetGraduationTerm: null, creditsPerTerm: null, internshipTerm: null, finished: true });
const tr = await call(token, 'PUT', '/users/me/transcript', { rows: [
  { courseCode: 'ZZ101', courseName: 'Synthetic Course One', credits: 4, result: 'graded', grade: 8.5, term: { year: 2024, number: 1 } },
  { courseCode: 'ZZ102', courseName: 'Synthetic Course Two', credits: 2, result: 'pass', grade: null, term: { year: 2024, number: 3 } },
  { courseCode: 'ZZ103', courseName: 'Synthetic Course Three', credits: 3, result: 'in_progress', grade: null, term: { year: 2025, number: 1 } },
] });
check('setup', 'S1 stand-in onboarded to APCS 2024 and S1 transcript saved', ob.status === 200 && tr.status === 200, `${ob.status}, ${tr.status}`);

const b = await browser();
const A = await signedIn(b, mail);
const page = A.page;
const puts = [];
page.on('request', (r) => { if (r.method() === 'PUT' && /\/placements$/.test(r.url())) puts.push(Date.now()); });
const toast = async (re, ms = 4000) => {
  await page.waitForFunction((s) => new RegExp(s).test(document.querySelector('[data-test="toast"]')?.textContent ?? ''), re.source, { timeout: ms }).catch(() => {});
  return text(T(page, 'toast'));
};
const tiles = async (p = page) => (await board(p)).map((r) => `${r.name}: ${r.tiles.join(' ') || '-'}`).join(' | ');
const ensureTwoRows = async () => { if ((await board(page)).length < 2) { await T(page, 'add-row').click(); await sleep(300); } };
const remove = async (p, code) => { const t = T(p, `tile-${code}`); await t.hover(); await t.locator('[data-test="remove"]').click(); };
const openTab = async (p, name) => { await p.locator('[data-test="plan-tab"]', { hasText: name }).filter({ has: p.locator(`.tab-name:text-is("${name}")`) }).first().click(); await p.waitForFunction((n) => document.querySelector('h1')?.textContent?.trim() === n, name, { timeout: 15000 }); await p.waitForLoadState('networkidle').catch(() => {}); };

await openPlans(page);
log(`first open of Plans: plan "${await text(page.locator('h1'))}", tabs: ${JSON.stringify(await page.$$eval('[data-test="plan-tab"]', (e) => e.map((x) => x.textContent.trim())))}`);

let planB;
if (only.has('b')) {
  // ---------- PLAN-01b, Screen part
  const made = await newPlan(page, 'Screen 01b');
  planB = made.id;
  log(`PLAN-01b: new-plan dialog body: "${made.body}"`);
  await ensureTwoRows();
  log(`PLAN-01b rows: ${JSON.stringify((await board(page)).map((r) => r.name))}`);
  await addTo(page, 0); await addCourse(page, 'CS160'); await saved(page);
  await addTo(page, 1); await addCourse(page, 'CS163'); await saved(page);
  check('PLAN-01b', 'chip says Đã lưu after both adds', /Đã lưu/.test(await text(T(page, 'save-state'))), await text(T(page, 'save-state')));
  await page.reload(); await T(page, 'status-strip').waitFor(); await page.waitForLoadState('networkidle');
  let bd = await board(page);
  check('PLAN-01b', 'after the first reload CS160 is in row 1 and CS163 in row 2', bd[0]?.tiles.join() === 'CS160' && bd[1]?.tiles.join() === 'CS163', await tiles());
  await shot(page, 'p-plan-01b-after-first-reload.png');
  await remove(page, 'CS160'); await saved(page);
  await page.reload(); await T(page, 'status-strip').waitFor(); await page.waitForLoadState('networkidle');
  bd = await board(page);
  check('PLAN-01b', 'after the second reload only CS163 is placed, in the second row', bd.flatMap((r) => r.tiles).join() === 'CS163' && bd[1]?.tiles.join() === 'CS163', await tiles());
  const api = await A.api('GET', `/plans/${planB}`);
  check('PLAN-01b', 'the API holds the same: only CS163', JSON.stringify(api.json?.terms?.map((t) => [t.term, t.placements.map((p) => p.courseCode)])) === JSON.stringify([[{ year: 2026, number: 2 }, ['CS163']]]), api.json?.terms?.map((t) => `${t.term.year}-${t.term.number}: ${t.placements.map((p) => p.courseCode)}`).join('; '));
}

if (only.has('c')) {
  // ---------- PLAN-01c: two browsers
  await openTab(page, 'Screen 01b');
  const B = await signedIn(b, mail, { fresh: true });
  await openPlans(B.page); await openTab(B.page, 'Screen 01b');
  const before = await tiles(B.page);
  await addTo(page, 0); await addCourse(page, 'CS201'); await saved(page);
  const inA = await tiles();
  check('PLAN-01c', 'B before A\'s change (note)', null, before);
  await B.page.reload(); await T(B.page, 'status-strip').waitFor(); await B.page.waitForLoadState('networkidle');
  await openTab(B.page, 'Screen 01b');
  const inB = await tiles(B.page);
  check('PLAN-01c', 'after a reload, B shows exactly the placements saved in A', inA === inB && /CS201/.test(inB), `A: ${inA} || B: ${inB}`);
  await B.ctx.close();
}

if (only.has('l')) {
  // ---------- PLAN-01l: What-if
  await openTab(page, 'Screen 01b');
  const orig = await tiles();
  const whatIfLabel = await text(T(page, 'what-if'));
  await T(page, 'what-if').click();
  const t = await toast(/What-if: Screen 01b/);
  await page.waitForFunction(() => document.querySelector('h1')?.textContent?.trim() === 'What-if: Screen 01b', null, { timeout: 15000 }).catch(() => {});
  await page.waitForLoadState('networkidle');
  check('PLAN-01l', 'the copy "What-if: Screen 01b" opens at once', (await text(page.locator('h1'))) === 'What-if: Screen 01b', await text(page.locator('h1')));
  check('PLAN-01l', 'toast "Đã tạo What-if: Screen 01b."', t === 'Đã tạo What-if: Screen 01b.', t);
  const tabs = await page.$$eval('[data-test="plan-tab"]', (e) => e.map((x) => x.textContent.trim()));
  check('PLAN-01l', 'the copy has a tab of its own', tabs.includes('What-if: Screen 01b') && tabs.includes('Screen 01b'), tabs);
  check('PLAN-01l', 'the copy has the same courses in the same rows', (await tiles()) === orig, `original: ${orig} || copy: ${await tiles()}`);
  await addTo(page, 1); await addCourse(page, 'CS202'); await saved(page);
  const copy = await tiles();
  await openTab(page, 'Screen 01b');
  check('PLAN-01l', 'the course added to the copy (CS202) is not in "Screen 01b", which is unchanged', (await tiles()) === orig && /CS202/.test(copy), `original now: ${await tiles()} || copy: ${copy}`);
  check('PLAN-01l', 'the button reads "What-if" in Vietnamese (note for A11Y-01d)', null, whatIfLabel);
}

if (only.has('k')) {
  // ---------- PLAN-01k: Undo
  await newPlan(page, 'Undo 01k');
  await ensureTwoRows();
  const names = (await board(page)).map((r) => r.name);
  await addTo(page, 0); await addCourse(page, 'CS160'); await saved(page);
  const t160 = T(page, 'tile-CS160'); await t160.hover(); await t160.locator('[data-test="later"]').click(); await saved(page);
  const moved = await tiles();
  await remove(page, 'CS160'); await saved(page);
  log(`PLAN-01k: rows ${JSON.stringify(names)}; after move: ${moved}; after remove: ${await tiles()}`);
  const want = [`Đã hoàn tác: Đã bỏ CS160 khỏi kế hoạch.`, `Đã hoàn tác: Đã chuyển CS160 tới ${names[1]}.`, `Đã hoàn tác: Đã thêm CS160 vào ${names[0]}.`];
  const wantBoard = [(bd) => bd[1]?.tiles.join() === 'CS160', (bd) => bd[0]?.tiles.join() === 'CS160', (bd) => bd.flatMap((r) => r.tiles).length === 0];
  for (let i = 0; i < 3; i++) {
    const n = puts.length;
    await T(page, 'undo').click();
    const t = await toast(/Đã hoàn tác/);
    await saved(page);
    check('PLAN-01k', `Undo ${i + 1}: toast "${want[i]}"`, t === want[i], t);
    check('PLAN-01k', `Undo ${i + 1}: the board is back as before that change, and saved (a PUT went out, chip Đã lưu)`, wantBoard[i](await board(page)) && puts.length === n + 1 && /Đã lưu/.test(await text(T(page, 'save-state'))), `${await tiles()}; PUTs ${puts.length - n}; chip ${await text(T(page, 'save-state'))}`);
    await sleep(3500); // let the toast go, so the next one is read fresh
  }
  check('PLAN-01k', 'after the third Undo, Hoàn tác is disabled', await T(page, 'undo').isDisabled(), await T(page, 'undo').isDisabled());
  await page.locator('h1').click();
  await page.keyboard.press('Control+z');
  const none = await toast(/Không còn gì/);
  check('PLAN-01k', 'Ctrl+Z outside a text box says "Không còn gì để hoàn tác."', none === 'Không còn gì để hoàn tác.', none);
  // Ctrl+Z in the search box: put one change on the history first, so an Undo of the board would be visible.
  await addTo(page, 0); await addCourse(page, 'CS160'); await saved(page);
  const beforeTyping = await tiles();
  const n = puts.length;
  await page.locator('#course-search').click();
  await page.keyboard.type('cs2');
  await page.keyboard.press('Control+z');
  await sleep(800);
  check('PLAN-01k', 'Ctrl+Z in the search box undoes only the typing; the board stays', (await tiles()) === beforeTyping && puts.length === n, `board: ${await tiles()}; search box now "${await page.locator('#course-search').inputValue()}"; PUTs ${puts.length - n}`);
  await page.locator('#course-search').fill('');
  await page.reload(); await T(page, 'status-strip').waitFor(); await page.waitForLoadState('networkidle');
  check('PLAN-01k', 'a reload starts with nothing to undo', await T(page, 'undo').isDisabled(), await T(page, 'undo').isDisabled());
  await openTab(page, 'Screen 01b'); await openTab(page, 'Undo 01k');
  check('PLAN-01k', 'a switch to another plan and back starts with nothing to undo', await T(page, 'undo').isDisabled(), await T(page, 'undo').isDisabled());
  // English wording of the first toast
  await setLang(page, 'en'); await T(page, 'status-strip').waitFor();
  await remove(page, 'CS160'); await saved(page, 15000).catch(() => {});
  await T(page, 'undo').click();
  const en = await toast(/Undone/);
  check('PLAN-01k', 'English: "Undone: Removed CS160 from the plan."', en === 'Undone: Removed CS160 from the plan.', en);
  await sleep(1500);
  await setLang(page, 'vi'); await T(page, 'status-strip').waitFor();
}

if (only.has('j')) {
  // ---------- PLAN-01j: Lock
  const { id } = await newPlan(page, 'Lock 01j');
  await addTo(page, 0); await addCourse(page, 'CS160'); await saved(page);
  const start = await tiles();
  await T(page, 'lock').click();
  await T(page, 'locked-note').waitFor();
  check('PLAN-01j', 'the button reads Mở khóa', (await text(T(page, 'lock'))) === 'Mở khóa', await text(T(page, 'lock')));
  check('PLAN-01j', 'the note', (await text(T(page, 'locked-note'))) === 'Kế hoạch đang khóa: không kéo, thêm hay bỏ môn được. Bấm Mở khóa để sửa.', await text(T(page, 'locked-note')));
  const vis = async () => ({
    plus: await T(page, 'add-CS163').isVisible(),
    arrows: await (async () => { await T(page, 'tile-CS160').hover(); return T(page, 'tile-CS160').locator('[data-test="later"]').isVisible(); })(),
    x: await T(page, 'tile-CS160').locator('[data-test="remove"]').isVisible(),
    addRow: await T(page, 'add-row').isVisible(),
  });
  const v = await vis();
  check('PLAN-01j', 'hidden while locked: the + buttons, the placed course\'s arrows and ×, and Thêm HK…', !v.plus && !v.arrows && !v.x && !v.addRow, v);
  await shot(page, 'p-plan-01j-locked.png');
  const n = puts.length;
  // drag a course from the list to the first row with the mouse
  const src = await T(page, 'pool-CS163').boundingBox();
  const row = await page.locator('.rows > section').first().boundingBox();
  await page.mouse.move(src.x + 30, src.y + 15); await page.mouse.down();
  await page.mouse.move(src.x + 60, src.y + 40, { steps: 5 });
  await page.mouse.move(row.x + row.width / 2, row.y + row.height / 2, { steps: 15 });
  await sleep(500); await page.mouse.up(); await sleep(500);
  const afterDrag = await tiles();
  await T(page, 'tile-CS160').focus();
  await page.keyboard.press('Space'); await sleep(200);
  const lifted = await T(page, 'tile-CS160').evaluate((e) => e.classList.contains('lifted'));
  await page.keyboard.press('Delete'); await sleep(300);
  await page.locator('h1').click();
  await page.keyboard.press('Control+z'); await sleep(800);
  check('PLAN-01j', 'dragging, Space, Delete and Ctrl+Z do nothing; no PUT goes out', afterDrag === start && (await tiles()) === start && !lifted && puts.length === n, `after drag: ${afterDrag}; after keys: ${await tiles()}; lifted by Space: ${lifted}; PUTs: ${puts.length - n}; toast: "${await text(T(page, 'toast'))}"`);
  check('PLAN-01j', 'Hoàn tác is disabled', await T(page, 'undo').isDisabled(), await T(page, 'undo').isDisabled());
  // New plan, the tabs and What-if still work
  await T(page, 'new-plan').click();
  const dialog = await page.locator('#plan-name').isVisible();
  await page.keyboard.press('Escape'); await sleep(300);
  await T(page, 'what-if').click();
  await page.waitForFunction(() => document.querySelector('h1')?.textContent?.trim() === 'What-if: Lock 01j', null, { timeout: 15000 }).catch(() => {});
  const copyOpened = (await text(page.locator('h1'))) === 'What-if: Lock 01j';
  await page.waitForLoadState('networkidle');
  await openTab(page, 'Lock 01j');
  check('PLAN-01j', 'Kế hoạch mới, What-if and the tabs still work while locked', dialog && copyOpened && (await text(page.locator('h1'))) === 'Lock 01j', `new-plan dialog opened: ${dialog}; What-if copy opened: ${copyOpened}; back by tab: ${await text(page.locator('h1'))}`);
  await page.reload(); await T(page, 'status-strip').waitFor(); await page.waitForLoadState('networkidle');
  check('PLAN-01j', 'after a reload the plan is still locked in A', (await T(page, 'locked-note').isVisible()) && (await text(T(page, 'lock'))) === 'Mở khóa', await text(T(page, 'lock')));
  // browser B
  const B = await signedIn(b, mail, { fresh: true });
  let bPut = null;
  B.page.on('response', (r) => { if (r.request().method() === 'PUT' && /\/placements$/.test(r.url())) bPut = r.status(); });
  await B.page.goto(`${new URL(page.url()).origin}/plans/${id}`); await T(B.page, 'status-strip').waitFor(); await B.page.waitForLoadState('networkidle');
  const bLocked = await T(B.page, 'locked-note').isVisible();
  await remove(B.page, 'CS160'); await saved(B.page);
  check('PLAN-01j', 'B has not locked it, and B\'s removal is saved (PUT 200)', !bLocked && bPut === 200, `locked in B: ${bLocked}; PUT ${bPut}; B board: ${await tiles(B.page)}`);
  await B.ctx.close();
  await page.reload(); await T(page, 'status-strip').waitFor(); await page.waitForLoadState('networkidle');
  check('PLAN-01j', 'after A\'s reload CS160 is gone (and A is still locked)', !/CS160/.test(await tiles()) && (await T(page, 'locked-note').isVisible()), await tiles());
  await T(page, 'lock').click(); await sleep(300);
  check('PLAN-01j', 'after Mở khóa the button reads Khóa and the note is gone', (await text(T(page, 'lock'))) === 'Khóa' && !(await T(page, 'locked-note').isVisible()), await text(T(page, 'lock')));
  await addTo(page, 0); await addCourse(page, 'CS163'); await saved(page);
  check('PLAN-01j', 'after Mở khóa, adding works again', /CS163/.test(await tiles()), await tiles());
}

await A.keep();
await b.close();
summary();
