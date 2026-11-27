// TC-B1-USER-01c (the Finish step) and USER-01d–i again. The first run (a-onboarding.mjs, a-onboarding-output.txt) read the
// onboarding API with a token that the page had already replaced on reload (the refresh rotates it), so its API
// read-backs answered 401, and it read the address before the dashboard had opened. This run reads the page token
// fresh before every API call and waits for the dashboard. Same accounts: a03 (left at the goal question by USER-01l)
// finishes onboarding; a02 runs Settings, put back to cohort 2024 with no goals first.
import { launch, newPage, BASE, email, screenSignIn, pageToken, api, check, log, mainText, shot, where, sleep } from "./a-lib.mjs";

const browser = await launch();
const pageF = await newPage(browser);
await screenSignIn(pageF, email("03"));
await pageF.locator("#onboarding-graduation").waitFor();
await pageF.click("button[type=submit]");
await pageF.locator("#onboarding-credits").waitFor();
await pageF.click("button[type=submit]");
await pageF.waitForURL(/dashboard/, { timeout: 15000 }).catch(() => {});
await pageF.locator("[data-test=who]").waitFor({ timeout: 15000 }).catch(() => {});
const toast = await pageF.locator("[data-test=toast]").innerText().catch(() => "");
const whoF = await pageF.locator("[data-test=who]").innerText().catch(() => "(none)");
const apiF = (await api("GET", "/users/me/onboarding", { token: await pageToken(pageF) })).json;
check("USER-01c", "Finish (\"Xong\") with the goals left empty opens the dashboard on APCS 2024, goals null", where(pageF) === "/dashboard" && /APCS2024/.test(whoF) && apiF.finished === true && apiF.targetGraduationTerm === null && apiF.creditsPerTerm === null && apiF.internshipTerm === null, { url: where(pageF), who: whoF, toast, api: apiF });
await shot(pageF, "a-user-01c-dashboard.png");
await pageF.context().close();

