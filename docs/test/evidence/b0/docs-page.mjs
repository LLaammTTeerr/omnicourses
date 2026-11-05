// Opens <API>/api/docs in headless Chrome and prints the Authorize button and the operation groups.
// Usage: node docs-page.mjs <playwright-core dir> <screenshot.png>
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2]);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto('http://localhost:3000/api/docs');
await page.locator('.opblock-tag').first().waitFor({ timeout: 15_000 });
const authorize = await page.getByRole('button', { name: /Authorize/ }).count();
const groups = await page.locator('.opblock-tag').allInnerTexts();
console.log(`Authorize buttons: ${authorize} | groups: ${groups.map((g) => g.trim().split('\n')[0]).join(', ')}`);
await page.screenshot({ path: process.argv[3] });
await browser.close();
