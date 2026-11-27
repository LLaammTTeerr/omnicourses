// PLAN-01j follow-up: the drag while locked, repeated at 1280x1500 so the course list and the term row are both on
// screen (in p-plan-01b-c-l-k-j.mjs the row was below the 800 px viewport, so that drag proved little).
// The same drag on an unlocked plan does place the course (p-plan-01g-output.txt).
import { T, board, browser, check, email, openPlans, signedIn, sleep, summary, text } from './p-lib.mjs';

const b = await browser();
const A = await signedIn(b, email('01'));
const page = A.page;
await page.setViewportSize({ width: 1280, height: 1500 });
const sent = [];
page.on('request', (r) => { const u = new URL(r.url()); if (u.pathname.startsWith('/api/plans/') && r.method() !== 'GET') sent.push(`${r.method()} ${u.pathname.split('/').pop()}`); });
const tiles = async () => (await board(page)).map((r) => `${r.name}: ${r.tiles.join(' ') || '-'}`).join(' | ');
await openPlans(page);
await page.locator('[data-test="plan-tab"]', { hasText: 'Lock 01j' }).filter({ hasNotText: 'What-if' }).first().click();
await page.waitForFunction(() => document.querySelector('h1')?.textContent?.trim() === 'Lock 01j'); await page.waitForLoadState('networkidle');
if ((await text(T(page, 'lock'))) === 'Khóa') await T(page, 'lock').click();
await T(page, 'locked-note').waitFor();
await page.locator('#course-search').fill('CS160'); await sleep(400); // a short list, so the first row is on screen
const before = await tiles();
sent.length = 0;
const src = await T(page, 'pool-CS160').boundingBox();
await page.mouse.move(src.x + src.width * 0.3, src.y + src.height / 2); await page.mouse.down();
await page.mouse.move(src.x + src.width * 0.3 + 20, src.y + 40, { steps: 6 });
const row = page.locator('.rows > section').first();
for (let i = 0; i < 3; i++) { const r = await row.boundingBox(); await page.mouse.move(r.x + r.width * 0.6, r.y + r.height / 2, { steps: 12 }); await sleep(400); }
const held = await row.evaluate((e) => ({ classes: e.className, inViewport: e.getBoundingClientRect().bottom < innerHeight && e.getBoundingClientRect().top > 0 }));
await page.mouse.up(); await sleep(1000);
check('PLAN-01j', 'locked: dragging CS160 from the list onto the first row does nothing (no preview request, no PUT, board unchanged)', (await tiles()) === before && sent.length === 0 && held.inViewport && !/over|-drop/.test(held.classes), `board ${await tiles()}; requests ${JSON.stringify(sent)}; row while held: ${JSON.stringify(held)}`);
await T(page, 'lock').click(); await sleep(300);
check('PLAN-01j', 'unlocked again at the end', (await text(T(page, 'lock'))) === 'Khóa', await text(T(page, 'lock')));
await A.keep();
await b.close();
summary();
