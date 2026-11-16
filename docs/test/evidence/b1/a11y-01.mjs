// TC-B1-A11Y-01c, d and e (docs/test/test-cases-b1.md §5), plus a clean-browser check that Esc closes dialogs (01b).
//
// Run by the tester, who supplies P's password through the environment:
//   PowerShell:  $env:B1_PASSWORD = '<password>'; node a11y-01.mjs
// Optional: B1_BASE (default https://omnicourses.lamter.cc), B1_REPO (where node_modules/playwright is).
//
// Signs in as b1-perf (the PERF-01 fixture account) three times. Opening /plans gives that account a "Kế hoạch mặc
// định" plan if it has none. Writes results.json and screenshots to a new folder next to this script.

import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = process.env.B1_REPO ?? 'E:/Project/omnicourses';
const { chromium } = createRequire(join(REPO, 'package.json'))('playwright');
const AXE_PATH = join(HERE, 'axe', 'node_modules', 'axe-core', 'axe.min.js');
const AXE_VERSION = JSON.parse(readFileSync(join(HERE, 'axe', 'node_modules', 'axe-core', 'package.json'), 'utf8')).version;

const BASE = (process.env.B1_BASE ?? 'https://omnicourses.lamter.cc').replace(/\/$/, '');
const EMAIL = 'b1-perf@example.com';
const PASSWORD = process.env.B1_PASSWORD;
if (!PASSWORD) {
  console.error("Set B1_PASSWORD to P's password first.");
  process.exit(1);
}

const STAMP = new Date().toISOString().replace(/[:.]/g, '-');
const OUT = join(HERE, `a11y-01-${STAMP}`);
mkdirSync(join(OUT, 'shots'), { recursive: true });
const BASE_WIDTHS = [360, 768, 1280, 1920];
const AXE_WIDTHS = [360, 1280];
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const SIGN_IN_GAP_MS = 7000;
// B1_WIDTHS_ONLY=1: only the A11Y-01c width checks, in light and Vietnamese (no axe, screenshots, language or Esc).
const WIDTHS_ONLY = process.env.B1_WIDTHS_ONLY === '1';
const VI_LETTERS = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let lastSignIn = 0;
const results = { startedAt: new Date().toISOString(), base: BASE, axeVersion: AXE_VERSION, axeTags: AXE_TAGS, states: {}, esc: {} };

async function settle(page) {
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  await page
    .waitForFunction(() => !document.querySelector('[aria-busy="true"], [data-test="loading"]'), null, { timeout: 10000 })
    .catch(() => {});
  await sleep(400);
}
const go = (path) => async (page) => {
  await page.goto(`${BASE}${path}`);
  await settle(page);
};
const then = (first, more) => async (page) => {
  await first(page);
  await more(page);
  await settle(page);
};

// The screens and states of the A11Y-01 table that a script can reach without breaking the server or the network.
const SIGNED_OUT = {
  'home': go('/'),
  'sign-up empty': go('/sign-up'),
  'sign-up field errors': then(go('/sign-up'), (p) => p.click('button[type=submit]')),
  'sign-in empty': go('/sign-in'),
  'privacy signed out': go('/privacy'),
  'guides list': go('/guides'),
  'guides no results': then(go('/guides'), (p) => p.fill('main input', 'xyzzy')),
  'guide not found': go('/guides/no-such-guide'),
};
const SIGNED_IN = {
  'dashboard fixture': go('/dashboard'),
  'audit fixture': go('/audit'),
  'audit opened at a group': then(go('/dashboard'), (p) => p.click('a[href^="/audit#group-"]')),
  'explorer groups': go('/explorer'),
  'explorer no results': then(go('/explorer'), (p) => p.fill('main input[type=search]', 'xyzzy')),
  'explorer course drawer': then(go('/explorer'), (p) => p.click('main button.tile')),
  'plan list': go('/plans/all'),
  'plan editor': go('/plans'),
  'plan editor new-plan dialog': then(go('/plans'), (p) => p.click('[data-test="new-plan"]')),
  'transcript': go('/transcript'),
  'settings': go('/settings'),
  'settings delete dialog': then(go('/settings'), (p) => p.getByRole('button', { name: /^(Xóa tài khoản|Delete account)$/ }).first().click()),
  'privacy signed in': go('/privacy'),
};

