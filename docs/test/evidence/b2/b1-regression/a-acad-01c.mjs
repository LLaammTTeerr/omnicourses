// ACAD-01c screen part only: a-acad-screens.mjs from its ACAD-01c section on. The full script stopped there on 27 Nov
// (fixture path one level too short after the copy into b1-regression/), after ACAD-01a, 01g and 02d had run.
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
// ---- ACAD-01c (screen): the completion fixture
const file = path.join(EVIDENCE, '../../../../../src/backend/test/fixtures/apcs-2024-completion.json');
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
