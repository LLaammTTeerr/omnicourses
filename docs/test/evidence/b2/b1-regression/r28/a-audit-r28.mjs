// B1 regression on B2, 28 Nov, staging 4b038fe: the steps B1 cases 0.12 moved from the dashboard to Xét tốt nghiệp
// (/audit) after #214: USER-01c, USER-01i, ACAD-01a, ACAD-01c and ACAD-02d. New accounts of RUN (b1-run-<RUN>-a<nn>):
// c1 (USER-01c then USER-01i, signed up and onboarded on the screens), c2 (ACAD-01a then ACAD-02d, no transcript at
// first), c3 (ACAD-01c, the completion fixture from the committed bytes of 95ea154). Screenshots go outside git (SHOTS).
// Prints figures and booleans; never a token.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { launch, newPage, BASE, email, screenSignUp, screenSignIn, pageToken, api, apiSignUp, apiOnboard, check, log, where, sleep } from '../a-lib.mjs';

const SHOTS = process.env.SHOTS ?? 'E:/Project/omnicourses-b2-evidence/b1-regression-r28';
const FIGS = ['who', 'graduation-status', 'credits-toward-total', 'credits-remaining', 'credits-in-progress', 'credits-accumulated', 'gpa-average', 'gpa-accumulated-average', 'gpa-four-point', 'gpa-classification'];
const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, name), fullPage: true });
const figures = (page) => page.evaluate((ids) => Object.fromEntries(ids.map((k) => [k, document.querySelector(`[data-test="${k}"]`)?.innerText.replace(/\s+/g, ' ').trim() ?? null])), FIGS);
const groups = (page) => page.locator('[data-test="group"], [data-test="combined"]').evaluateAll((els) => els.map((e) => e.innerText.replace(/\s+/g, ' ').trim()));
const openAudit = async (page) => {
  await page.goto(`${BASE}/audit`, { waitUntil: 'networkidle' });
  const ok = await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]') && document.querySelector('[data-test="credits-toward-total"]'), null, { timeout: 20000 }).then(() => true, () => false);
  if (!ok) throw new Error(`/audit not drawn in 20 s: at ${where(page)}, alerts ${JSON.stringify(await page.locator('[role="alert"]').allInnerTexts())}`);
};
const row = (courseCode, courseName, credits, grade, year, number) => ({ courseCode, courseName, credits, result: 'graded', grade, term: { year, number } });
const browser = await launch();

// ---- USER-01c: sign up and onboard on the screens, goals empty, Finish; reload; a second browser.
const c1 = email('c1');
const page = await newPage(browser);
const up = await screenSignUp(page, c1);
await page.locator('[data-test="program-APCS"]').waitFor({ timeout: 15000 });
await page.click('[data-test="program-APCS"]');
await page.click('button[type=submit]');
await page.click('[data-test="cohort-2024"]');
await page.click('button[type=submit]');
await page.locator('#onboarding-graduation').waitFor();
await page.click('button[type=submit]');
await page.locator('#onboarding-credits').waitFor();
await page.click('button[type=submit]');
await page.waitForURL((u) => u.pathname === '/dashboard', { timeout: 15000 }).catch(() => {});
const afterFinish = where(page);
await page.reload({ waitUntil: 'networkidle' });
const afterReload = where(page);
await openAudit(page);
const who1 = (await figures(page)).who;
const answers = (await api('GET', '/users/me/onboarding', { token: await pageToken(page) })).json;
const page2 = await newPage(browser);
await screenSignIn(page2, c1);
await page2.waitForURL((u) => !u.pathname.startsWith('/sign-in'), { timeout: 15000 }).catch(() => {});
await page2.waitForLoadState('networkidle');
const second = where(page2);
await openAudit(page2);
const who2 = (await figures(page2)).who;
await page2.context().close();
log('USER-01c:', JSON.stringify({ signUp: up, afterFinish, afterReload, secondBrowser: second, auditWho: [who1, who2], onboarding: answers }));
check('USER-01c', 'Finish and the reload open the dashboard; a second browser signs in to the dashboard; both show APCS 2024 on /audit', afterFinish === '/dashboard' && afterReload === '/dashboard' && second === '/dashboard' && /APCS2024/.test(who1 ?? '') && /APCS2024/.test(who2 ?? ''), { afterFinish, afterReload, second, who1, who2 });
check('USER-01c', 'the API returns null for the three goals', answers.finished === true && answers.program === 'APCS' && answers.cohort === 2024 && answers.targetGraduationTerm === null && answers.creditsPerTerm === null && answers.internshipTerm === null, answers);
await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
await page.locator('[data-test="study-form"]').waitFor();
const unset = { graduation: (await page.locator('#study-graduation').innerText()).trim(), credits: await page.locator('#study-credits').inputValue(), internship: (await page.locator('#study-internship').innerText()).trim() };
check('USER-01c', 'Settings says the three goals are not set, with no default filled in', unset.graduation === 'Chưa biết' && unset.credits === '' && unset.internship === 'Chưa chọn', unset);

