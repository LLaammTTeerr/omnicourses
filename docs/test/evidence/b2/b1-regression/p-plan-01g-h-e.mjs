// PLAN-01g (drag preview, real mouse events), PLAN-01h first part (status strip of "Preview 01g") and
// PLAN-01e (a save that fails), as the S1 stand-in b1-run-<run>-p01@example.com.
import { T, addCourse, addTo, board, browser, check, email, log, newPlan, openPlans, saved, setLang, shot, signedIn, sleep, summary, text } from './p-lib.mjs';

const only = new Set((process.env.ONLY ?? 'g,h,e').split(','));
const b = await browser();
const A = await signedIn(b, email('01'));
const page = A.page;
const net = [];
page.on('request', (r) => { const u = new URL(r.url()); if (u.pathname.startsWith('/api/plans/') && r.method() !== 'GET') net.push({ m: r.method(), p: u.pathname.replace(/[0-9a-f-]{36}/, '<id>'), t: Date.now() }); });
const status = [];
page.on('response', (r) => { const u = new URL(r.url()); if (/issues\/drops$|placements$/.test(u.pathname)) status.push(`${r.request().method()} ${u.pathname.split('/').slice(-2).join('/').replace(/^[0-9a-f-]{36}\//, '')} ${r.status()}`); });
const count = (m, re, since = 0) => net.filter((n) => n.m === m && re.test(n.p) && n.t >= since).length;
const tiles = async () => (await board(page)).map((r) => `${r.name}: ${r.tiles.join(' ') || '-'}`).join(' | ');
const rowsState = () =>
  page.$$eval('.rows > section', (els) =>
    els.map((e) => {
      const load = e.querySelector('[data-test="load"]');
      const cap = e.querySelector('.cap');
      return {
        name: e.querySelector('h3')?.textContent?.trim(),
        tone: [...e.classList].filter((c) => /-drop$|^checking$|^over$/.test(c)).join(' '),
        // The words are in the page for every row the engine answered for; CSS shows them only on the row under the pointer.
        reason: (() => { const r = e.querySelector('[data-test="drop-reason"]'); return r && getComputedStyle(r).display !== 'none' ? r.textContent.replace(/\s+/g, ' ').trim() : ''; })(),
        hiddenWords: (() => { const r = e.querySelector('[data-test="drop-reason"]'); return r && getComputedStyle(r).display === 'none' ? r.textContent.replace(/\s+/g, ' ').trim() : ''; })(),
        reasonColour: e.querySelector('[data-test="drop-reason"]') ? getComputedStyle(e.querySelector('[data-test="drop-reason"]')).color : '',
        load: load ? [...load.childNodes].filter((n) => !(n.nodeType === 1 && (n.classList.contains('sr-only') || n.classList.contains('delta')))).map((n) => n.textContent).join('').replace(/\s+/g, ' ').trim() : '',
        delta: e.querySelector('[data-test="load-delta"]')?.textContent?.trim() ?? '',
        meter: cap ? [...cap.classList].filter((c) => /^(ok|under|over)$/.test(c)).join() : '',
        border: getComputedStyle(e).borderTopColor,
        shadow: getComputedStyle(e).boxShadow.slice(0, 60),
      };
    }),
  );
