// TC-B2-A11Y-01d, the last step: switch to English, reload, and check that the language stays; then back to Vietnamese.
//   node docs/test/evidence/b2/a-a11y-01d-reload.mjs
import { EMAIL, launch, newPage, signIn, goto, check, failureCount, log } from './b-lib.mjs';
const browser = await launch();
for (const [email, route] of [[EMAIL.A3, '/admin/catalog'], [EMAIL.A1, '/admin/curriculum'], [EMAIL.A4, '/admin/access'], [EMAIL.S1, '/admin']]) {
  const page = await newPage(browser);
  await signIn(page, email);
  await goto(page, route);
  await page.locator('.lang-btn').first().click();
  await page.reload({ waitUntil: 'networkidle' });
  const en = await page.evaluate(() => ({ lang: document.documentElement.lang, title: document.title, h1: document.querySelector('h1')?.innerText, tabs: [...document.querySelectorAll('[data-test="admin-tabs"] a')].map((a) => a.innerText.trim()) }));
  check('A11Y-01d reload', `${route}: English stays after the reload`, en.lang === 'en' && en.h1 === 'Administration' && en.title.startsWith('Administration'), en);
  await page.locator('.lang-btn').first().click();
  await page.reload({ waitUntil: 'networkidle' });
  const vi = await page.evaluate(() => ({ lang: document.documentElement.lang, h1: document.querySelector('h1')?.innerText }));
  check('A11Y-01d reload', `${route}: Vietnamese again after switching back and reloading`, vi.lang === 'vi' && vi.h1 === 'Quản trị', vi);
  await page.context().close();
}
log(failureCount() ? `${failureCount()} FAIL(S)` : 'All checks ok');
await browser.close();