// ---- USER-01i: cohort 2024 -> 2025 in Settings, reload, open /audit and the explorer.
const before = (await api('GET', '/users/me/onboarding', { token: await pageToken(page) })).json;
const cohortTrigger = page.locator('.study-program .ui-select-trigger').nth(1);
await cohortTrigger.click();
await page.locator(`#${await cohortTrigger.getAttribute('aria-controls')}`).locator('li[role="option"]', { hasText: '2025' }).first().click();
const sent = page.waitForResponse((r) => r.url().endsWith('/api/users/me/onboarding') && r.request().method() === 'PUT', { timeout: 5000 }).catch(() => null);
await page.click('[data-test="study-form"] button[type=submit]');
const put = (await sent)?.status() ?? 'not sent';
await page.reload({ waitUntil: 'networkidle' });
const after = (await api('GET', '/users/me/onboarding', { token: await pageToken(page) })).json;
await openAudit(page);
const whoI = (await figures(page)).who;
await shot(page, 'a-user-01i-audit-2025-r28.png');
const audit = (await api('GET', '/users/me/audit', { token: await pageToken(page) })).json;
await page.goto(`${BASE}/explorer`, { waitUntil: 'networkidle' });
const explorer = (await page.locator('[data-test="summary"]').innerText().catch(() => '(none)')).replace(/\s+/g, ' ');
log('USER-01i:', JSON.stringify({ put, cohort: after.cohort, auditWho: whoI, curriculumCode: audit.curriculumCode, explorer }));
check('USER-01i', 'saved; the audit page and the explorer use APCS2025; GET /api/users/me/audit gives APCS2025; the goals unchanged', put === 200 && after.cohort === 2025 && /APCS2025/.test(whoI ?? '') && audit.curriculumCode === 'APCS2025' && /2025/.test(explorer) && JSON.stringify([after.targetGraduationTerm, after.creditsPerTerm, after.internshipTerm]) === JSON.stringify([before.targetGraduationTerm, before.creditsPerTerm, before.internshipTerm]), { put, whoI, curriculumCode: audit.curriculumCode, explorer });
check('USER-01', 'no console error (c1)', page.consoleErrors.length === 0, page.consoleErrors);
await page.context().close();

