// PLAN-01g follow-up: in p-plan-01g-h-e.mjs (27 Nov) the empty second row never took the "over" class while CS160 was
// held over its centre, so its preview checks read nothing. This probe holds CS160 over several points of that row,
// records the row's classes and box at each, then releases it there and reports where CS160 lands.
import { T, addTo, addCourse, board, browser, email, log, newPlan, openPlans, saved, signedIn, sleep, shot } from './p-lib.mjs';

const b = await browser();
const { page } = await signedIn(b, email('01'));
await openPlans(page);
await page.setViewportSize({ width: 1280, height: 1500 });
await newPlan(page, 'Row2 probe 01g');
if ((await board(page)).length < 2) { await T(page, 'add-row').click(); await sleep(300); }
await addTo(page, 0); await addCourse(page, 'CS163'); await saved(page);
await page.locator('#course-search').fill('CS160'); await sleep(400);
const src = T(page, 'pool-CS160');
await src.scrollIntoViewIfNeeded();
const sb = await src.boundingBox();
await page.mouse.move(sb.x + sb.width * 0.3, sb.y + sb.height / 2);
await page.mouse.down();
await page.mouse.move(sb.x + 30, sb.y + 40, { steps: 6 });
const row = page.locator('.rows > section').nth(1);
const state = () => row.evaluate((e) => ({ classes: e.className, box: (({ y, height }) => ({ y: Math.round(y), height: Math.round(height) }))(e.getBoundingClientRect()) }));
log('row 2 before hovering:', JSON.stringify(await state()));
for (const [dx, dy] of [[0.6, 0.5], [0.5, 0.3], [0.3, 0.7], [0.8, 0.5], [0.5, 0.9]]) {
  const bx = await row.boundingBox();
  await page.mouse.move(bx.x + bx.width * dx, bx.y + bx.height * dy, { steps: 12 });
  await sleep(600);
  const hit = await page.evaluate(({ x, y }) => { const el = document.elementFromPoint(x, y); return el ? `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}` : null; }, { x: bx.x + bx.width * dx, y: bx.y + bx.height * dy });
  log(`pointer at (${dx}, ${dy}) of row 2: ${JSON.stringify(await state())}; element under pointer ${hit}`);
}
for (let i = 0; i < 6; i++) {
  const bx = await row.boundingBox();
  await page.mouse.move(bx.x + bx.width * 0.5, bx.y + bx.height * 0.3, { steps: 8 });
  await sleep(500);
  if ((await state()).classes.includes('over')) break;
}
await sleep(1200);
const held = await row.evaluate((e) => ({
  classes: e.className,
  reason: e.querySelector('[data-test="drop-reason"]')?.textContent.replace(/\s+/g, ' ').trim(),
  load: e.querySelector('[data-test="load"]')?.textContent.replace(/\s+/g, ' ').trim() ?? null,
  delta: e.querySelector('[data-test="load-delta"]')?.textContent.trim() ?? null,
  meter: [...(e.querySelector('.cap')?.classList ?? [])].join(' '),
}));
const preview = await page.locator('[data-test="issues-preview"]').innerText().catch(() => '');
const cards = await page.locator('[data-test="issues-panel"] .rail-list > li').evaluateAll((els) => els.map((e) => ({ term: e.querySelector('.vfoot .chip.line')?.textContent?.trim(), tag: e.querySelector('.vfoot .tag')?.textContent?.trim() ?? '', title: e.querySelector('b')?.lastChild?.textContent?.trim() })));
log('held over row 2:', JSON.stringify({ held, preview: preview.replace(/\s+/g, ' ').trim(), cards }));
await shot(page, 'p-plan-01g-row2-probe-held.png');
await page.mouse.up();
await saved(page).catch(() => log('no Đã lưu within the wait'));
log('after release:', (await board(page)).map((r) => `${r.name}: ${r.tiles.join(' ') || '-'}`).join(' | '));
await b.close();
