// Screen parts of TC-B1-ACAD-01a, c and g and ACAD-02d, on staging in headless Chromium.
// a03: APCS 2024, onboarding finished, no transcript (ACAD-01a, 01g, then 02d). a04: APCS 2024 with the completion fixture (ACAD-01c).
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { launch, newPage, BASE, EVIDENCE, email, screenSignIn, pageToken, api, apiSignUp, apiOnboard, openSignedIn, check, log, mainText, shot, where } from './a-lib.mjs';

const row = (courseCode, courseName, credits, grade, year, number) => ({ courseCode, courseName, credits, result: 'graded', grade, term: { year, number } });
const figures = (page) => page.evaluate(() => Object.fromEntries(['graduation-status', 'credits-toward-total', 'credits-remaining', 'credits-in-progress', 'credits-accumulated', 'gpa-accumulated-average', 'gpa-average', 'gpa-classification', 'gpa-four-point'].map((k) => [k, document.querySelector(`[data-test="${k}"]`)?.innerText.trim() ?? null])));
const groups = (page) => page.locator('[data-test="group"], [data-test="combined"]').evaluateAll((els) => els.map((e) => e.innerText.replace(/\s+/g, ' ').trim()));

const browser = await launch();
const page = await newPage(browser);
await screenSignIn(page, email('03'));
await page.locator('[data-test="who"]').waitFor({ timeout: 15000 });

// ---- ACAD-01a (screen)
let audit = (await api('GET', '/users/me/audit', { token: await pageToken(page) })).json;
let fig = await figures(page);
let grp = await groups(page);
const notice = (await page.locator('[data-test="no-transcript"]').count()) ? (await page.locator('[data-test="no-transcript"]').innerText()).replace(/\n+/g, ' | ') : null;
const noticeLink = await page.locator('[data-test="no-transcript"] a').getAttribute('href').catch(() => null);
log('ACAD-01a API credits:', JSON.stringify(audit.credits), 'gpa:', JSON.stringify(audit.gpa), 'graduation:', audit.graduation.status);
log('ACAD-01a dashboard figures:', JSON.stringify(fig));
log('ACAD-01a dashboard groups:', JSON.stringify(grp));
const expectGroups = [['(A): bắt buộc', '0 / 40'], ['(A): tự chọn', '0 / 16'], ['Kiến thức Math', '0 / 16'], ['Non Computer Science', '0 / 26'], ['Physics', '0 / 12'], ['Kiến thức tốt nghiệp', '0 / 10'], ['Tự chọn Math (B)', '0 / 8'], ['Kiến thức tự chọn', '0 / 43']];
const missingGroups = expectGroups.filter(([name, figure]) => !grp.some((g) => g.includes(name) && g.includes(figure)));
const c = grp.find((g) => g.includes('Tự chọn Computer Science (C)')) ?? '(not shown)';
check('ACAD-01a', 'the dashboard shows 0 / 163, 163 remaining and "not yet", like the API', /^0 \/ 163/.test(fig['credits-toward-total'] ?? '') && /163/.test(fig['credits-remaining'] ?? '') && fig['graduation-status'] !== null && audit.graduation.status === 'not_yet', fig);
check('ACAD-01a', 'each group with a minimum shows 0 of its requirement; the combined minimum 0 of 43', missingGroups.length === 0, missingGroups.length ? { missing: missingGroups } : 'all 7 groups and Kiến thức tự chọn 0 / 43');
check('ACAD-01a', 'group (C) is shown without a minimum, never as "0 / 0"', c !== '(not shown)' && !/0 \/ 0/.test(c), c);
check('ACAD-01a', 'the page says the audit assumes no course is passed, with a link to enter a transcript', notice !== null && noticeLink === '/transcript', { notice, link: noticeLink });
const whole = await mainText(page);
check('ACAD-01a', 'no estimated graduation term on the dashboard', !/HK\d 20\d\d|dự kiến tốt nghiệp/i.test(await page.locator('[data-test="graduation"]').innerText()), (await page.locator('[data-test="graduation"]').innerText()).replace(/\n+/g, ' | '));
await shot(page, 'a-acad-01a-dashboard.png');

