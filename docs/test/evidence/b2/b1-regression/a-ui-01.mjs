// TC-B0-UI-01a–f and h–p on the B1 build (UI-01g, the 11 sign-ins, is run apart: it uses up the sign-in limit),
// with USER-01p (privacy notice) and USER-01u (export from Settings). Staging, headless Chromium.
// Sign-ins are spaced out: the limit is 10 a minute for one address, shared with the other tracks of this run.
import { readFileSync } from 'node:fs';
import { launch, newPage, BASE, PASSWORD, NAME, email, screenSignIn, pageToken, api, ledger, check, log, mainText, shot, where, sleep } from './a-lib.mjs';

const browser = await launch();
const S = email('02'); // onboarded, APCS 2025 after USER-01i
const keys = (page) => page.evaluate(() => ({ local: Object.keys(localStorage), session: Object.keys(sessionStorage) }));
const errorsOn = (page) => page.locator('.field-error, [role="alert"]').evaluateAll((els) => els.filter((e) => e.offsetParent !== null).map((e) => `${e.id || e.dataset.test || e.className}: ${e.innerText.trim()}`));
const VI_ONLY = /[ăâđêôơưĂÂĐÊÔƠƯàảãáạằẳẵắặầẩẫấậèẻẽéẹềểễếệìỉĩíịòỏõóọồổỗốộờởỡớợùủũúụừửữứựỳỷỹýỵ]/;

// ---- UI-01a
let page = await newPage(browser);
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
const rootUrl = where(page);
const rootHead = (await mainText(page)).slice(0, 160);
await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
const dashUrl = where(page);
await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
check('UI-01a', 'a private page typed signed out shows the sign-in screen, with no signed-in content', dashUrl.startsWith('/sign-in') && where(page).startsWith('/sign-in'), { '/dashboard': dashUrl, '/settings': where(page) });
check('UI-01a', 'the app address itself shows the sign-in screen (as the case is written)', rootUrl.startsWith('/sign-in'), `${rootUrl} | ${rootHead}`);

// ---- UI-01c
await page.goto(`${BASE}/sign-up`, { waitUntil: 'networkidle' });
let sent = 0;
page.on('request', (r) => r.url().endsWith('/api/auth/sign-up') && sent++);
await page.click('button[type=submit]');
await sleep(400);
const emptyErrors = await errorsOn(page);
await page.fill('#sign-up-password', 'abcdefghi');
await page.click('button[type=submit]');
await sleep(400);
const shortError = await page.locator('#sign-up-password-error').innerText().catch(() => null);
check('UI-01c', 'every empty required field says in words what is wrong, next to the field; a 9-character password is told it needs 10; nothing is sent', emptyErrors.length >= 4 && /10/.test(shortError ?? '') && sent === 0, { emptyErrors, shortPassword: shortError, signUpRequests: sent });
await shot(page, 'a-ui-01c-errors.png');

// ---- UI-01d
await page.fill('#sign-up-displayName', NAME);
await page.fill('#sign-up-email', email('90'));
await page.fill('#sign-up-password', PASSWORD);
await page.click('button[type=submit]');
await sleep(500);
const consentError = await page.locator('#sign-up-consent-error').innerText().catch(() => null);
check('UI-01d', 'with consent unticked, a message at the consent box says it is required and no sign-up request is sent (no account)', consentError !== null && sent === 0 && where(page).startsWith('/sign-up'), { consentError, signUpRequests: sent });

// ---- UI-01e
await page.fill('#sign-up-email', S);
await page.check('#sign-up-consent');
const [taken] = await Promise.all([page.waitForResponse((r) => r.url().endsWith('/api/auth/sign-up')), page.click('button[type=submit]')]);
await page.locator('[data-test="failure"]').waitFor();
const takenText = await page.locator('[data-test="failure"]').innerText();
const takenLink = await page.locator('[data-test="failure"] a').getAttribute('href').catch(() => null);
check('UI-01e', 'an email already registered: a message says so, with a way to Sign in', taken.status() === 409 && takenLink?.startsWith('/sign-in'), { status: taken.status(), message: takenText, link: takenLink });