const panel = async () => ({
  preview: await page.locator('[data-test="issues-preview"]').evaluate((e) => [...e.childNodes].filter((n) => !(n.nodeType === 1 && n.classList.contains('sr-only'))).map((n) => n.textContent).join('').replace(/\s+/g, ' ').trim(), null, { timeout: 500 }).catch(() => ''),
  cards: await page.locator('[data-test="issues-panel"] .rail-list > li').evaluateAll((els) => els.map((e) => ({ title: e.querySelector('b')?.lastChild?.textContent?.trim(), term: e.querySelector('.vfoot .chip.line')?.textContent?.trim(), tag: e.querySelector('.vfoot .tag')?.textContent?.trim() ?? '', state: e.getAttribute('data-test') }))),
});
const centre = async (loc, dx = 0.5, dy = 0.5) => { const bx = await loc.boundingBox(); return { x: bx.x + bx.width * dx, y: bx.y + bx.height * dy }; };
const pickUp = async (loc) => { await loc.scrollIntoViewIfNeeded(); const c = await centre(loc, 0.3, 0.5); await page.mouse.move(c.x, c.y); await page.mouse.down(); await page.mouse.move(c.x + 8, c.y + 8, { steps: 4 }); await page.mouse.move(c.x + 20, c.y + 30, { steps: 4 }); };
// The rows change height when the pointer enters or leaves one (the placeholder tile), so aim again until the row has it.
const over = async (n) => {
  const row = page.locator('.rows > section').nth(n);
  for (let i = 0; i < 4; i++) {
    const c = await centre(row, 0.6, 0.5);
    await page.mouse.move(c.x, c.y, { steps: 12 });
    await sleep(400);
    if (await row.evaluate((e) => e.classList.contains('over'))) break;
  }
  await sleep(1200);
};
const tokens = () => page.evaluate(() => Object.fromEntries(['ok', 'warn', 'bad', 'info', 'ink-3'].map((k) => { const d = document.createElement('i'); d.style.color = `var(--${k})`; document.body.append(d); const c = getComputedStyle(d).color; d.remove(); return [k, c]; })));

await openPlans(page);
// The course list and the term rows are more than one 800 px screen apart, and a point outside the viewport gets no
// pointer events. PLAN-01g therefore runs at 1280x1500, so the list and both rows are on screen for the whole drag.
if (only.has('g')) await page.setViewportSize({ width: 1280, height: Number(process.env.VIEW_H ?? 1500) });
const NAME = process.env.PLAN_NAME ?? 'Preview 01g';