// ---- ACAD-01a: a new account with no transcript; the audit API, then /audit.
const c2 = email('c2');
const t2 = await apiSignUp(c2);
log('c2 onboarding PUT:', (await apiOnboard(t2)).status);
const pageA = await newPage(browser);
await screenSignIn(pageA, c2);
await openAudit(pageA);
const auditA = (await api('GET', '/users/me/audit', { token: await pageToken(pageA) })).json;
const figA = await figures(pageA);
const grpA = await groups(pageA);
const notice = (await pageA.locator('[data-test="no-transcript"]').innerText().catch(() => null))?.replace(/\s+/g, ' ') ?? null;
const noticeLink = await pageA.locator('[data-test="no-transcript"] a').getAttribute('href').catch(() => null);
const cGroup = grpA.find((g) => /\(C\)/.test(g)) ?? '(not shown)';
const pageText = await pageA.locator('main').innerText();
log('ACAD-01a API:', JSON.stringify({ status: auditA.graduation.status, credits: auditA.credits, gpa: [auditA.gpa.average, auditA.gpa.accumulatedAverage] }));
log('ACAD-01a audit page:', JSON.stringify(figA), '| groups:', JSON.stringify(grpA));
check('ACAD-01a', 'the audit page shows the API figures: not yet, 0 / 163, 163 remaining, no average', auditA.graduation.status === 'not_yet' && auditA.credits.towardTotal === 0 && /^0 \/ 163/.test(figA['credits-toward-total'] ?? '') && /163/.test(figA['credits-remaining'] ?? '') && figA['graduation-status'] !== null && !/Đạt mọi/.test(figA['graduation-status'] ?? ''), { status: auditA.graduation.status, ...figA });
check('ACAD-01a', 'each group with a minimum at 0 of its requirement; the combined minimum 0 of 43', ['40', '16', '26', '12', '10', '8'].every((n) => grpA.some((g) => new RegExp(`\\b0 ?\\/ ?${n}\\b`).test(g))) && grpA.some((g) => /Kiến thức tự chọn.*0 ?\/ ?43/.test(g)), grpA);
check('ACAD-01a', 'group (C) is shown without a minimum, never as "0 / 0"', cGroup !== '(not shown)' && !/0 ?\/ ?0\b/.test(cGroup), cGroup);
check('ACAD-01a', 'the page says the audit assumes no course is passed, with a link to enter a transcript', notice !== null && noticeLink === '/transcript', { notice, link: noticeLink });
check('ACAD-01a', 'no estimated graduation term', !/dự kiến tốt nghiệp|tốt nghiệp dự kiến/i.test(pageText), 'searched the page for "dự kiến tốt nghiệp"');
await shot(pageA, 'a-acad-01a-audit-r28.png');

// ---- ACAD-02d: two saves, the second made outside the open audit page, then a reload.
const putRows = async (rows) => (await api('PUT', '/users/me/transcript', { token: await pageToken(pageA), body: { rows } })).status;
const first = await putRows([row('CS160', 'Nhập môn Tin học', 4, 8.0, 2024, 1)]);
const a1 = (await api('GET', '/users/me/audit', { token: await pageToken(pageA) })).json;
await openAudit(pageA);
const fig1 = await figures(pageA);
const secondSave = await putRows([row('CS160', 'Nhập môn Tin học', 4, 8.0, 2024, 1), row('CS163', 'Cấu trúc dữ liệu', 4, 6.0, 2024, 1)]);
await pageA.reload({ waitUntil: 'networkidle' });
await pageA.waitForFunction(() => !document.querySelector('[aria-busy="true"]') && document.querySelector('[data-test="credits-toward-total"]'), null, { timeout: 20000 });
const fig2 = await figures(pageA);
const grp2 = await groups(pageA);
const a2 = (await api('GET', '/users/me/audit', { token: await pageToken(pageA) })).json;
const aMain = a2.groups?.find((g) => g.name === 'Kiến thức Computer Science (A): bắt buộc');
log('ACAD-02d:', JSON.stringify({ first, api1: [a1.credits.accumulated, a1.gpa.average], page1: fig1, second: secondSave, api2: [a2.credits.accumulated, a2.gpa.average, aMain?.passedCredits], page2: fig2 }));
check('ACAD-02d', 'first save: API 4 credits and 8.0; the audit page shows 4 accumulated credits and 8', first === 200 && a1.credits.accumulated === 4 && a1.gpa.average === 8 && /^4\b/.test(fig1['credits-accumulated'] ?? '') && /^8(,0+)?$/.test(fig1['gpa-average'] ?? ''), fig1);
check('ACAD-02d', 'after the second save and a reload: API 8, 7.0 and (A) bắt buộc 8; the audit page shows 8 credits and 7', secondSave === 200 && a2.credits.accumulated === 8 && a2.gpa.average === 7 && aMain?.passedCredits === 8 && /^8\b/.test(fig2['credits-accumulated'] ?? '') && /^7(,0+)?$/.test(fig2['gpa-average'] ?? '') && grp2.some((g) => /\(A\): bắt buộc.*8 ?\/ ?40/.test(g)), fig2);
await shot(pageA, 'a-acad-02d-audit-r28.png');
check('ACAD', 'no console error (c2)', pageA.consoleErrors.length === 0, pageA.consoleErrors);
await pageA.context().close();