// ---- UI-01n, sign-up half: one error in each language
const signUpTexts = {};
for (const lang of ['en', 'vi']) {
  await page.click('.lang-btn');
  await sleep(300);
  await page.fill('#sign-up-password', 'abcdefghi');
  await page.click('button[type=submit]');
  await sleep(300);
  signUpTexts[lang] = { htmlLang: await page.evaluate(() => document.documentElement.lang), title: await page.title(), text: (await page.locator('body').innerText()).replace(/\n+/g, ' | '), placeholders: await page.locator('input').evaluateAll((els) => els.map((e) => e.placeholder).filter(Boolean)) };
}
log('UI-01n sign-up EN:', JSON.stringify(signUpTexts.en));
log('UI-01n sign-up VI:', JSON.stringify(signUpTexts.vi));

// ---- UI-01o, sign-up and sign-in at four widths
const widths = [];
for (const route of ['/sign-up', '/sign-in']) {
  for (const width of [360, 768, 1280, 1920]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
    const r = await page.evaluate(() => ({ noSideScroll: document.documentElement.scrollWidth <= innerWidth, scrollWidth: document.documentElement.scrollWidth, innerWidth, controls: [...document.querySelectorAll('form input, form button[type=submit]')].map((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.left >= 0 && b.right <= innerWidth; }) }));
    widths.push({ route, width, noSideScroll: r.noSideScroll, scrollWidth: r.scrollWidth, controlsInside: r.controls.every(Boolean), controls: r.controls.length });
    if (width === 360) await shot(page, `a-ui-01o${route.replace('/', '-')}-360.png`);
  }
}
check('UI-01o', 'no sideways scrolling and every field and button inside the page at 360, 768, 1280 and 1920 px, on both forms', widths.every((w) => w.noSideScroll && w.controlsInside), widths);
await page.setViewportSize({ width: 1280, height: 800 });

// ---- UI-01f, and UI-01n's sign-in half (one wrong password in each language)
const signInTexts = {};
await page.goto(`${BASE}/sign-in`, { waitUntil: 'networkidle' });
for (const lang of ['vi', 'en']) {
  if (lang === 'en') { await page.click('.lang-btn'); await sleep(300); }
  const res = await screenSignIn(page, S, 'not the password!');
  await page.locator('[data-test="failure"]').waitFor();
  signInTexts[lang] = { status: res.status(), failure: await page.locator('[data-test="failure"]').innerText(), htmlLang: await page.evaluate(() => document.documentElement.lang), title: await page.title(), text: (await page.locator('body').innerText()).replace(/\n+/g, ' | ') };
  await sleep(7000);
}
check('UI-01f', 'a wrong password shows "invalid email or password" in words, and the form stays usable', signInTexts.vi.status === 401 && /không đúng/.test(signInTexts.vi.failure) && (await page.locator('#sign-in-password').isEnabled()) && (await page.locator('button[type=submit]').isEnabled()), { status: signInTexts.vi.status, vi: signInTexts.vi.failure, en: signInTexts.en.failure });
log('UI-01n sign-in VI:', JSON.stringify(signInTexts.vi));
log('UI-01n sign-in EN:', JSON.stringify(signInTexts.en));
const enLeak = [signUpTexts.en.text, signInTexts.en.text].map((t) => t.split(' | ').filter((part) => VI_ONLY.test(part) && !/Tiếng Việt/.test(part)));
const viPhrases = ['Sign up', 'Sign in', 'Password', 'Create account', 'Display name'];
const viLeak = [signUpTexts.vi.text, signInTexts.vi.text].map((t) => viPhrases.filter((p) => t.includes(p)));
check('UI-01n', 'every label, button and error changes language on both forms; nothing stays in the other language', enLeak.every((l) => l.length === 0) && viLeak.every((l) => l.length === 0) && signUpTexts.en.htmlLang === 'en' && signUpTexts.vi.htmlLang === 'vi' && signInTexts.en.htmlLang === 'en', { vietnameseLeftInEnglish: enLeak, englishLeftInVietnamese: viLeak, htmlLang: [signUpTexts.en.htmlLang, signUpTexts.vi.htmlLang, signInTexts.vi.htmlLang, signInTexts.en.htmlLang], placeholdersEn: signUpTexts.en.placeholders, placeholdersVi: signUpTexts.vi.placeholders });
await page.click('.lang-btn'); // back to Vietnamese
await sleep(300);

