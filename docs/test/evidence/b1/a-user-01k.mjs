// TC-B1-USER-01k: a student whose program is not listed (UC-01 A7). Observed on the screen, not inferred.
import { launch, newPage, BASE, email, screenSignUp, screenSignIn, pageToken, api, check, log, mainText, shot, where } from './a-lib.mjs';

const ID = 'USER-01k';
const address = email('01');
const browser = await launch();
const page = await newPage(browser);

log(`sign up on the screen as ${address}`);
const status = await screenSignUp(page, address);
check(ID, 'sign-up answers 201', status === 201, status);
await page.waitForURL(/onboarding/, { timeout: 15000 }).catch(() => {});
check(ID, 'onboarding opens after sign-up', where(page).startsWith('/onboarding'), where(page));
log('onboarding step 1 text:', await mainText(page));

// The choices at the program question.
const buttons = await page.locator('button, a, summary').allInnerTexts();
log('controls at the program question:', JSON.stringify(buttons.map((t) => t.replace(/\s+/g, ' ').trim()).filter(Boolean)));
const notListed = await page.getByText(/isn.t listed|không có trong danh sách|chưa có trong danh sách/i).count();
check(ID, 'a "My program isn\'t listed" choice exists at the program question', notListed > 0, `${notListed} matching element(s)`);
const details = page.locator('[data-test="not-offered"]');
if (await details.count()) {
  await details.locator('summary').click();
  log('the "other programs" disclosure, opened:', (await details.innerText()).replace(/\n+/g, ' | '));
}
await shot(page, 'a-user-01k-program-question.png');

// Leave without choosing: the only way out is "Làm sau / Later".
const later = page.locator('[data-test="later"]');
log(`"later" link text: ${await later.innerText()}`);
await later.click();
await page.waitForLoadState('networkidle');
log('after "Làm sau":', where(page), '|', await mainText(page));

const token = await pageToken(page);
const answers = await api('GET', '/users/me/onboarding', { token });
check(ID, 'no program is saved', answers.status === 200 && answers.json.program === null && answers.json.finished === false, answers.json);
const audit = await api('GET', '/users/me/audit', { token });
check(ID, 'the audit API answers 409 onboarding_required, with no audit worked out', audit.status === 409, `${audit.status} ${audit.text.slice(0, 200)}`);

// Guides.
await page.goto(`${BASE}/guides`, { waitUntil: 'networkidle' });
const guides = await page.locator('[data-test^="guide-"]').count();
check(ID, 'Guides open normally', where(page) === '/guides' && guides === 4, `${where(page)}, ${guides} guides listed`);

// The dashboard.
await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
const landed = where(page);
const gate = await page.locator('[data-test="onboarding-required"]').count();
log('opening /dashboard lands on:', landed, '|', await mainText(page));
check(ID, 'the dashboard renders and asks the student to finish onboarding, with a link (expected by the case)', landed === '/dashboard' && gate === 1, `final URL ${landed}; dashboard "onboarding-required" notice shown: ${gate === 1}`);
await shot(page, 'a-user-01k-dashboard.png');
check(ID, 'no error on the way', (await page.locator('[role="alert"]').count()) === 0, `${await page.locator('[role="alert"]').count()} alert(s); console errors: ${JSON.stringify(page.consoleErrors)}`);

// The same through the sidebar-less route /audit, and Settings (onboarding: optional).
await page.goto(`${BASE}/audit`, { waitUntil: 'networkidle' });
log('opening /audit lands on:', where(page));
await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
log('opening /settings lands on:', where(page), '| study section:', (await page.locator('#study').innerText()).replace(/\n+/g, ' | '));
await shot(page, 'a-user-01k-settings.png');

// Sign out, sign in again.
await page.click('button.sign-out');
await page.waitForURL(/sign-in|\/$/, { timeout: 15000 }).catch(() => {});
log('after sign-out:', where(page));
const res = await screenSignIn(page, address);
await page.waitForURL(/onboarding/, { timeout: 15000 }).catch(() => {});
check(ID, 'after signing in again, onboarding opens', res.status() === 200 && where(page).startsWith('/onboarding'), `${res.status()} ${where(page)}`);
log('console errors in the whole case:', JSON.stringify(page.consoleErrors));
await browser.close();
