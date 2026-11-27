// TC-B1-A11Y-01c, the mechanical part only: `document.documentElement.scrollWidth <= innerWidth` at 360, 768, 1280
// and 1920 px and at every breakpoint of the deployed CSS (its value and 1 px either side), height 800, Vietnamese,
// light theme. It covers one state of each screen listed below, not every state of the case's table, and it does not
// judge overlap or cut-off content: a person still looks at the screens.
import { launch, newPage, BASE, PASSWORD, email, api, openSignedIn, log, check } from './a-lib.mjs';

const html = await (await fetch(`${BASE}/`)).text();
const cssFiles = [...html.matchAll(/href="(\/assets\/[^"]+\.css)"/g)].map((m) => m[1]);
let css = '';
for (const f of cssFiles) css += await (await fetch(`${BASE}${f}`)).text();
const media = [...new Set([...css.matchAll(/@media[^{]*/g)].map((m) => m[0].trim()))].sort();
const points = [...new Set(media.flatMap((q) => [...q.matchAll(/(\d+(?:\.\d+)?)px/g)].map((m) => Math.round(Number(m[1])))))].filter((n) => n >= 300 && n <= 2000).sort((a, b) => a - b);
const widths = [...new Set([360, 768, 1280, 1920, ...points.flatMap((p) => [p - 1, p, p + 1])])].filter((w) => w >= 360 && w <= 1920).sort((a, b) => a - b);
log('CSS files:', JSON.stringify(cssFiles));
log('@media queries in the deployed CSS:', JSON.stringify(media));
log('widths tested:', JSON.stringify(widths));

const signIn = async (address) => (await api('POST', '/auth/sign-in', { body: { email: address, password: PASSWORD } })).json.token;
const browser = await launch();
const results = [];
async function sweep(page, label, prepare) {
  const bad = [];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 800 });
    if (prepare) await prepare();
    await page.waitForTimeout(120);
    const r = await page.evaluate(() => ({ ok: document.documentElement.scrollWidth <= innerWidth, scrollWidth: document.documentElement.scrollWidth }));
    if (!r.ok) bad.push(`${width}px: scrollWidth ${r.scrollWidth}`);
  }
  results.push({ label, bad });
  console.log(`${bad.length ? 'FAIL' : 'ok  '} A11Y-01c ${label}: ${bad.length ? bad.join('; ') : `no sideways scroll at ${widths.length} widths`}`);
}

// Signed out
let page = await newPage(browser);
for (const [label, route] of [['Home, signed out, API ok', '/'], ['Sign in, empty', '/sign-in'], ['Sign up, empty', '/sign-up'], ['Privacy notice, signed out', '/privacy'], ['Guides list, signed out (no guide published on staging)', '/guides'], ['Guide not found', '/guides/no-such-guide']]) {
  await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
  await sweep(page, `${label} (${route})`);
}
await page.goto(`${BASE}/sign-up`, { waitUntil: 'networkidle' });
await page.click('button[type=submit]');
await sweep(page, 'Sign up, each field error (/sign-up)');
await page.context().close();

// Onboarding, unfinished account a05
page = await newPage(browser);
await openSignedIn(page, await signIn(email('05')), '/onboarding');
await page.locator('[data-test="program-APCS"]').waitFor();
await sweep(page, 'Onboarding, program question (/onboarding)');
await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
await sweep(page, 'Settings, onboarding unfinished (/settings)');
await page.context().close();

// Signed in with the completion fixture, a04
page = await newPage(browser);
await openSignedIn(page, await signIn(email('04')), '/dashboard');
await page.locator('[data-test="credits-toward-total"]').waitFor();
await sweep(page, 'Dashboard, the completion fixture (/dashboard)');
for (const [label, route, wait] of [['Audit, the completion fixture', '/audit', '[data-test="credits-toward-total"]'], ['Explorer, groups', '/explorer', '[data-test="group"]'], ['Transcript, 45 rows', '/transcript', 'main, .page'], ['Settings, profile and goal', '/settings', '[data-test="study-form"]'], ['Privacy notice, signed in', '/privacy', 'article.privacy']]) {
  await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
  await page.locator(wait).first().waitFor();
  await sweep(page, `${label} (${route})`);
}
await page.goto(`${BASE}/explorer`, { waitUntil: 'networkidle' });
await page.fill('input[type=search]', 'zzzzzz');
await sweep(page, 'Explorer, search with no results (/explorer)');
await page.fill('input[type=search]', '');
await page.click('[data-test="course-CS163"]');
await page.locator('dialog.drawer[open]').waitFor();
await sweep(page, 'Explorer, course drawer open (/explorer)');
check('A11Y-01c', `no sideways scroll on the ${results.length} screen states covered`, results.every((r) => r.bad.length === 0), results.filter((r) => r.bad.length).map((r) => r.label));
log('console errors:', JSON.stringify(page.consoleErrors));
await browser.close();
