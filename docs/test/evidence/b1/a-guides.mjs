// TC-B1-GUIDE-01b, d and g, signed out, on staging. Staging holds no published guide (GET /api/guides answers an
// empty list), so this only records what the screens show with zero guides.
import { launch, newPage, BASE, api, check, log, mainText, shot, where, sleep } from './a-lib.mjs';

const browser = await launch();
const page = await newPage(browser);
const guideCalls = [];
page.on('response', (r) => r.url().includes('/api/guides') && guideCalls.push(`${r.request().method()} ${r.url().replace(BASE, '')} ${r.status()} auth:${r.request().headers().authorization ? 'yes' : 'no'}`));

const list = await api('GET', '/guides');
log('GET /api/guides without a token:', list.status, list.text.slice(0, 300));

// ---- GUIDE-01b
await page.goto(`${BASE}/guides`, { waitUntil: 'networkidle' });
await sleep(500);
const entries = await page.locator('[data-test^="guide-"]').count();
log('GUIDE-01b page:', where(page), '|', await mainText(page));
check('GUIDE-01b', 'the signed-out Guides page lists the four guides G01, G02, G06 and G07 under their groups', entries === 4, `${entries} guide(s) listed; API holds ${list.json?.guides?.length ?? '?'} guide(s)`);
await shot(page, 'a-guide-01b-list.png');

// ---- GUIDE-01d
await page.fill('input[type=search]', 'xyzzy');
await sleep(500);
const noMatch = (await page.locator('[data-test="no-match"]').count()) ? (await page.locator('[data-test="no-match"]').innerText()).replace(/\n+/g, ' | ') : null;
const body = await mainText(page);
log('GUIDE-01d after "xyzzy":', body);
check('GUIDE-01d', '"xyzzy": the page says no guide covers it yet and shows the task groups; no Suggest a guide, no advisor link', noMatch !== null && !/suggest|đề xuất|cố vấn|advisor/i.test(body), { noMatch });
await page.fill('input[type=search]', '');
await sleep(500);
const afterClear = await page.locator('[data-test^="guide-"]').count();
check('GUIDE-01d', 'once cleared, all four guides are back', afterClear === 4, `${afterClear} guide(s) listed`);
await shot(page, 'a-guide-01d-no-match.png');

// ---- GUIDE-01g
for (const id of ['register-courses', 'no-such-guide']) {
  await page.goto(`${BASE}/guides/${id}`, { waitUntil: 'networkidle' });
  await sleep(500);
  const apiAnswer = await api('GET', `/guides/${id}`);
  const notFound = await page.locator('[data-test="not-found"]').count();
  const backLink = await page.locator('[data-test="not-found"] a').getAttribute('href').catch(() => null);
  log(`GUIDE-01g /guides/${id}:`, where(page), '| not-found card:', notFound, '| link:', backLink, '| API:', apiAnswer.status, apiAnswer.text.slice(0, 160), '| text:', (await mainText(page)).slice(0, 300));
  if (id === 'register-courses') {
    check('GUIDE-01g', 'the guide address /guides/register-courses opens the guide directly, signed out', notFound === 0 && apiAnswer.status === 200, `not-found page shown: ${notFound === 1}; API ${apiAnswer.status}`);
    await shot(page, 'a-guide-01g-register-courses.png');
  } else {
    check('GUIDE-01g', 'the unknown address shows a "guide not found" page with a link to Guides, and its API request answers 404', notFound === 1 && backLink === '/guides' && apiAnswer.status === 404, `not-found page shown: ${notFound === 1}; link ${backLink}; API ${apiAnswer.status}`);
    await shot(page, 'a-guide-01g-not-found.png');
  }
}
log('guide API requests the page made (signed out):', JSON.stringify(guideCalls));
log('console errors:', JSON.stringify(page.consoleErrors));
await browser.close();
