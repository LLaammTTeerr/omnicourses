// TC-B1-USER-01a–i and l, with DEP-01a, c and d (screen part) and UI-01b on the way. Staging, headless Chromium.
import { launch, newPage, BASE, email, screenSignUp, screenSignIn, pageToken, api, check, log, mainText, shot, where, sleep } from './a-lib.mjs';

const browser = await launch();
const page = await newPage(browser);
const address = email('02');

// ---- DEP-01a: the home page, signed out
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
const statusText = await page.locator('[data-test="status"]').innerText().catch(() => '(no status element)');
check('DEP-01a', 'https address, home page shows "API ok · database up" with no version', BASE.startsWith('https://') && /API ok · database up/.test(statusText) && !/PostgreSQL|\d+\.\d+/.test(statusText), statusText);
await shot(page, 'a-dep-01a-home.png');

// ---- USER-01a, UI-01b, DEP-01c, DEP-01d: sign up through the screen
const signUpStatus = await screenSignUp(page, address);
await page.waitForURL(/onboarding/, { timeout: 15000 }).catch(() => {});
await page.locator('[data-test="program-APCS"]').waitFor({ timeout: 15000 });
check('UI-01b/DEP-01d', `sign-up through the screen as ${address} answers 201 and signs in`, signUpStatus === 201 && (await pageToken(page)) !== null, signUpStatus);
check('USER-01a', 'onboarding starts at once with the program question, not the dashboard', where(page).startsWith('/onboarding') && /Câu 1 \/ 4/.test(await page.locator('[data-test="eyebrow"]').innerText()), `${where(page)} | ${await page.locator('[data-test="eyebrow"]').innerText()} | ${await page.locator('h1').innerText()}`);
const inputsStep1 = await page.locator('input, textarea').count();
check('USER-01a', 'the program question has no text or password field (no portal password, student ID or real name asked)', inputsStep1 === 0, `${inputsStep1} input(s)`);
check('DEP-01c', 'no CORS error or other console error while loading and signing up', page.consoleErrors.length === 0, page.consoleErrors);

// ---- USER-01b: the lists
const programs = await page.locator('[data-test^="program-"]').evaluateAll((els) => els.map((e) => `${e.dataset.test}: ${e.innerText.replace(/\s+/g, ' ')}`));
const notOffered = page.locator('[data-test="not-offered"]');
const otherText = (await notOffered.count()) ? (await notOffered.locator('summary').click(), (await notOffered.innerText()).replace(/\n+/g, ' | ')) : '(none)';
log('USER-01b program options:', JSON.stringify(programs), '| not offered (listed, not selectable):', otherText);
await shot(page, 'a-user-01b-programs.png');
await page.click('[data-test="program-APCS"]');
await page.click('button[type=submit]');
await page.locator('[data-test^="cohort-"]').first().waitFor();
const cohorts = await page.locator('[data-test^="cohort-"]').evaluateAll((els) => els.map((e) => e.dataset.test));
const freeText = await page.locator('input, textarea').count();
check('USER-01b', 'the lists offer exactly APCS with cohorts 2024 and 2025, with no free-text entry and no faculty question', programs.length === 1 && programs[0].startsWith('program-APCS') && JSON.stringify(cohorts) === '["cohort-2024","cohort-2025"]' && freeText === 0, { programs, cohorts, freeTextInputs: freeText });