if (only.has('g')) {
  const { id } = await newPlan(page, NAME);
  if ((await board(page)).length < 2) { await T(page, 'add-row').click(); await sleep(300); }
  await addTo(page, 0); await addCourse(page, 'CS163'); await saved(page); await addCourse(page, 'CS201'); await saved(page);
  log(`PLAN-01g start: ${await tiles()}; design colours ${JSON.stringify(await tokens())}`);
  log(`panel before the drag: ${JSON.stringify(await panel())}`);
  await page.locator('#course-search').fill('CS160'); await sleep(400);
  const vp = page.viewportSize();
  const r2 = await page.locator('.rows > section').nth(1).boundingBox();
  log(`rows in the viewport? second row bottom ${Math.round(r2.y + r2.height)} of ${vp.height}`);

  // --- CS160 from the course list
  let t0 = Date.now();
  await pickUp(T(page, 'pool-CS160'));
  await sleep(1200);
  check('PLAN-01g', 'picking up CS160 sends exactly one POST …/issues/drops, answered 200; no PUT yet', count('POST', /issues\/drops$/, t0) === 1 && count('PUT', /placements$/, t0) === 0 && status.at(-1) === 'POST issues/drops 200', `drops ${count('POST', /issues\/drops$/, t0)}; PUT ${count('PUT', /placements$/, t0)}; last answer: ${status.at(-1)}`);
  log(`rows while held, pointer over no row: ${JSON.stringify(await rowsState())}`);
  await over(0);
  let rs = await rowsState(); let pn = await panel();
  log(`over the first row: ${JSON.stringify(rs)} panel ${JSON.stringify(pn)}`);
  await shot(page, 'p-plan-01g-over-first-row.png');
  check('PLAN-01g', 'over row 1: blue (info) outline and "Chưa kiểm tra được: CS160: chưa ghi nhận môn tiên quyết."', /unknown-drop/.test(rs[0].tone) && rs[0].reason === 'Chưa kiểm tra được: CS160: chưa ghi nhận môn tiên quyết.', `${rs[0].tone} | "${rs[0].reason}" | border ${rs[0].border}`);
  check('PLAN-01g', 'over row 1: load "12 / 22 TC" with "+4", meter green', rs[0].load === '12 / 22 TC' && rs[0].delta === '+4' && rs[0].meter === 'ok', `"${rs[0].load}" "${rs[0].delta}" meter ${rs[0].meter}`);
  check('PLAN-01g', 'over row 1: the words of a preview show only on the row under the pointer', rs.slice(1).every((r) => r.reason === ''), rs.map((r) => `${r.name}: "${r.reason}"`));
  check('PLAN-01g', 'over row 1: panel first line "Xem trước: CS160 → HK1 2026–2027 · số vi phạm không đổi"', pn.preview === 'Xem trước: CS160 → HK1 2026–2027 · số vi phạm không đổi', pn.preview);
  check('PLAN-01g', 'over row 1: that row\'s "Dưới mức tín chỉ tối thiểu" card is tagged "Sẽ hết"', pn.cards.some((c) => c.title === 'Dưới mức tín chỉ tối thiểu' && c.term === 'HK1 2026–2027' && c.tag === 'Sẽ hết'), pn.cards);
  await over(1);
  rs = await rowsState(); pn = await panel();
  log(`over the second row: ${JSON.stringify(rs)} panel ${JSON.stringify(pn)}`);
  await shot(page, 'p-plan-01g-over-second-row.png');
  check('PLAN-01g', 'over row 2: amber outline with the same "Chưa kiểm tra được: …" words', /warn-drop/.test(rs[1].tone) && rs[1].reason === 'Chưa kiểm tra được: CS160: chưa ghi nhận môn tiên quyết.', `${rs[1].tone} | "${rs[1].reason}" | border ${rs[1].border}`);
  check('PLAN-01g', 'over row 2: load "4 / 22 TC" with "+4", amber meter', rs[1].load === '4 / 22 TC' && rs[1].delta === '+4' && rs[1].meter === 'under', `"${rs[1].load}" "${rs[1].delta}" meter ${rs[1].meter}`);
  check('PLAN-01g', 'over row 2: panel first line names the second row', pn.preview === 'Xem trước: CS160 → HK2 2026–2027 · số vi phạm không đổi', pn.preview);
  check('PLAN-01g', 'over row 2: a new card for the second row tagged "Mới"', pn.cards.some((c) => c.term === 'HK2 2026–2027' && c.tag === 'Mới'), pn.cards);
  check('PLAN-01g', 'still one POST …/issues/drops for the whole drag and no PUT before the drop', count('POST', /issues\/drops$/, t0) === 1 && count('PUT', /placements$/, t0) === 0, `drops ${count('POST', /issues\/drops$/, t0)}; PUT ${count('PUT', /placements$/, t0)}`);
  await over(0);
  await page.mouse.up();
  await saved(page);
  check('PLAN-01g', 'on release CS160 lands in the first row, one PUT goes out, chip Đã lưu', (await board(page))[0].tiles.includes('CS160') && count('PUT', /placements$/, t0) === 1 && /Đã lưu/.test(await text(T(page, 'save-state'))), `${await tiles()}; PUT ${count('PUT', /placements$/, t0)}; drops ${count('POST', /issues\/drops$/, t0)}; chip ${await text(T(page, 'save-state'))}`);

  // --- the elective slot of (A): tự chọn
  await page.locator('#course-search').fill('CS202'); await sleep(400);
  t0 = Date.now();
  const before = await tiles();
  const slot = page.locator('[data-test="slot-offer"]', { hasText: 'Kiến thức Computer Science (A): tự chọn' });
  log(`slot offers: ${JSON.stringify(await page.$$eval('[data-test="slot-offer"] .nm', (e) => e.map((x) => x.textContent.trim())))}; heading "${await text(page.locator('.slot-offers h3'))}"`);
  await pickUp(slot);
  await sleep(1200);
  await over(0);
  rs = await rowsState();
  log(`slot over the first row: ${JSON.stringify(rs)}`);
  await shot(page, 'p-plan-01g-slot-over-first-row.png');
  check('PLAN-01g', 'slot over row 1: green outline, no words, load "16 / 22 TC" with "+4"', /ok-drop/.test(rs[0].tone) && rs[0].reason === '' && rs[0].load === '16 / 22 TC' && rs[0].delta === '+4', `${rs[0].tone} | "${rs[0].reason}" | "${rs[0].load}" "${rs[0].delta}"`);
  await page.keyboard.press('Escape'); await sleep(300); await page.mouse.up(); await sleep(800);
  check('PLAN-01g', 'Esc puts nothing on the board (no PUT)', (await tiles()) === before && count('PUT', /placements$/, t0) === 0, `${await tiles()}; PUT ${count('PUT', /placements$/, t0)}; drops requests for the slot drag: ${count('POST', /issues\/drops$/, t0)}`);

  // --- preview request blocked
  await page.route('**/issues/drops', (r) => r.abort('blockedbyclient'));
  t0 = Date.now();
  await pickUp(T(page, 'pool-CS202'));
  await sleep(800);
  await over(0);
  rs = await rowsState();
  const tok = await tokens();
  log(`blocked, over the first row: ${JSON.stringify(rs)}`);
  await shot(page, 'p-plan-01g-preview-blocked.png');
  check('PLAN-01g', 'blocked: the row under the pointer says "Không xem trước được. Trỏ vào hàng này để thử lại." in grey, never green', rs[0].reason === 'Không xem trước được. Trỏ vào hàng này để thử lại.' && /failed-drop/.test(rs[0].tone) && !/ok-drop/.test(rs[0].tone) && rs[0].reasonColour === tok['ink-3'], `${rs[0].tone} | "${rs[0].reason}" | colour ${rs[0].reasonColour} (grey token ${tok['ink-3']}, green ${tok.ok})`);
  check('PLAN-01g', 'blocked: the other rows show no words, and no row gets a preview outline', rs.slice(1).every((r) => r.reason === '') && rs.every((r) => !/ok-drop|warn-drop|bad-drop|unknown-drop/.test(r.tone) && r.shadow === 'none'), rs.map((r) => `${r.name}: tone "${r.tone}" shown words "${r.reason}" outline ${r.shadow}`));
  await page.keyboard.press('Escape'); await sleep(300); await page.mouse.up(); await sleep(800);
  check('PLAN-01g', 'blocked: Esc puts nothing on the board (no PUT)', (await tiles()) === before && count('PUT', /placements$/, t0) === 0, `${await tiles()}; PUT ${count('PUT', /placements$/, t0)}; drops attempts while blocked: ${count('POST', /issues\/drops$/, t0)}`);
  await page.unroute('**/issues/drops');
  await page.locator('#course-search').fill('');
  log(`answers seen: ${status.join(', ')}`);
  check('PLAN-01g', 'not observed (note): "Đang kiểm tra…" on a row (the answer came before the pointer reached a row); the red verdict and the shaking tile are not reachable on the seeded data', null, '');
}

