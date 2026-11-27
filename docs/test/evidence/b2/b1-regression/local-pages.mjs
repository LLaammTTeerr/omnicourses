// DB-01c and DB-01d on the local B1 build, in headless Chromium (Playwright's bundled build).
// Usage: node local-pages.mjs home <app address> <screenshot.png>   prints the API status line of the home page
//        node local-pages.mjs docs <API address> <screenshot.png>   prints the Authorize button and the groups of /api/docs
// Copied from ../b0/home-status.mjs and ../b0/docs-page.mjs; the addresses are arguments now.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const [what, address, shot] = process.argv.slice(2);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
if (what === 'home') {
  await page.goto(address);
  const status = page.getByText(/API (ok|degraded)/);
  await status.waitFor({ timeout: 15_000 });
  console.log(`chromium ${browser.version()} | home page shows: "${(await status.innerText()).trim()}"`);
} else {
  await page.goto(`${address}/docs`);
  await page.locator('.opblock-tag').first().waitFor({ timeout: 15_000 });
  const authorize = await page.getByRole('button', { name: /Authorize/ }).count();
  const groups = await page.locator('.opblock-tag').allInnerTexts();
  console.log(`chromium ${browser.version()} | Authorize buttons: ${authorize} | groups: ${groups.map((g) => g.trim().split('\n')[0]).join(', ')}`);
}
await page.screenshot({ path: shot });
await browser.close();
