// A11Y-01e recheck of the rebuilt dashboard (28 Nov, r28, staging 4b038fe): a11y-01.mjs found color-contrast on the
// dashboard's .delta chip and its group list, possibly measured while the dashboard's opening animation ran. This
// script opens /dashboard as P with reducedMotion 'reduce' in the context, waits until the page is drawn, nothing is
// busy and every running animation has finished, then runs axe-core 4.10.2 (the same tags as a11y-01.mjs) in the light
// and dark themes at 360 and 1280 px, Vietnamese. For each color-contrast node it prints the target and axe's colours
// and ratio. Screenshots go outside git (SHOTS). Never prints a token.
import { createRequire } from 'node:module';
import { join } from 'node:path';
const { chromium } = createRequire('E:/Project/omnicourses/package.json')('playwright');
const BASE = 'https://stag-omnicourses.lamter.cc';
const AXE_PATH = join(process.env.AXE_DIR, 'node_modules', 'axe-core', 'axe.min.js');
const SHOTS = process.env.SHOTS ?? 'E:/Project/omnicourses-b2-evidence/b1-regression-r28';
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const browser = await chromium.launch({ channel: 'chrome', headless: true });
console.log(`Chrome ${browser.version()}, reducedMotion: reduce`);
let failing = 0;
for (const theme of ['light', 'dark']) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'vi-VN', reducedMotion: 'reduce' });
  await context.addInitScript((t) => { try { localStorage.setItem('omnicourse.theme', t); localStorage.setItem('omnicourse.lang', 'vi'); } catch {} }, theme);
  const page = await context.newPage();
  await page.goto(`${BASE}/sign-in`);
  await page.fill('input[type=email]', process.env.B1_EMAIL);
  await page.fill('input[type=password]', process.env.B1_PASSWORD);
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.startsWith('/sign-in'), { timeout: 30000 });
  await page.mouse.move(1, 1);
  for (const width of [360, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]') && /7,77/.test(document.querySelector('[data-test="gpa-accumulated-average"]')?.textContent ?? ''), null, { timeout: 20000 });
    await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))));
    await page.waitForTimeout(1500);
    const running = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length);
    await page.addScriptTag({ path: AXE_PATH });
    const result = await page.evaluate(async (tags) => {
      const r = await window.axe.run(document, { runOnly: { type: 'tag', values: tags }, resultTypes: ['violations'] });
      return r.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => ({ target: n.target.join(' '), data: n.any?.[0]?.data ?? null })) }));
    }, TAGS);
    const cc = result.find((v) => v.id === 'color-contrast');
    const others = result.filter((v) => v.id !== 'color-contrast').map((v) => v.id);
    if (cc) failing++;
    console.log(`dashboard | ${theme} | ${width}: animations still running ${running}; color-contrast ${cc ? cc.nodes.length : 0}; other axe ${JSON.stringify(others)}`);
    for (const n of cc?.nodes ?? []) console.log(`  ${n.target}: ${n.data ? `${n.data.fgColor} on ${n.data.bgColor}, ${n.data.contrastRatio}:1 (needs ${n.data.expectedContrastRatio}), ${n.data.fontSize} ${n.data.fontWeight}` : 'no colour data'}`);
    await page.screenshot({ path: join(SHOTS, `a11y-01e-dashboard-recheck-${theme}-${width}.png`), fullPage: true });
  }
  await context.close();
}
console.log(`${failing} of 4 theme/width runs with a color-contrast violation`);
await browser.close();