// ---- USER-01c: finish with the goals left empty
await page.click('[data-test="cohort-2024"]');
await page.click('button[type=submit]');
await page.locator('#onboarding-graduation').waitFor();
log('USER-01c goal step:', await mainText(page));
const step3Inputs = await page.locator('input').evaluateAll((els) => els.map((e) => `${e.id}:${e.type}`));
await page.click('button[type=submit]');
await page.locator('#onboarding-credits').waitFor();
log('USER-01c load step:', await mainText(page), '| inputs:', JSON.stringify([...step3Inputs, ...(await page.locator('input').evaluateAll((els) => els.map((e) => `${e.id}:${e.type}`)))]));
await page.click('button[type=submit]');
await page.waitForURL(/dashboard/, { timeout: 15000 }).catch(() => {});
await page.waitForLoadState('networkidle');
const afterFinish = where(page);
await page.reload({ waitUntil: 'networkidle' });
const who1 = await page.locator('[data-test="who"]').innerText().catch(() => '(none)');
const token = await pageToken(page);
const read = async () => (await api('GET', '/users/me/onboarding', { token })).json;
let answers = await read();
const page2 = await newPage(browser);
const res2 = await screenSignIn(page2, address);
await page2.waitForURL(/dashboard|onboarding/, { timeout: 15000 }).catch(() => {});
await page2.waitForLoadState('networkidle');
const who2 = await page2.locator('[data-test="who"]').innerText().catch(() => '(none)');
check('USER-01c', 'Finish opens the dashboard; a second browser signs in to the dashboard, not onboarding; both show APCS 2024', afterFinish === '/dashboard' && where(page) === '/dashboard' && res2.status() === 200 && where(page2) === '/dashboard' && /APCS2024/.test(who1) && /APCS2024/.test(who2), { afterFinish, afterReload: where(page), secondBrowser: where(page2), who1, who2 });
check('USER-01c', 'the API returns null for the three goals', answers.targetGraduationTerm === null && answers.creditsPerTerm === null && answers.internshipTerm === null && answers.finished === true && answers.program === 'APCS' && answers.cohort === 2024, answers);
check('DEP-01c', 'no console error after signing in on the second browser', page2.consoleErrors.length === 0, page2.consoleErrors);
await page2.context().close();

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
let status = await save();
await page.reload({ waitUntil: 'networkidle' });
await page.locator('[data-test="study-form"]').waitFor();
answers = await read();
let shown = await fields();
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
const audit = await api('GET', '/users/me/audit', { token });
check('USER-01i', 'the cohort change to 2025 is saved; dashboard, explorer and audit use APCS2025; the goals are unchanged', status === 200 && answers.cohort === 2025 && /APCS2025/.test(who) && audit.json?.curriculumCode === 'APCS2025' && /2025/.test(explorerHead) && JSON.stringify([answers.targetGraduationTerm, answers.creditsPerTerm, answers.internshipTerm]) === JSON.stringify([before.targetGraduationTerm, before.creditsPerTerm, before.internshipTerm]), { put: status, api: answers, settingsCohort: shown.cohort, dashboard: who, explorer: explorerHead, explorerSummary: summary, auditCurriculumCode: audit.json?.curriculumCode });
check('DEP-01c', 'no console error in the whole onboarding and settings run', page.consoleErrors.length === 0, page.consoleErrors);
await page.context().close();

// ---- USER-01l: close the tab before the planning-goal question
const addressL = email('03');
const pageL = await newPage(browser);
await screenSignUp(pageL, addressL);
await pageL.locator('[data-test="program-APCS"]').click();
await pageL.click('button[type=submit]');
await pageL.locator('[data-test="cohort-2024"]').click();
const put = pageL.waitForResponse((r) => r.url().endsWith('/api/users/me/onboarding') && r.request().method() === 'PUT');
await pageL.click('button[type=submit]');
const putStatus = (await put).status();
await pageL.locator('#onboarding-graduation').waitFor();
log('USER-01l before closing:', await pageL.locator('[data-test="eyebrow"]').innerText(), '| PUT', putStatus);
await pageL.context().close();
const pageL2 = await newPage(browser);
await screenSignIn(pageL2, addressL);
await pageL2.waitForURL(/onboarding/, { timeout: 15000 }).catch(() => {});
await pageL2.locator('[data-test="eyebrow"]').waitFor();
await sleep(500);
const eyebrow = await pageL2.locator('[data-test="eyebrow"]').innerText();
const kept = (await api('GET', '/users/me/onboarding', { token: await pageToken(pageL2) })).json;
await shot(pageL2, 'a-user-01l-resume.png');
check('USER-01l', 'after signing in again, onboarding resumes at the planning-goal question with the program and cohort kept', where(pageL2).startsWith('/onboarding') && /Câu 3 \/ 4/.test(eyebrow) && kept.program === 'APCS' && kept.cohort === 2024 && kept.finished === false, { url: where(pageL2), step: eyebrow, heading: await pageL2.locator('h1').innerText(), api: kept });
await browser.close();