// ---- UI-01p: the server cannot be reached (simulated: every /api/ request is aborted in the browser)
await page.route('**/api/**', (r) => r.abort('connectionrefused'));
await page.fill('#sign-in-email', S);
await page.fill('#sign-in-password', PASSWORD);
await page.click('button[type=submit]');
await page.locator('[data-test="failure"]').waitFor();
const unreachable = await page.locator('[data-test="failure"]').innerText();
await page.unroute('**/api/**');
check('UI-01p', 'with the API unreachable (requests aborted in the browser, not a stopped backend), the message says the server cannot be reached, not "invalid email or password"', /Chưa kết nối được/.test(unreachable) && !/không đúng/.test(unreachable), unreachable);
await shot(page, 'a-ui-01p-unreachable.png');

// ---- UI-01h, i: reload stays signed in with one refresh; where the token is kept
await sleep(8000);
await page.reload({ waitUntil: 'networkidle' });
const inRes = await screenSignIn(page, S);
await page.waitForURL(/dashboard/, { timeout: 15000 }).catch(() => {});
const refreshes = [];
page.on('response', (r) => r.url().endsWith('/api/auth/refresh') && refreshes.push(`${r.request().method()} ${r.status()}`));
await page.reload({ waitUntil: 'networkidle' });
await page.locator('[data-test="who"]').waitFor({ timeout: 15000 }).catch(() => {});
check('UI-01h', 'after a reload the student is still signed in, with one POST /api/auth/refresh answered 200', inRes.status() === 200 && where(page) === '/dashboard' && refreshes.length === 1 && refreshes[0] === 'POST 200', { signIn: inRes.status(), url: where(page), refreshes });
const stored = await keys(page);
const localHasToken = await page.evaluate((t) => Object.values(localStorage).some((v) => v.includes(t)), await pageToken(page));
check('UI-01i', 'Local Storage holds no token; the token is in Session Storage (omnicourse.session)', !localHasToken && stored.session.includes('omnicourse.session') && !stored.local.includes('omnicourse.session'), stored);

// ---- UI-01j: the session is ended elsewhere, then the tab reloads
const copied = await pageToken(page);
const out = await api('POST', '/auth/sign-out', { token: copied });
await page.reload({ waitUntil: 'networkidle' });
await sleep(1000);
const afterRevoked = where(page);
const requests = [];
page.on('request', (r) => r.url().includes('/api/') && requests.push(r.url()));
await sleep(3000);
check('UI-01j', 'after a sign-out through the API, a reload lands on the sign-in screen, with no error loop and no blank page', out.status === 204 && afterRevoked.startsWith('/sign-in') && requests.length === 0 && (await page.locator('#sign-in-email').isVisible()), { signOut: out.status, url: afterRevoked, apiRequestsInTheNext3s: requests.length, message: await page.locator('[data-test="failure"]').innerText().catch(() => null) });

// ---- UI-01k: Sign out, Back, storage, the old token
await sleep(8000);
await screenSignIn(page, S);
await page.waitForURL(/dashboard/, { timeout: 15000 }).catch(() => {});
await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
const copied2 = await pageToken(page);
await page.click('button.sign-out');
await sleep(1500);
const afterOut = where(page);
await page.goBack({ waitUntil: 'networkidle' }).catch(() => {});
await sleep(1000);
const afterBack = where(page);
const backText = (await mainText(page)).slice(0, 200);
const storedOut = await keys(page);
const old = await api('GET', '/users/me', { token: copied2 });
check('UI-01k', 'Sign out leaves the signed-in pages; Back shows no signed-in content; neither storage holds a token; the copied token answers 401', !/Test Student|b1-run/.test(backText) && !afterBack.startsWith('/settings') && !afterBack.startsWith('/dashboard') && !storedOut.session.includes('omnicourse.session') && old.status === 401, { afterSignOut: afterOut, afterBack, backText, storage: storedOut, oldToken: old.status });
check('UI-01k', 'Sign out lands on the sign-in screen (as the case is written)', afterOut.startsWith('/sign-in'), afterOut);

