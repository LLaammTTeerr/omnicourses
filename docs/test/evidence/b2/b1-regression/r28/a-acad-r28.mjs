// B1 regression on B2, 28 Nov (run r28b): the screen parts of ACAD-01a, c, g and ACAD-02d that a-acad-screens.mjs and
// a-acad-01c.mjs could not reach on staging 778d120, because #214 rebuilt the dashboard without the graduation card,
// the accumulated credits, the average and the classification. This script records what the rebuilt dashboard shows,
// runs ACAD-01g (explorer) and ACAD-02d unchanged in substance, and reads ACAD-01c's figures on the audit page.
// Screenshots go outside git (SHOTS). Prints figures and booleans only; never a token.
import path from 'node:path';
import { launch, newPage, BASE, email, screenSignIn, pageToken, api, check, log, mainText } from '../a-lib.mjs';

const SHOTS = process.env.SHOTS ?? 'E:/Project/omnicourses-b2-evidence/b1-regression-r28';
const FIGS = ['graduation-status', 'credits-toward-total', 'credits-remaining', 'credits-in-progress', 'credits-accumulated', 'gpa-accumulated-average', 'gpa-average', 'gpa-classification', 'gpa-four-point', 'target-graduation', 'attention', 'term-year-level'];
const figures = (page) => page.evaluate((ids) => Object.fromEntries(ids.map((k) => [k, document.querySelector(`[data-test="${k}"]`)?.innerText.replace(/\s+/g, ' ').trim() ?? null])), FIGS);
const groups = (page) => page.locator('[data-test="group"], [data-test="combined"]').evaluateAll((els) => els.map((e) => e.innerText.replace(/\s+/g, ' ').trim()));
const row = (courseCode, courseName, credits, grade, year, number) => ({ courseCode, courseName, credits, result: 'graded', grade, term: { year, number } });
const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, name), fullPage: true });
const settled = (page) => page.waitForFunction(() => !document.querySelector('[aria-busy="true"]') && document.querySelector('[data-test="credits-toward-total"]'), null, { timeout: 20000 });

const browser = await launch();
const page = await newPage(browser);
await screenSignIn(page, email('03'));
log('a03 starts with no transcript row (a rerun empties it first):', (await api('PUT', '/users/me/transcript', { token: await pageToken(page), body: { rows: [] } })).status);
await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
await settled(page);
let audit = (await api('GET', '/users/me/audit', { token: await pageToken(page) })).json;
const figA = await figures(page);
const grpA = await groups(page);
log('ACAD-01a API:', JSON.stringify({ status: audit.graduation.status, credits: audit.credits, gpa: audit.gpa }));
log('ACAD-01a dashboard figures:', JSON.stringify(figA));
log('ACAD-01a dashboard groups:', JSON.stringify(grpA));
log('ACAD-01a dashboard text:', (await mainText(page)).slice(0, 1500));
check('ACAD-01a', 'the rebuilt dashboard shows 0 / 163 and 163 remaining, like the API', /^0\b/.test(figA['credits-toward-total'] ?? '') && /163/.test(figA['credits-remaining'] ?? '') && audit.credits.towardTotal === 0, figA);
check('ACAD-01a', 'the rebuilt dashboard has no graduation card, accumulated credits, average or classification (#214)', ['graduation-status', 'credits-accumulated', 'gpa-average', 'gpa-classification'].every((k) => figA[k] === null), figA);
await shot(page, 'a-acad-01a-dashboard-r28.png');

await page.goto(`${BASE}/explorer`, { waitUntil: 'networkidle' });
await page.locator('[data-test="group"]').first().waitFor();
const groupNames = await page.locator('[data-test="group"]').evaluateAll((els) => els.map((e) => `${(e.querySelector('h2, h3, b')?.innerText ?? '').trim()} [${e.querySelectorAll('[data-test^="course-"]').length} courses]`));
const total = await page.locator('[data-test^="course-"]').count();
const found = {};
for (const q of ['cau truc du lieu', 'cấu trúc dữ liệu']) {
  await page.fill('input[type=search]', q);
  await page.waitForTimeout(400);
  found[q] = await page.locator('[data-test^="course-"]').evaluateAll((els) => els.map((e) => e.dataset.test.replace('course-', '')));
}
await page.fill('input[type=search]', '');
await page.waitForTimeout(400);
const back = await page.locator('[data-test^="course-"]').count();
check('ACAD-01g', 'courses are listed by group (8 groups of APCS 2024); both searches find CS163; clearing brings the full list back', groupNames.length === 8 && found['cau truc du lieu'].includes('CS163') && found['cấu trúc dữ liệu'].includes('CS163') && back === total, { groups: groupNames, found, tilesAfterClear: back, tilesBefore: total });
await page.click('[data-test="course-CS163"]');
await page.locator('dialog.drawer[open] #course-title').waitFor();
await page.waitForTimeout(800);
const drawer = (await page.locator('dialog.drawer[open]').innerText()).replace(/\n+/g, ' | ');
log('ACAD-01g drawer:', drawer);
check('ACAD-01g', 'the CS163 drawer shows the code, name "Cấu trúc dữ liệu", 4 credits and its group; prerequisites "none" (cases 0.10), offering terms not recorded', /CS163/.test(drawer) && /Cấu trúc dữ liệu/.test(drawer) && /4 TC|4 tín chỉ/.test(drawer) && /\(A\): bắt buộc/.test(drawer) && /Không có môn tiên quyết/.test(drawer) && /Chưa ghi nhận học kỳ mở/.test(drawer), drawer);
await shot(page, 'a-acad-01g-drawer-r28.png');
await page.keyboard.press('Escape');