if (only.has('h')) {
  // ---------- PLAN-01h, first part: "Preview 01g" with CS163, CS201 and CS160 in the first row
  await page.setViewportSize({ width: 1280, height: 800 });
  if ((await text(page.locator('h1'))) !== NAME) { await page.locator('[data-test="plan-tab"]', { hasText: NAME }).first().click(); await sleep(1500); }
  for (const lang of ['vi', 'en']) {
    await setLang(page, lang); await T(page, 'estimate').waitFor({ timeout: 20000 }); await sleep(800);
    const x = lang === 'vi'
      ? { small: 'Không thấy vi phạm · 6 mục chưa kiểm tra được', large: 'Chưa đủ để tốt nghiệp', tip: 'Kiến thức Computer Science (A): bắt buộc: 12/40 tín chỉ', saved: 'Đã lưu', cov: 'Khi hoàn thành kế hoạch' }
      : { small: 'No violation found · 6 not checked', large: 'Not enough to graduate yet', tip: 'Kiến thức Computer Science (A): bắt buộc: 12/40 credits', saved: 'Saved', cov: 'With the plan completed' };
    log(`${lang}: board ${await tiles()}`);
    const small = await text(page.locator('[data-test="estimate"] small')), large = await text(page.locator('[data-test="estimate"] b'));
    check('PLAN-01h', `${lang}: small line "${x.small}"`, small === x.small, small);
    const ic = await page.locator('[data-test="estimate"] .est-ic').evaluate((e) => getComputedStyle(e).backgroundColor);
    const tok = await tokens();
    check('PLAN-01h', `${lang}: large line "${x.large}" on a red icon`, large === x.large && ic === tok.bad, `"${large}"; icon background ${ic} (red token ${tok.bad})`);
    const groups = await page.$$eval('[data-test="strip-group"]', (els) => els.map((e) => ({ title: e.title, shown: e.querySelector('span[aria-hidden="true"]:not(.glyph)')?.textContent?.trim(), glyph: e.querySelector('.glyph')?.textContent?.trim(), miss: e.classList.contains('miss'), colour: getComputedStyle(e).color })));
    const a = groups.find((g) => g.title.startsWith('Kiến thức Computer Science (A): bắt buộc'));
    check('PLAN-01h', `${lang}: a chip per requirement group with its glyph (8 groups)`, groups.length === 8 && groups.every((g) => g.glyph), groups.map((g) => `${g.glyph} ${g.shown}${g.miss ? ' (short)' : ''}`));
    check('PLAN-01h', `${lang}: (A) bắt buộc shows "12/40", red as a short group, tooltip "${x.tip}"`, a?.shown === '12/40' && a?.miss === true && a?.title === x.tip, a);
    check('PLAN-01h', `${lang}: the save chip on the right says ${x.saved}`, (await text(T(page, 'save-state'))) === x.saved, await text(T(page, 'save-state')));
    const est = `${small} ${large}`;
    check('PLAN-01h', `${lang}: no graduation term: no term name and no estimate`, !/HK\d|Term \d|20\d\d/.test(est), est);
    const cov = await page.locator('[data-test="coverage"]').evaluate((e) => ({ summary: e.querySelector('summary').textContent.replace(/\s+/g, ' ').trim(), line: e.querySelector('p')?.textContent?.trim() }));
    check('PLAN-01h', `${lang}: it matches the panel's "${x.cov}" section`, cov.summary.startsWith(x.cov) && cov.line === x.large, cov);
    if (lang === 'vi') await shot(page, 'p-plan-01h-strip-vi.png');
  }
  await setLang(page, 'vi'); await T(page, 'status-strip').waitFor();
}