// ---- UI-01l: a closed tab does not stay signed in
await sleep(8000);
await screenSignIn(page, S);
await page.waitForURL(/dashboard/, { timeout: 15000 }).catch(() => {});
const context = page.context();
await page.close();
page = await context.newPage();
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
const newTabRoot = where(page);
const openApp = await page.locator('.pub-head .btn.primary').innerText().catch(() => null);
await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
check('UI-01l', 'a new tab is not signed in: a private page goes to sign-in', where(page).startsWith('/sign-in') && !(await keys(page)).session.includes('omnicourse.session'), { appAddress: `${newTabRoot} (header button: ${openApp})`, '/dashboard': where(page) });
await context.close();

// ---- UI-01m: keyboard only
page = await newPage(browser);
const K = email('05');
await page.goto(`${BASE}/sign-up`, { waitUntil: 'networkidle' });
const focusInfo = () => page.evaluate(() => { const e = document.activeElement; const s = getComputedStyle(e); return { el: e.id || e.className || e.tagName, text: (e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 30), visible: e.matches(':focus-visible'), outline: `${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor}`, shadow: s.boxShadow.slice(0, 60) }; });
const order = [];
const tabTo = async (id, max = 15) => { for (let i = 0; i < max; i++) { await page.keyboard.press('Tab'); const f = await focusInfo(); order.push(f); if (f.el === id) return true; } return false; };
const reached = [];
reached.push(await tabTo('sign-up-displayName')); await page.keyboard.type(NAME);
reached.push(await tabTo('sign-up-email')); await page.keyboard.type(K);
reached.push(await tabTo('sign-up-password')); await page.keyboard.type(PASSWORD);
reached.push(await tabTo('sign-up-consent')); await page.keyboard.press('Space');
const ticked = await page.locator('#sign-up-consent').isChecked();
const [kUp] = await Promise.all([page.waitForResponse((r) => r.url().endsWith('/api/auth/sign-up')), page.keyboard.press('Enter')]);
if (kUp.status() === 201) ledger(K);
await page.waitForURL(/onboarding/, { timeout: 15000 }).catch(() => {});
const upUrl = where(page);
const upOrder = order.map((f) => f.el);
const upVisible = order.every((f) => f.visible && (!/^none|0px/.test(f.outline) || f.shadow !== 'none'));
log('UI-01m sign-up focus order:', JSON.stringify(order));
// sign out through the API-free way: Settings is reachable with onboarding unfinished
await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
await page.locator('button.sign-out').focus();
await page.keyboard.press('Enter');
await sleep(1500);
await page.goto(`${BASE}/sign-in`, { waitUntil: 'networkidle' });
order.length = 0;
const inReached = [await tabTo('sign-in-email')]; await page.keyboard.type(K);
inReached.push(await tabTo('sign-in-password')); await page.keyboard.type(PASSWORD);
const [kIn] = await Promise.all([page.waitForResponse((r) => r.url().endsWith('/api/auth/sign-in')), page.keyboard.press('Enter')]);
await page.waitForURL(/onboarding|dashboard/, { timeout: 15000 }).catch(() => {});
log('UI-01m sign-in focus order:', JSON.stringify(order));
const inVisible = order.every((f) => f.visible && (!/^none|0px/.test(f.outline) || f.shadow !== 'none'));
check('UI-01m', 'sign-up and sign-in work by keyboard alone (Tab, Space on consent, Enter), in a sensible order, with the focus always visibly marked', reached.every(Boolean) && ticked && kUp.status() === 201 && upUrl.startsWith('/onboarding') && inReached.every(Boolean) && kIn.status() === 200 && upVisible && inVisible, { signUp: kUp.status(), afterSignUp: upUrl, signUpOrder: upOrder, consentTickedBySpace: ticked, signIn: kIn.status(), afterSignIn: where(page), signInOrder: order.map((f) => f.el), focusAlwaysVisible: upVisible && inVisible });
await page.context().close();