// ---- ACAD-01c: the completion fixture as committed in 95ea154, then /audit.
const bytes = execFileSync('git', ['show', '95ea154:src/backend/test/fixtures/apcs-2024-completion.json'], { cwd: 'E:/Project/omnicourses' });
const sha = createHash('sha256').update(bytes).digest('hex');
check('ACAD-01c', 'the committed bytes of the fixture have the case\'s SHA-256', sha === 'd0a0493f2fe62da8b070d853392100a9f47babac789f2c099ed69ccfdf3facde', sha);
const c3 = email('c3');
const t3 = await apiSignUp(c3);
log('c3 onboarding PUT:', (await apiOnboard(t3)).status, '| fixture PUT:', (await api('PUT', '/users/me/transcript', { token: t3, body: bytes.toString('utf8') })).status);
await sleep(1000);
const pageC = await newPage(browser);
await screenSignIn(pageC, c3);
await openAudit(pageC);
const auditC = (await api('GET', '/users/me/audit', { token: await pageToken(pageC) })).json;
const figC = await figures(pageC);
const grpC = await groups(pageC);
const notChecked = (await pageC.locator('[data-test="conditions-not-checked"]').innerText().catch(() => '')).replace(/\n+/g, ' | ');
const guideLinks = await pageC.locator('main a[href*="/guides"]').count();
log('ACAD-01c API:', JSON.stringify({ status: auditC.graduation.status, unmet: auditC.graduation.unmet.length, notChecked: auditC.graduation.notChecked.length, credits: auditC.credits, gpa: auditC.gpa }));
log('ACAD-01c audit page:', JSON.stringify(figC), '| not checked:', notChecked);
check('ACAD-01c', 'API: done, nothing unmet, 164 toward 163, 0 remaining, every group and the combined minimum met, five conditions not checked', auditC.graduation.status === 'done' && auditC.graduation.unmet.length === 0 && auditC.credits.towardTotal === 164 && auditC.credits.remaining === 0 && auditC.groups.every((g) => g.met) && auditC.combinedMinimums.every((c) => c.met) && auditC.graduation.notChecked.length === 5, auditC.credits);
check('ACAD-01c', 'the audit page: done, 164 / 163 TC, 0 remaining, 7,77 twice, Khá, 3,3; every group met', /Đạt mọi điều kiện/.test(figC['graduation-status'] ?? '') && /^164 \/ 163 TC/.test(figC['credits-toward-total'] ?? '') && /còn 0 TC/.test(figC['credits-remaining'] ?? '') && figC['gpa-average'] === '7,77' && figC['gpa-accumulated-average'] === '7,77' && figC['gpa-classification'] === 'Khá' && figC['gpa-four-point'] === '3,3' && grpC.every((g) => !/○/.test(g)), figC);
check('ACAD-01c', 'the five conditions are shown as not checked, never as met', (notChecked.match(/QĐ 1175/g) ?? []).length === 5 && /không bao giờ được coi là đã đạt/.test(notChecked), notChecked);
check('ACAD-01c', 'no graduation-guide link', guideLinks === 0, `${guideLinks} link(s)`);
await shot(pageC, 'a-acad-01c-audit-r28.png');
check('ACAD', 'no console error (c3)', pageC.consoleErrors.length === 0, pageC.consoleErrors);
await browser.close();