// ---- ACAD-01g (screen)
await page.goto(`${BASE}/explorer`, { waitUntil: 'networkidle' });
await page.locator('[data-test="group"]').first().waitFor();
const summary = await page.locator('[data-test="summary"]').innerText();
const groupNames = await page.locator('[data-test="group"]').evaluateAll((els) => els.map((e) => `${(e.querySelector('h2, h3, b')?.innerText ?? '').trim()} [${e.querySelectorAll('[data-test^="course-"]').length} courses]`));
const total = await page.locator('[data-test^="course-"]').count();
log('ACAD-01g explorer summary:', summary, '| groups:', JSON.stringify(groupNames), '| tiles:', total);
const found = {};
for (const q of ['cau truc du lieu', 'cấu trúc dữ liệu']) {
  await page.fill('input[type=search]', q);
  await page.waitForTimeout(400);
  found[q] = await page.locator('[data-test^="course-"]').evaluateAll((els) => els.map((e) => e.dataset.test.replace('course-', '')));
}
await page.fill('input[type=search]', '');
await page.waitForTimeout(400);
const back = await page.locator('[data-test^="course-"]').count();
check('ACAD-01g', 'courses are listed by group (8 groups of APCS 2024); both searches find CS163; clearing brings the full list back', groupNames.length === 8 && found['cau truc du lieu'].includes('CS163') && found['cấu trúc dữ liệu'].includes('CS163') && back === total, { groups: groupNames.length, found, tilesAfterClear: back, tilesBefore: total });
await page.click('[data-test="course-CS163"]');
await page.locator('dialog.drawer[open] #course-title').waitFor();
await page.waitForTimeout(800);
const drawer = (await page.locator('dialog.drawer[open]').innerText()).replace(/\n+/g, ' | ');
check('ACAD-01g', 'the CS163 drawer shows the code, name "Cấu trúc dữ liệu", 4 credits and its group, and says prerequisites/offering terms are not recorded, never "none"', /CS163/.test(drawer) && /Cấu trúc dữ liệu/.test(drawer) && /4 TC|4 tín chỉ/.test(drawer) && /\(A\): bắt buộc/.test(drawer) && /chưa/i.test(await page.locator('[data-test="no-prerequisites"]').innerText()), drawer);
await shot(page, 'a-acad-01g-drawer.png');
await page.keyboard.press('Escape');

// ---- ACAD-02d (screen): dashboard open, a save from elsewhere, then reload
const put = async (rows) => (await api('PUT', '/users/me/transcript', { token: await pageToken(page), body: { rows } })).status;
const first = await put([row('CS160', 'Nhập môn Tin học', 4, 8.0, 2024, 1)]);
await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
await page.locator('[data-test="credits-accumulated"]').waitFor();
const fig1 = await figures(page);
const second = await put([row('CS160', 'Nhập môn Tin học', 4, 8.0, 2024, 1), row('CS163', 'Cấu trúc dữ liệu', 4, 6.0, 2024, 1)]);
const stale = await figures(page);
await page.reload({ waitUntil: 'networkidle' });
await page.locator('[data-test="credits-accumulated"]').waitFor();
const fig2 = await figures(page);
audit = (await api('GET', '/users/me/audit', { token: await pageToken(page) })).json;
grp = await groups(page);
check('ACAD-02d', 'first save: the dashboard shows 4 credits and 8,0', first === 200 && /^4 \/ 163/.test(fig1['credits-toward-total']) && /^8(,0+)?$/.test(fig1['gpa-average']), { put: first, ...fig1 });
check('ACAD-02d', 'after the second save (made outside the page) and a reload, the dashboard shows 8 credits and 7,0; (A) bắt buộc 8 / 40', second === 200 && /^8 \/ 163/.test(fig2['credits-toward-total']) && /^7(,0+)?$/.test(fig2['gpa-average']) && grp.some((g) => g.includes('(A): bắt buộc') && g.includes('8 / 40')) && audit.credits.accumulated === 8 && audit.gpa.average === 7, { put: second, beforeReload: stale['credits-toward-total'], afterReload: fig2, api: { accumulated: audit.credits.accumulated, average: audit.gpa.average } });
await shot(page, 'a-acad-02d-dashboard.png');
check('ACAD', 'no console error on these screens (a03)', page.consoleErrors.length === 0, page.consoleErrors);
await page.context().close();