async function newContext(browser, { theme, lang }) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: lang === 'en' ? 'en-GB' : 'vi-VN' });
  await context.addInitScript(
    ([t, l]) => {
      try {
        localStorage.setItem('omnicourse.theme', t);
        localStorage.setItem('omnicourse.lang', l);
      } catch {}
    },
    [theme, lang],
  );
  return { context, page: await context.newPage() };
}

async function signIn(page) {
  const wait = lastSignIn + SIGN_IN_GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastSignIn = Date.now();
  await page.goto(`${BASE}/sign-in`);
  await page.fill('input[type=email]', EMAIL);
  await page.fill('input[type=password]', PASSWORD);
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.startsWith('/sign-in'), { timeout: 30000 });
}

async function breakpoints(page) {
  return page.evaluate(() => {
    const px = new Set();
    for (const sheet of document.styleSheets) {
      let rules;
      try {
        rules = sheet.cssRules;
      } catch {
        continue;
      }
      for (const r of rules) {
        const text = r.conditionText ?? r.media?.mediaText ?? '';
        // Both syntaxes: (max-width: 900px) and the range form the build emits, (width <= 900px).
        for (const m of text.matchAll(/(?:(?:min|max)-width:\s*|width\s*[<>]=?\s*)([\d.]+)px/g)) px.add(Math.round(Number(m[1])));
      }
    }
    return [...px].sort((a, b) => a - b);
  });
}

const slug = (s) => s.replace(/[^a-z0-9]+/gi, '-').toLowerCase();

async function widthChecks(page, widths) {
  const out = [];
  for (const w of widths) {
    await page.setViewportSize({ width: w, height: 800 });
    await sleep(150);
    const r = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth }));
    out.push({ width: w, ...r, ok: r.scrollWidth <= r.innerWidth });
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  return out;
}

async function axeRun(page) {
  if (!(await page.evaluate(() => typeof window.axe === 'object'))) await page.addScriptTag({ path: AXE_PATH });
  return page.evaluate(async (tags) => {
    const r = await window.axe.run(document, { runOnly: { type: 'tag', values: tags }, resultTypes: ['violations'] });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, targets: v.nodes.slice(0, 5).map((n) => n.target.join(' ')) }));
  }, AXE_TAGS);
}

async function languageScan(page) {
  return page.evaluate((src) => {
    const vi = new RegExp(src, 'i');
    const seen = new Set();
    const hits = [];
    const add = (where, text) => {
      const t = (text ?? '').trim().replace(/\s+/g, ' ');
      if (!t || !vi.test(t) || seen.has(where + t)) return;
      seen.add(where + t);
      hits.push(`${where}: ${t.slice(0, 90)}`);
    };
    for (const line of document.body.innerText.split('\n')) add('text', line);
    for (const el of document.querySelectorAll('[aria-label],[placeholder],[title],[alt]'))
      for (const a of ['aria-label', 'placeholder', 'title', 'alt']) if (el.hasAttribute(a)) add(a, el.getAttribute(a));
    add('title', document.title);
    return { htmlLang: document.documentElement.lang, title: document.title, hits: hits.slice(0, 80), hitCount: hits.length };
  }, VI_LETTERS.source);
}

async function runStates(page, states, { theme, lang }, widths) {
  for (const [name, setup] of Object.entries(states)) {
    const key = `${name} | ${theme} | ${lang}`;
    const entry = { state: name, theme, lang };
    try {
      await page.setViewportSize({ width: 1280, height: 800 });
      await setup(page);
      entry.url = new URL(page.url()).pathname + new URL(page.url()).hash;
      if (WIDTHS_ONLY) {
        entry.widths = await widthChecks(page, widths);
      } else if (lang === 'vi') {
        if (theme === 'light') entry.widths = await widthChecks(page, widths);
        entry.axe = {};
        for (const w of AXE_WIDTHS) {
          await page.setViewportSize({ width: w, height: 800 });
          await sleep(200);
          await page.screenshot({ path: join(OUT, 'shots', `${slug(name)}-${theme}-${w}.png`), fullPage: true });
          entry.axe[w] = await axeRun(page);
        }
        await page.setViewportSize({ width: 1280, height: 800 });
      } else {
        entry.language = await languageScan(page);
      }
    } catch (e) {
      entry.error = String(e.message ?? e).split('\n')[0];
    }
    results.states[key] = entry;
    const wBad = entry.widths?.filter((x) => !x.ok).map((x) => x.width) ?? [];
    const contrast = entry.axe ? Object.values(entry.axe).flat().filter((v) => v.id === 'color-contrast').length : 0;
    const other = entry.axe ? [...new Set(Object.values(entry.axe).flat().filter((v) => v.id !== 'color-contrast').map((v) => v.id))] : [];
    console.log(
      `${key}: ${entry.error ? 'ERROR ' + entry.error : ''}${entry.widths ? `sideways scroll at [${wBad.join(', ')}]` : ''}${entry.axe ? ` · color-contrast ${contrast} · other axe [${other.join(', ')}]` : ''}${entry.language ? `lang=${entry.language.htmlLang}, ${entry.language.hitCount} Vietnamese strings` : ''}`,
    );
  }
}

