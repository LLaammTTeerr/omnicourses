// TC-B1-USER-01u: Export my data in Settings, compared with GET /api/users/me/export. Account a02 (onboarded, no
// transcript, no plan). The first try, at the end of a-ui-01.mjs, timed out on a wrong selector for the button.
import { readFileSync } from 'node:fs';
import { launch, newPage, BASE, email, screenSignIn, pageToken, api, check, log } from './a-lib.mjs';

const browser = await launch();
const page = await newPage(browser);
const S = email('02');
await screenSignIn(page, S);
await page.waitForURL(/dashboard/, { timeout: 15000 }).catch(() => {});
await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
const button = page.locator('#data .srow button').first();
log('button:', (await button.innerText()).trim());
const [download] = await Promise.all([page.waitForEvent('download'), button.click()]);
const saved = JSON.parse(readFileSync(await download.path(), 'utf8'));
const viaApi = (await api('GET', '/users/me/export', { token: await pageToken(page) })).json;
const count = (x) => Object.fromEntries(Object.entries(x.tables).map(([k, v]) => [k, v.length]));
check('USER-01u', 'Export my data saves a JSON file with the same tables and row counts as the API export', JSON.stringify(count(saved)) === JSON.stringify(count(viaApi)) && saved.user.email === S, { file: download.suggestedFilename(), fileTables: count(saved), apiTables: count(viaApi), topKeys: Object.keys(saved), userKeys: Object.keys(saved.user) });
const credentialKeys = JSON.stringify(saved).match(/"[A-Za-z_]*(_hash|_token|_secret|_key|_password|_sub|Hash|Token|Secret|Password)"\s*:/g) ?? [];
check('USER-01u', 'no credential-like key in the saved file', credentialKeys.length === 0, credentialKeys);
log('console errors:', JSON.stringify(page.consoleErrors));
await browser.close();