const page = await newPage(browser);
await screenSignIn(page, email("02"));
await page.waitForURL(/dashboard/, { timeout: 15000 }).catch(() => {});
const read = async () => (await api("GET", "/users/me/onboarding", { token: await pageToken(page) })).json;
const reset = await api("PUT", "/users/me/onboarding", { token: await pageToken(page), body: { program: "APCS", cohort: 2024, targetGraduationTerm: null, creditsPerTerm: null, internshipTerm: null, finished: true } });
log("reset a02 to APCS 2024 with no goals through the API:", reset.status);
let answers, status, shown;
// ---- Settings helpers
const openSettings = async () => { await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' }); await page.locator('[data-test="study-form"]').waitFor(); };
const fields = async () => ({
  graduation: (await page.locator('#study-graduation').innerText()).trim(),
  credits: await page.locator('#study-credits').inputValue(),
  internship: (await page.locator('#study-internship').innerText()).trim(),
  program: (await page.locator('.study-program .ui-select-trigger').nth(0).innerText()).trim(),
  cohort: (await page.locator('.study-program .ui-select-trigger').nth(1).innerText()).trim(),
});
async function choose(trigger, label) {
  const button = typeof trigger === 'string' ? page.locator(trigger) : trigger;
  await button.click();
  const list = page.locator(`#${await button.getAttribute('aria-controls')}`);
  await list.locator('li[role="option"]', { hasText: label }).first().click();
}
async function save() {
  const sent = page.waitForResponse((r) => r.url().endsWith('/api/users/me/onboarding') && r.request().method() === 'PUT', { timeout: 2500 }).catch(() => null);
  await page.click('[data-test="study-form"] button[type=submit]');
  const res = await sent;
  await sleep(300);
  return res ? res.status() : 'not sent';
}
const creditsError = async () => ((await page.locator('[data-test="credits-error"]').count()) ? (await page.locator('[data-test="credits-error"]').innerText()).trim() : null);

await openSettings();
const unset = await fields();
check('USER-01c', 'Settings says the three goals are not set, with no default filled in', unset.graduation === 'Chưa biết' && unset.credits === '' && unset.internship === 'Chưa chọn', unset);
log('USER-01c graduation options offered:', JSON.stringify(await (async () => { await page.click('#study-graduation'); const t = await page.locator(`#${await page.locator('#study-graduation').getAttribute('aria-controls')} li`).allInnerTexts(); await page.keyboard.press('Escape'); return t.map((x) => x.trim()); })()));

// ---- USER-01d
await choose('#study-graduation', 'HK2 2027–2028');
await page.fill('#study-credits', '18');
await choose('#study-internship', 'HK1 2027–2028');
status = await save();
await page.reload({ waitUntil: 'networkidle' });
await page.locator('[data-test="study-form"]').waitFor();
answers = await read();
shown = await fields();
check('USER-01d', 'graduation 2027-2, 18 credits and internship 2027-1 are saved and come back after a reload', status === 200 && JSON.stringify(answers.targetGraduationTerm) === '{"year":2027,"number":2}' && answers.creditsPerTerm === 18 && JSON.stringify(answers.internshipTerm) === '{"year":2027,"number":1}' && shown.graduation === 'HK2 2027–2028' && shown.credits === '18' && shown.internship === 'HK1 2027–2028', { put: status, api: answers, screen: shown });
await shot(page, 'a-user-01d-settings.png');

// ---- USER-01e
const e = [];
for (const value of ['23', '9']) {
  await page.fill('#study-credits', value);
  status = await save();
  const error = await creditsError();
  const alerts = await page.locator('#study [role="alert"]').allInnerTexts();
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('[data-test="study-form"]').waitFor();
  e.push({ typed: value, put: status, fieldError: error, alerts, api: (await read()).creditsPerTerm, screen: await page.locator('#study-credits').inputValue() });
}
check('USER-01e', '23 comes back as 23, then 9 as 9, with no cap message and no silent change', e[0].put === 200 && e[0].api === 23 && e[0].screen === '23' && e[1].put === 200 && e[1].api === 9 && e[1].screen === '9' && e.every((x) => x.fieldError === null && x.alerts.length === 0), e);

// ---- USER-01f
const f = [];
for (const value of ['-1', '2.5', 'abc']) {
  await page.fill('#study-credits', value);
  const typedError = await creditsError();
  status = await save();
  f.push({ typed: value, put: status, fieldError: (await creditsError()) ?? typedError, api: (await read()).creditsPerTerm });
}
check('USER-01f', '-1, 2.5 and abc are each refused with a message at the field that says what is valid, without the cap; 9 stays', f.every((x) => x.put !== 200 && x.fieldError && /số nguyên từ 1/.test(x.fieldError) && !/22|10|trần|tối đa/.test(x.fieldError) && x.api === 9), f);
await shot(page, 'a-user-01f-field-error.png');
await page.fill('#study-credits', '');
status = await save();
answers = await read();
check('USER-01f', 'cleared, the field is unset (null)', status === 200 && answers.creditsPerTerm === null, { put: status, api: answers.creditsPerTerm });

// ---- USER-01g (the earlier value: set 9 again first, so "stays" can be seen)
await page.fill('#study-credits', '9');
await save();
await page.fill('#study-credits', '0');
const zeroError = await creditsError();
status = await save();
const afterZero = (await read()).creditsPerTerm;
check('USER-01g', '0 is refused with the same message, no cap cited, and 9 stays', status !== 200 && /số nguyên từ 1/.test((await creditsError()) ?? zeroError ?? '') && afterZero === 9, { put: status, fieldError: (await creditsError()) ?? zeroError, api: afterZero });
await page.fill('#study-credits', '40');
const fortyError = await creditsError();
status = await save();
await page.reload({ waitUntil: 'networkidle' });
await page.locator('[data-test="study-form"]').waitFor();
check('USER-01g', '40 is saved and comes back as 40', status === 200 && (await read()).creditsPerTerm === 40 && (await page.locator('#study-credits').inputValue()) === '40', { put: status, fieldError: fortyError, api: (await read()).creditsPerTerm, screen: await page.locator('#study-credits').inputValue() });

// ---- USER-01h
await choose('#study-internship', 'Không thực tập');
status = await save();
await page.reload({ waitUntil: 'networkidle' });
await page.locator('[data-test="study-form"]').waitFor();
answers = await read();
shown = await fields();
check('USER-01h', '"None planned" (shown as "Không thực tập") comes back after a reload and the API keeps it apart from unset', status === 200 && answers.internshipTerm === 'none' && shown.internship === 'Không thực tập', { put: status, api: answers.internshipTerm, screen: shown.internship });
await choose('#study-internship', 'Chưa chọn');
status = await save();
answers = await read();
check('USER-01h', 'cleared, it is unset (null)', status === 200 && answers.internshipTerm === null, { put: status, api: answers.internshipTerm });

// ---- USER-01i
const before = await read();
await choose(page.locator('.study-program .ui-select-trigger').nth(1), '2025');
status = await save();
await page.reload({ waitUntil: 'networkidle' });
await page.locator('[data-test="study-form"]').waitFor();
answers = await read();
shown = await fields();
await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
const who = await page.locator('[data-test="who"]').innerText().catch(() => '(none)');
await shot(page, 'a-user-01i-dashboard-2025.png');
await page.goto(`${BASE}/explorer`, { waitUntil: 'networkidle' });
const summary = await page.locator('[data-test="summary"]').innerText().catch(() => '(none)');
const explorerHead = (await mainText(page)).slice(0, 250);
const audit = await api("GET", "/users/me/audit", { token: await pageToken(page) });
check('USER-01i', 'the cohort change to 2025 is saved; dashboard, explorer and audit use APCS2025; the goals are unchanged', status === 200 && answers.cohort === 2025 && /APCS2025/.test(who) && audit.json?.curriculumCode === 'APCS2025' && /2025/.test(explorerHead) && JSON.stringify([answers.targetGraduationTerm, answers.creditsPerTerm, answers.internshipTerm]) === JSON.stringify([before.targetGraduationTerm, before.creditsPerTerm, before.internshipTerm]), { put: status, api: answers, settingsCohort: shown.cohort, dashboard: who, explorer: explorerHead, explorerSummary: summary, auditCurriculumCode: audit.json?.curriculumCode });
check('DEP-01c', 'no console error in the whole onboarding and settings run', page.consoleErrors.length === 0, page.consoleErrors);
await page.context().close();

await browser.close();