const put = async (rows) => (await api('PUT', '/users/me/transcript', { token: await pageToken(page), body: { rows } })).status;
const first = await put([row('CS160', 'Nhập môn Tin học', 4, 8.0, 2024, 1)]);
await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
await settled(page);
const fig1 = await figures(page);
const second = await put([row('CS160', 'Nhập môn Tin học', 4, 8.0, 2024, 1), row('CS163', 'Cấu trúc dữ liệu', 4, 6.0, 2024, 1)]);
const stale = await figures(page);
await page.reload({ waitUntil: 'networkidle' });
await settled(page);
const fig2 = await figures(page);
const grp2 = await groups(page);
audit = (await api('GET', '/users/me/audit', { token: await pageToken(page) })).json;
log('ACAD-02d figures:', JSON.stringify({ first: fig1, beforeReload: stale, afterReload: fig2 }));
log('ACAD-02d groups after reload:', JSON.stringify(grp2));
check('ACAD-02d', 'first save: the dashboard shows 4 credits toward the total and 8,0 accumulated', first === 200 && /^4\b/.test(fig1['credits-toward-total']) && /^8(,0+)?/.test(fig1['gpa-accumulated-average']), { put: first, ...fig1 });
check('ACAD-02d', 'after the second save made outside the page and a reload: 8 credits and 7,0; (A) bắt buộc 8 / 40; the API agrees', second === 200 && /^8\b/.test(fig2['credits-toward-total']) && /^7(,0+)?/.test(fig2['gpa-accumulated-average']) && grp2.some((g) => /\(A\): bắt buộc.*8 ?\/ ?40/.test(g)) && audit.credits.towardTotal === 8, { put: second, ...fig2 });
await shot(page, 'a-acad-02d-dashboard-r28.png');
check('ACAD', 'no console error on these screens (a03)', page.consoleErrors.length === 0, page.consoleErrors);
await page.context().close();

const pageC = await newPage(browser);
await screenSignIn(pageC, email('04'));
await pageC.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
await settled(pageC);
const auditC = (await api('GET', '/users/me/audit', { token: await pageToken(pageC) })).json;
const figC = await figures(pageC);
log('ACAD-01c API:', JSON.stringify({ status: auditC.graduation.status, unmet: auditC.graduation.unmet.length, notChecked: auditC.graduation.notChecked.length, credits: auditC.credits, gpa: auditC.gpa }));
log('ACAD-01c dashboard figures:', JSON.stringify(figC));
log('ACAD-01c dashboard groups:', JSON.stringify(await groups(pageC)));
log('ACAD-01c dashboard text:', (await mainText(pageC)).slice(0, 1500));
check('ACAD-01c', 'the rebuilt dashboard shows 164 / 163 TC, 0 remaining and 7,77', /^164\b/.test(figC['credits-toward-total'] ?? '') && /^0\b/.test(figC['credits-remaining'] ?? '') && /7,77/.test(figC['gpa-accumulated-average'] ?? ''), figC);
const guideLinks = await pageC.locator('main a[href*="/guides"]').count();
check('ACAD-01c', 'no graduation-guide link on the dashboard', guideLinks === 0, `${guideLinks} link(s)`);
await shot(pageC, 'a-acad-01c-dashboard-r28.png');
await pageC.goto(`${BASE}/audit`, { waitUntil: 'networkidle' });
await settled(pageC);
const figAudit = await figures(pageC);
const grad = (await pageC.locator('[data-test="conditions-not-checked"]').innerText().catch(() => '')).replace(/\n+/g, ' | ');
log('ACAD-01c audit figures:', JSON.stringify(figAudit), '| graduation card:', grad);
check('ACAD-01c', 'the audit page shows the done status, 164 / 163 TC, 0 remaining, 7,77 twice, Khá and 3,3', /^164 \/ 163 TC/.test(figAudit['credits-toward-total'] ?? '') && figAudit['gpa-average'] === '7,77' && figAudit['gpa-accumulated-average'] === '7,77' && figAudit['gpa-classification'] === 'Khá' && figAudit['gpa-four-point'] === '3,3' && /Đạt mọi điều kiện/.test(figAudit['graduation-status'] ?? ''), figAudit);
check('ACAD-01c', 'the five unchecked conditions are shown as not checked, never as met', auditC.graduation.notChecked.length === 5 && (grad.match(/QĐ 1175/g) ?? []).length === 5 && /không bao giờ được coi là đã đạt/.test(grad), grad);
await shot(pageC, 'a-acad-01c-audit-r28.png');
check('ACAD', 'no console error on these screens (a04)', pageC.consoleErrors.length === 0, pageC.consoleErrors);
await browser.close();
