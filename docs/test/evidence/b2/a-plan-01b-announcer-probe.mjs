// PLAN-01b(2) follow-up: records every text the live region [data-test="announcer"] takes during Space, ArrowDown, Escape on CS470.
import { BASE, launch, newPage, signIn, settle, sleep } from './b-lib.mjs';
import { log } from './c-lib.mjs';
const browser = await launch();
const page = await newPage(browser, { lang: 'en', height: 900 });
await signIn(page, 'b2-s15@example.com');
await page.goto(`${BASE}/plans/a1e740c8-7b68-4766-85ad-7f6c7231b528`, { waitUntil: 'networkidle' });
await settle(page, 1500);
await page.evaluate(() => {
  window.__said = [];
  const el = document.querySelector('[data-test="announcer"]');
  new MutationObserver(() => window.__said.push(`${Math.round(performance.now())} ${el.textContent}`)).observe(el, { childList: true, characterData: true, subtree: true });
});
await page.locator('[data-test="tile-CS470"]').focus();
await page.keyboard.press('Space');
await sleep(1500);
await page.keyboard.press('ArrowUp');
await sleep(1500);
await page.keyboard.press('Escape');
await sleep(300);
log(`announcer texts, in order: ${JSON.stringify(await page.evaluate(() => window.__said), null, 1)}`);
await browser.close();
