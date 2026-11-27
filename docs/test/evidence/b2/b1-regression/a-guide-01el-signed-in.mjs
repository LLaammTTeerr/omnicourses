// GUIDE-01e (G01 and G07 parts) and the signed-in half of GUIDE-01l, scripted on staging for the B1 regression.
// In B1 this half was done by hand in Dũng's Chrome (guide-01l-signed-in.txt). Account a02 of this run (onboarding
// finished). Prints booleans, sizes and digests only: never the token, the email or the display name.
import { createHash } from 'node:crypto';
import { launch, newPage, BASE, API, email, NAME, api, check, log, openSignedIn } from './a-lib.mjs';

const sha = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16);
const ADDRESS = email('02');
const IDS = ['accounts-and-portals', 'grades-and-transcript', 'register-courses', 'pay-tuition', 'no-such-guide'];
const IDENTITY = /"(email|displayName|display_name|userId|user_id|program|cohort)"/;

const signIn = await api('POST', '/auth/sign-in', { body: { email: ADDRESS, password: 'correct horse battery' } });
check('GUIDE-01l', 'a02 signs in', signIn.status === 200, signIn.status);
const token = signIn.json.token;
const me = await api('GET', '/users/me/onboarding', { token });
check('GUIDE-01l', 'a02 has finished onboarding', me.json?.finished === true, { status: me.status, finished: me.json?.finished });

log('---- GUIDE-01l: each guide route without and with the token');
for (const path of ['/guides', ...IDS.map((id) => `/guides/${id}`)]) {
  const out = await fetch(API + path, { cache: 'no-store' });
  const outText = await out.text();
  const inn = await fetch(API + path, { cache: 'no-store', headers: { Authorization: `Bearer ${token}` } });
  const inText = await inn.text();
  const leaks = { email: inText.includes(ADDRESS), name: inText.includes(NAME), identityKey: IDENTITY.test(inText) };
  check('GUIDE-01l', `${path}: same status and byte-identical body with and without the token; no email, name or identity key`, out.status === inn.status && outText === inText && !leaks.email && !leaks.name && !leaks.identityKey, { without: out.status, with: inn.status, identical: outText === inText, bytes: inText.length, ...leaks });
}

log('---- GUIDE-01e and GUIDE-01l: G01 and G07 pages, signed out and signed in');
const browser = await launch();
const outPage = await newPage(browser);
const inPage = await newPage(browser);
await openSignedIn(inPage, token, '/dashboard');
const PARTS = ['summary', 'when', 'prepare', 'portal', 'steps', 'notes', 'version'];
for (const id of ['accounts-and-portals', 'grades-and-transcript']) {
  const seen = {};
  for (const [label, page] of [['signed out', outPage], ['signed in', inPage]]) {
    const requests = [];
    const onReq = (r) => r.url().includes('/api/guides') && requests.push({ auth: Boolean(r.headers().authorization) });
    page.on('request', onReq);
    await page.goto(`${BASE}/guides/${id}`, { waitUntil: 'networkidle' });
    page.off('request', onReq);
    const article = page.locator('article, [data-test="guide"]').first();
    await article.waitFor({ timeout: 15000 });
    const text = await article.innerText();
    seen[label] = { digest: sha(text), length: text.length, hasName: text.includes(NAME), hasEmail: text.includes(ADDRESS), requests };
    if (label === 'signed out') {
      const html = await article.innerHTML();
      const found = Object.fromEntries(PARTS.map((p) => [p, html.includes(`data-test="${p}`) || html.includes(`data-part="${p}`)]));
      log(`${id} parts by data-test (informative):`, JSON.stringify(found));
      const steps = await page.locator('ol li').count();
      const linkInNumberColumn = await page.evaluate(() => [...document.querySelectorAll('ol li a')].some((a) => a.getBoundingClientRect().width < 40 && a.innerText.length > 5));
      check('GUIDE-01e', `${id}: numbered steps shown, and no step link squeezed into the number column (#121)`, steps > 0 && !linkInNumberColumn, { steps, linkInNumberColumn });
      log(`${id} signed-out text (first 600 chars):`, text.replace(/\n+/g, ' | ').slice(0, 600));
    }
  }
  check('GUIDE-01l', `${id}: guide content identical signed in and signed out, with no name or email in it`, seen['signed out'].digest === seen['signed in'].digest && !seen['signed in'].hasName && !seen['signed in'].hasEmail, seen);
  check('GUIDE-01l', `${id}: signed out, no guide API request carries an Authorization header`, seen['signed out'].requests.every((r) => !r.auth), seen['signed out'].requests);
  const forms = await inPage.evaluate(() => ({ passwords: document.querySelectorAll('input[type=password]').length, forms: document.querySelectorAll('form').length }));
  check('GUIDE-01m', `${id}: signed in, no password field and no form`, forms.passwords === 0 && forms.forms === 0, forms);
  const sidebarName = await inPage.locator('aside').first().innerText().then((t) => t.includes(NAME)).catch(() => false);
  log(`${id}: the sidebar shows the signed-in display name (not guide content, cases 0.5): ${sidebarName}`);
}
await browser.close();
