// Opens the app's home page in headless Chrome and prints the API status line it shows.
// Usage: node home-status.mjs <playwright-core dir> <screenshot.png>
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2]);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto('http://localhost:5173/');
const status = page.getByText(/API (ok|degraded)/);
await status.waitFor({ timeout: 15_000 });
console.log(`chrome ${browser.version()} | home page shows: "${(await status.innerText()).trim()}"`);
await page.screenshot({ path: process.argv[3] });
await browser.close();