// ---- USER-01p: the privacy notice, signed out
page = await newPage(browser);
await page.goto(`${BASE}/sign-up`, { waitUntil: 'networkidle' });
const link = page.locator('[data-test="privacy-link"]');
const linkAttrs = { href: await link.getAttribute('href'), target: await link.getAttribute('target'), rel: await link.getAttribute('rel'), text: await link.innerText() };
const [notice] = await Promise.all([page.context().waitForEvent('page'), link.click()]);
await notice.waitForLoadState('networkidle');
const privacy = {};
privacy.vi = (await notice.locator('article.privacy').innerText()).replace(/\n+/g, ' | ');
await notice.click('.lang-btn');
await sleep(300);
privacy.en = (await notice.locator('article.privacy').innerText()).replace(/\n+/g, ' | ');
log('USER-01p link:', JSON.stringify(linkAttrs), '| opened:', notice.url().replace(BASE, ''));
log('USER-01p VI:', privacy.vi);
log('USER-01p EN:', privacy.en);
const need = { stored: [/account|email/i, /onboarding|program/i, /transcript/i, /plan/i, /session/i, /AI/i, /consent/i], kept: [/until you delete/i], grace: [/30 days/i, /sign(ing)? in/i], backups: [/14/, /7 days/i, /nightly/i, /not running|planned|not yet/i], how: [/export/i, /delete/i] };
const missing = Object.entries(need).flatMap(([k, res]) => res.filter((re) => !re.test(privacy.en)).map((re) => `${k}: ${re}`));
check('USER-01p', 'the notice opens signed out from the link beside the consent box and states, in English: what is stored, kept until deletion, the 30-day grace with sign-in cancelling it, the backups (14 pre-deploy copies; nightly kept 7 days, planned), and how to export or delete', notice.url().endsWith('/privacy') && missing.length === 0, missing.length ? { missing } : 'every statement found');
check('USER-01p', 'the Vietnamese notice carries the same figures (30, 14, 7)', /30 ngày/.test(privacy.vi) && /14/.test(privacy.vi) && /7 ngày/.test(privacy.vi), { '30 ngày': /30 ngày/.test(privacy.vi), 14: /14/.test(privacy.vi), '7 ngày': /7 ngày/.test(privacy.vi) });
await shot(notice, 'a-user-01p-privacy-en.png');
await page.context().close();

// ---- USER-01u: Export my data in Settings
await sleep(5000);
page = await newPage(browser);
await screenSignIn(page, S);
await page.waitForURL(/dashboard/, { timeout: 15000 }).catch(() => {});
await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
const [download] = await Promise.all([page.waitForEvent('download'), page.click('#data .srow:first-of-type button')]);
const saved = JSON.parse(readFileSync(await download.path(), 'utf8'));
const viaApi = (await api('GET', '/users/me/export', { token: await pageToken(page) })).json;
const count = (x) => Object.fromEntries(Object.entries(x.tables).map(([k, v]) => [k, v.length]));
check('USER-01u', 'Export my data saves a JSON file with the same tables and row counts as the API export', JSON.stringify(count(saved)) === JSON.stringify(count(viaApi)) && saved.user.email === S, { file: download.suggestedFilename(), fileTables: count(saved), apiTables: count(viaApi), userKeys: Object.keys(saved.user) });
const credentialKeys = JSON.stringify(saved).match(/"[A-Za-z_]*(_hash|_token|_secret|_key|_password|_sub|Hash|Token|Secret|Password)"\s*:/g) ?? [];
log('USER-01u credential-like keys in the saved file:', JSON.stringify(credentialKeys));
check('UI', 'no console error (export page)', page.consoleErrors.length === 0, page.consoleErrors);
await browser.close();