async function escChecks(page) {
  // A11Y-01b in a browser without extensions: Esc closes the drawer and dialogs, and focus goes back to the opener.
  const check = async (name, setup, opener) => {
    try {
      await setup(page);
      const before = await page.evaluate(() => !!document.querySelector('dialog[open]'));
      await page.keyboard.press('Escape');
      await sleep(500);
      const after = await page.evaluate(
        (sel) => ({
          open: !!document.querySelector('dialog[open]'),
          focusOnOpener: !!document.activeElement?.matches(sel),
          focus: `${document.activeElement?.tagName.toLowerCase()} "${(document.activeElement?.getAttribute('aria-label') || document.activeElement?.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40)}"`,
        }),
        opener,
      );
      results.esc[name] = { openBefore: before, openAfterEsc: after.open, focusBackOnOpener: after.focusOnOpener, focusAfter: after.focus };
    } catch (e) {
      results.esc[name] = { error: String(e.message ?? e).split('\n')[0] };
    }
    console.log(`Esc ${name}: ${JSON.stringify(results.esc[name])}`);
  };
  await check('explorer course drawer', SIGNED_IN['explorer course drawer'], 'main button.tile');
  await check('settings delete dialog', SIGNED_IN['settings delete dialog'], 'button');
  await check('plan editor new-plan dialog', SIGNED_IN['plan editor new-plan dialog'], '[data-test="new-plan"]');
}

const browser = await chromium.launch({ channel: 'chrome', headless: true });
results.chrome = browser.version();
console.log(`Chrome ${results.chrome}, axe-core ${AXE_VERSION}, base ${BASE}`);
try {
  // Light, Vietnamese: widths, axe, screenshots, then the Esc checks.
  let { context, page } = await newContext(browser, { theme: 'light', lang: 'vi' });
  await page.goto(`${BASE}/`);
  const bps = await breakpoints(page);
  const widths = [...new Set([...BASE_WIDTHS, ...bps.flatMap((b) => [b - 1, b, b + 1])])].filter((w) => w >= 320).sort((a, b) => a - b);
  results.breakpoints = bps;
  results.widths = widths;
  console.log(`CSS breakpoints: ${bps.join(', ')} -> widths tested: ${widths.join(', ')}`);
  await runStates(page, SIGNED_OUT, { theme: 'light', lang: 'vi' }, widths);
  await signIn(page);
  await runStates(page, SIGNED_IN, { theme: 'light', lang: 'vi' }, widths);
  if (!WIDTHS_ONLY) await escChecks(page);
  await context.close();

  if (!WIDTHS_ONLY) {
    // Dark, Vietnamese: axe and screenshots.
    ({ context, page } = await newContext(browser, { theme: 'dark', lang: 'vi' }));
    await runStates(page, SIGNED_OUT, { theme: 'dark', lang: 'vi' }, widths);
    await signIn(page);
    await runStates(page, SIGNED_IN, { theme: 'dark', lang: 'vi' }, widths);
    await context.close();

    // Light, English: the language scan.
    ({ context, page } = await newContext(browser, { theme: 'light', lang: 'en' }));
    await runStates(page, SIGNED_OUT, { theme: 'light', lang: 'en' }, widths);
    await signIn(page);
    await runStates(page, SIGNED_IN, { theme: 'light', lang: 'en' }, widths);
    await context.close();
  }
} finally {
  await browser.close();
  results.finishedAt = new Date().toISOString();
  writeFileSync(join(OUT, 'results.json'), JSON.stringify(results, null, 2));
  console.log(`Results and screenshots: ${OUT}`);
}