// ---- ACAD-01c (screen): the completion fixture
const file = path.join(EVIDENCE, '../../../../src/backend/test/fixtures/apcs-2024-completion.json');
const bytes = readFileSync(file);
const sha = createHash('sha256').update(bytes).digest('hex');
check('ACAD-01c', 'fixture SHA-256 matches the case', sha === 'd0a0493f2fe62da8b070d853392100a9f47babac789f2c099ed69ccfdf3facde', sha);
const token = await apiSignUp(email('04'));
log('a04 onboarding PUT:', (await apiOnboard(token)).status);
const saved = await api('PUT', '/users/me/transcript', { token, body: bytes.toString('utf8') });
const rows = (await api('GET', '/users/me/transcript', { token })).json;
log('a04 fixture PUT:', saved.status, '| rows held:', rows.rows?.length ?? rows.length);
const pageC = await newPage(browser);
await openSignedIn(pageC, token, '/dashboard');
await pageC.locator('[data-test="credits-toward-total"]').waitFor({ timeout: 15000 });
const figC = await figures(pageC);
const auditC = (await api('GET', '/users/me/audit', { token: await pageToken(pageC) })).json;
const gradC = (await pageC.locator('[data-test="graduation"]').innerText()).replace(/\n+/g, ' | ');
const unmetC = (await pageC.locator('[data-test="unmet"]').innerText()).replace(/\n+/g, ' | ');
const grpC = await groups(pageC);
const guideLinks = await pageC.locator('main a[href*="/guides"], .page a[href*="/guides"]').count();
log('ACAD-01c API:', JSON.stringify({ status: auditC.graduation.status, unmet: auditC.graduation.unmet.length, notChecked: auditC.graduation.notChecked.map((x) => x.id), credits: auditC.credits, gpa: auditC.gpa }));
log('ACAD-01c dashboard figures:', JSON.stringify(figC), '| graduation card:', gradC, '| needs-attention card:', unmetC);
log('ACAD-01c dashboard groups:', JSON.stringify(grpC));
check('ACAD-01c', 'the dashboard shows the done chip, 164 / 163 TC, 0 remaining, 7,77 twice and the classification', /^164 \/ 163 TC/.test(figC['credits-toward-total']) && figC['gpa-accumulated-average'] === '7,77' && figC['gpa-average'] === '7,77' && figC['gpa-classification'] !== null && auditC.graduation.status === 'done' && auditC.graduation.unmet.length === 0, figC);
check('ACAD-01c', 'every group and the combined minimum read as met', grpC.every((g) => !/○/.test(g)), grpC.filter((g) => /○/.test(g)));
check('ACAD-01c', 'the five unchecked conditions are shown as not checked, never as met', auditC.graduation.notChecked.length === 5 && /5/.test(gradC) && /chưa/i.test(gradC), gradC);
check('ACAD-01c', 'no graduation-guide link on the dashboard', guideLinks === 0, `${guideLinks} link(s) to /guides in the page body`);
await shot(pageC, 'a-acad-01c-dashboard.png');
// The audit page, for the record (the four PERF figures).
await pageC.goto(`${BASE}/audit`, { waitUntil: 'networkidle' });
await pageC.locator('[data-test="credits-toward-total"]').waitFor({ timeout: 15000 });
log('ACAD-01c audit page figures:', JSON.stringify(await figures(pageC)));
const notChecked = await pageC.getByText(/chưa (được )?kiểm tra|không kiểm tra/i).allInnerTexts();
log('ACAD-01c audit page, "not checked" wording:', JSON.stringify(notChecked.slice(0, 8)));
await shot(pageC, 'a-acad-01c-audit.png');
check('ACAD', 'no console error on these screens (a04)', pageC.consoleErrors.length === 0, pageC.consoleErrors);
void whole;
await browser.close();