if (only.has('e')) {
  // ---------- PLAN-01e: a save that fails
  await page.setViewportSize({ width: 1280, height: 800 });
  const { id } = await newPlan(page, 'Fail 01e');
  await addTo(page, 0); await addCourse(page, 'CS160'); await saved(page);
  const before = await tiles();
  await page.route('**/api/plans/**', (r) => (r.request().method() === 'GET' ? r.continue() : r.abort('blockedbyclient')));
  const t0 = Date.now();
  await addCourse(page, 'CS163');
  const seen = [];
  let last = '';
  for (let i = 0; i < 60; i++) {
    const chip = await text(T(page, 'save-state'));
    const err = (await T(page, 'save-error').count()) ? await text(T(page, 'save-error')) : '';
    const now = `chip "${chip}" | error "${err}" | board ${await tiles()}`;
    if (now !== last) { seen.push(`+${((Date.now() - t0) / 1000).toFixed(1)}s ${now}`); last = now; }
    if (err && i > 6) break;
    await sleep(500);
  }
  for (const s of seen) log(`PLAN-01e ${s}`);
  await shot(page, 'p-plan-01e-save-failed.png');
  const chip = await text(T(page, 'save-state')), err = (await T(page, 'save-error').count()) ? await text(T(page, 'save-error')) : '';
  check('PLAN-01e', 'with writes to /api/plans blocked, the screen shows a save error', err === 'Chưa lưu được thay đổi. Kế hoạch đã trở về lần lưu gần nhất.' && chip === 'Chưa lưu', `error "${err}"; chip "${chip}"; attempts ${count('PUT', /placements$/, t0)}`);
  check('PLAN-01e', 'it never reports success while the save fails', !seen.slice(1).some((s) => /chip "Đã lưu"/.test(s)), seen);
  check('PLAN-01e', 'toast (note)', null, await text(T(page, 'toast')));
  await page.unroute('**/api/plans/**');
  await page.reload(); await T(page, 'status-strip').waitFor(); await page.waitForLoadState('networkidle');
  const api = await A.api('GET', `/plans/${id}`);
  check('PLAN-01e', 'after restoring and reloading, the editor shows the last state the server saved (CS160 only)', (await tiles()) === before && JSON.stringify(api.json.terms.flatMap((t) => t.placements.map((p) => p.courseCode))) === '["CS160"]', `screen: ${await tiles()}; API: ${api.json.terms.flatMap((t) => t.placements.map((p) => p.courseCode))}; chip "${await text(T(page, 'save-state'))}"`);
}

await A.keep();
await b.close();
summary();
