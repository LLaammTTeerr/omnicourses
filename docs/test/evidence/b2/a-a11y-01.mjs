// TC-B2-A11Y-01c–h on the administration screens (docs/test/test-cases-b2.md §10), on staging.
//   node docs/test/evidence/b2/a-a11y-01.mjs            every state: widths, language, axe, names and roles, contrast
// Headless Chrome through playwright-core. axe-core 4.10.2 (B1's version), from AXE_DIR (default: ./axe beside this
// script, as B1). Writes a11y-01-admin-<stamp>-results.json beside this script and screenshots to SHOTS (outside git).
// Reaches the states with the accounts and test data of ADM-01d–e, ADM-02i–j, ADM-05e–g and ADM-06g, and undoes each
// one: ZZADM05S is created at the start and deleted at the end, A1's grant revoked for ADM-02j's banner is given back.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  ID, EMAIL, BASE, api, apiSignIn, launch, newPage, signIn, settle, mark, sent, fmt, block, pageToken, where, focused,
  goto, check, failureCount, log, sleep, EVIDENCE,
} from './b-lib.mjs';

const AXE_DIR = process.env.AXE_DIR ?? path.join(EVIDENCE, 'axe');
const AXE_PATH = path.join(AXE_DIR, 'node_modules', 'axe-core', 'axe.min.js');
const AXE_VERSION = JSON.parse(readFileSync(path.join(AXE_DIR, 'node_modules', 'axe-core', 'package.json'), 'utf8')).version;
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const SHOTS = process.env.SHOTS ?? 'E:/Project/omnicourses-b2-evidence/a11y-01-admin-shots';
mkdirSync(SHOTS, { recursive: true });
// B1's widths, and each breakpoint of the administration's CSS at its value and 1 px on the other side (760, 620).
const WIDTHS = [360, 768, 1280, 1920, 760, 761, 620, 621];
const AXE_WIDTHS = [360, 1280];
const STAMP = new Date().toISOString().replace(/[:.]/g, '-');
const results = { startedAt: new Date().toISOString(), base: BASE, build: '5a5b9d5', axeVersion: AXE_VERSION, axeTags: AXE_TAGS, widths: WIDTHS, states: {}, contrast: [] };
const save = () => writeFileSync(path.join(EVIDENCE, `a11y-01-admin-${STAMP}-results.json`), JSON.stringify(results, null, 2));

const AE = 'Kiến thức Computer Science (A): tự chọn';
const AC = 'Tự chọn Computer Science (C)';
const KG = 'Kiến thức bắt buộc chuyên ngành';
const tt = (loc) => loc.innerText().then((s) => s.trim()).catch(() => null);
const visible = (loc) => loc.isVisible().catch(() => false);

// ---- Theme and language, changed in place so the state stays (a modal dialog makes the sidebar inert to the mouse,
// so the buttons are pressed from script; if that fails, the app's own store is used).
async function setTheme(page, theme) {
  if ((await page.evaluate(() => document.documentElement.dataset.theme)) === theme) return;
  await page.evaluate(() => document.querySelector('.theme-btn')?.click());
  await sleep(150);
  if ((await page.evaluate(() => document.documentElement.dataset.theme)) !== theme) {
    await page.evaluate((t) => document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('theme').set(t), theme);
  }
  await sleep(250);
}
async function setLang(page, lang) {
  if ((await page.evaluate(() => document.documentElement.lang)) === lang) return;
  await page.evaluate(() => document.querySelector('.lang-btn')?.click());
  await sleep(150);
  if ((await page.evaluate(() => document.documentElement.lang)) !== lang) {
    await page.evaluate((l) => document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('locale').set(l), lang);
  }
  await sleep(300);
}

// ---- The checks run on each state ---------------------------------------------------------------
async function widths(page) {
  const out = [];
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: 800 });
    await sleep(250);
    out.push(await page.evaluate((width) => {
      const off = [...document.querySelectorAll('main button, main a.btn, dialog[open] button')]
        .filter((b) => b.offsetParent !== null && b.getClientRects().length)
        .map((b) => ({ b, r: b.getBoundingClientRect() }))
        .filter(({ r }) => r.right > innerWidth + 1 || r.left < -1)
        .map(({ b }) => (b.getAttribute('aria-label') || b.innerText).trim().slice(0, 40));
      // At 760 px and below, a table that is a list of cards labels each value with its column (data-label).
      const cardTables = width <= 760 ? [...document.querySelectorAll('main table.admin-cards, dialog[open] table.admin-cards')].filter((t) => t.offsetParent !== null).map((t) => {
        const cells = [...t.querySelectorAll('tbody td')].filter((td) => td.offsetParent !== null && td.innerText.trim() && !td.classList.contains('acts') && !td.classList.contains('name'));
        return { cards: getComputedStyle(t.querySelector('tbody tr') ?? t).display !== 'table-row', unlabeled: cells.filter((td) => !td.dataset.label).map((td) => td.innerText.trim().slice(0, 30)) };
      }) : [];
      return { width, scrollWidth: document.documentElement.scrollWidth, innerWidth, ok: document.documentElement.scrollWidth <= innerWidth, offscreenButtons: off, cardTables };
    }, w));
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  await sleep(200);
  return out;
}

async function axe(page) {
  const out = {};
  for (const theme of ['light', 'dark']) {
    await setTheme(page, theme);
    for (const w of AXE_WIDTHS) {
      await page.setViewportSize({ width: w, height: 800 });
      await sleep(300);
      if (!(await page.evaluate(() => typeof window.axe === 'object'))) await page.addScriptTag({ path: AXE_PATH });
      out[`${theme}-${w}`] = await page.evaluate(async (tags) => {
        const r = await window.axe.run(document, { runOnly: { type: 'tag', values: tags }, resultTypes: ['violations'] });
        return r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, targets: v.nodes.slice(0, 6).map((n) => n.target.join(' ')), summary: v.nodes[0]?.failureSummary?.split('\n').slice(0, 3).join(' ') }));
      }, AXE_TAGS);
    }
  }
  await setTheme(page, 'light');
  await page.setViewportSize({ width: 1280, height: 800 });
  await sleep(200);
  return out;
}

/** Visible text nodes, with whether they sit inside data (a code, a curriculum's own names) or lang="en". */
const textNodes = (page) => page.evaluate(() => {
  const VI = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
  const root = document.querySelector('dialog[open]') ?? document.body;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const out = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const s = n.textContent.trim();
    const el = n.parentElement;
    if (!s || !el || el.closest('script,style,[hidden]') || !el.getClientRects().length) continue;
    out.push({ s: s.slice(0, 120), vi: VI.test(s), en: !!el.closest('[lang="en"]'), tag: el.tagName.toLowerCase() });
  }
  const attrs = [...root.querySelectorAll('[aria-label],[placeholder],[title]')].flatMap((e) => ['aria-label', 'placeholder', 'title'].map((a) => e.getAttribute(a)).filter(Boolean)).map((s) => ({ s, vi: VI.test(s), attr: true }));
  return [...out, ...attrs];
});
async function language(page) {
  const vi = await textNodes(page);
  const enInVi = [...new Set(vi.filter((t) => t.en && !t.attr).map((t) => t.s))];
  await setLang(page, 'en');
  const en = await textNodes(page);
  const htmlLang = await page.evaluate(() => document.documentElement.lang);
  const title = await page.title();
  const viInEn = [...new Set(en.filter((t) => t.vi).map((t) => t.s))];
  await setLang(page, 'vi');
  return { htmlLangAfterSwitch: htmlLang, titleInEnglish: title, vietnameseLeftInEnglish: viInEn, englishMarkedLangEnInVietnamese: enInVi };
}

/** Names and roles (A11Y-01h) and words beside colour (A11Y-01g), read from the DOM. */
const namesAndRoles = (page) => page.evaluate(() => {
  const name = (e) => (e.getAttribute('aria-label') || (e.getAttribute('aria-labelledby') ?? '').split(' ').map((id) => document.getElementById(id)?.innerText ?? '').join(' ') || e.innerText || e.getAttribute('title') || '').trim();
  const scope = document.querySelector('dialog[open]') ?? document;
  const iconOnly = [...scope.querySelectorAll('button, a')].filter((b) => b.getClientRects().length && !b.innerText.trim()).map((b) => ({ name: name(b), test: b.dataset.test ?? null }));
  const fields = [...scope.querySelectorAll('input:not([type=hidden]), textarea, [role=combobox]')].filter((f) => f.getClientRects().length).map((f) => {
    const label = f.labels?.[0]?.innerText ?? f.getAttribute('aria-label') ?? (f.closest('label')?.innerText ?? '');
    const invalid = f.getAttribute('aria-invalid') === 'true';
    const described = (f.getAttribute('aria-describedby') ?? '').split(' ').map((id) => document.getElementById(id)?.innerText?.trim()).filter(Boolean);
    return { id: f.id || f.dataset.test || null, label: label.trim().slice(0, 60), invalid, described };
  });
  const dialogs = [...document.querySelectorAll('dialog[open]')].map((d) => ({ role: d.getAttribute('role') ?? 'dialog', name: name(d), modal: d.matches(':modal') }));
  const alerts = [...document.querySelectorAll('[role=alert]')].filter((e) => e.getClientRects().length).map((e) => e.innerText.trim().slice(0, 100));
  const statuses = [...document.querySelectorAll('[role=status]')].filter((e) => e.getClientRects().length && e.innerText.trim()).map((e) => ({ test: e.dataset.test ?? null, text: e.innerText.trim().slice(0, 100) }));
  const toastRegions = document.querySelectorAll('[data-test="toast"][role="status"]').length;
  const nav = document.querySelector('[data-test="admin-tabs"]');
  const chips = [...scope.querySelectorAll('.chip')].filter((c) => c.getClientRects().length).map((c) => c.innerText.trim());
  return { iconOnly, fields, dialogs, alerts, statuses, toastRegions, tabsNav: nav ? { role: nav.tagName.toLowerCase(), name: nav.getAttribute('aria-label') } : null, chipsWithoutWords: chips.filter((c) => !c) };
});

async function capture(page, id, notes = {}) {
  log(`state ${id} at ${where(page)}`);
  const entry = { url: where(page), notes };
  await page.screenshot({ path: path.join(SHOTS, `${id}-1280-light.png`) }).catch(() => {});
  entry.h = await namesAndRoles(page);
  entry.c = await widths(page);
  entry.e = await axe(page);
  await page.setViewportSize({ width: 360, height: 800 });
  await setTheme(page, 'dark');
  await page.screenshot({ path: path.join(SHOTS, `${id}-360-dark.png`) }).catch(() => {});
  await setTheme(page, 'light');
  await page.setViewportSize({ width: 1280, height: 800 });
  entry.d = await language(page);
  results.states[id] = entry;
  const badWidths = entry.c.filter((x) => !x.ok || x.offscreenButtons.length || x.cardTables.some((t) => !t.cards || t.unlabeled.length));
  const contrast = Object.entries(entry.e).flatMap(([k, v]) => v.filter((x) => x.id === 'color-contrast').map(() => k));
  const other = Object.entries(entry.e).flatMap(([k, v]) => v.filter((x) => x.id !== 'color-contrast').map((x) => `${k}:${x.id}`));
  console.log(`  c ${badWidths.length ? `ISSUES ${JSON.stringify(badWidths.map((x) => ({ w: x.width, sw: x.scrollWidth, off: x.offscreenButtons, cards: x.cardTables })))}` : 'ok'} | e color-contrast ${contrast.join(',') || 'none'} | e other ${other.join(',') || 'none'} | d html lang ${entry.d.htmlLangAfterSwitch}, vi left ${entry.d.vietnameseLeftInEnglish.length}, en in vi ${entry.d.englishMarkedLangEnInVietnamese.length}`);
  save();
}

// ---- Contrast pairs (A11Y-01f), read from the computed colours and composited over what is under them ----------
const measure = (page, items) => page.evaluate((items) => {
  const cv = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  const rgba = (css) => { cv.clearRect(0, 0, 1, 1); cv.fillStyle = '#000'; cv.fillStyle = css; cv.fillRect(0, 0, 1, 1); const d = cv.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const over = (top, under) => { const a = top[3]; return [0, 1, 2].map((i) => top[i] * a + under[i] * (1 - a)).concat(1); };
  const bgOf = (el) => {
    const layers = [];
    for (let e = el; e; e = e.parentElement) { const c = rgba(getComputedStyle(e).backgroundColor); if (c[3] > 0) layers.push(c); if (c[3] >= 1) break; }
    let base = rgba(getComputedStyle(document.body).backgroundColor);
    for (const l of layers.reverse()) base = over(l, base);
    return base;
  };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100; };
  const hex = (c) => '#' + c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
  return items.map(({ label, selector, kind, prop }) => {
    const el = [...document.querySelectorAll(selector)].find((e) => e.getClientRects().length);
    if (!el) return { label, selector, found: false };
    const cs = getComputedStyle(el);
    const bg = bgOf(kind === 'text' ? el : el.parentElement ?? el);
    const fgRaw = rgba(kind === 'text' ? cs.color : cs[prop]);
    const fg = over(fgRaw, bgOf(el));
    const size = parseFloat(cs.fontSize);
    const bold = Number(cs.fontWeight) >= 700;
    const large = size >= 24 || (bold && size >= 18.66);
    const required = kind === 'text' ? (large ? 3 : 4.5) : 3;
    const r = ratio(fg, bg);
    return { label, selector, found: true, kind, prop: kind === 'text' ? 'color' : prop, fg: hex(fg), bg: hex(bg), ratio: r, required, pass: r >= required, text: (el.innerText ?? '').trim().slice(0, 40) };
  });
}, items);
async function contrast(page, where_, items) {
  for (const theme of ['light', 'dark']) {
    await setTheme(page, theme);
    const rows = await measure(page, items);
    for (const r of rows) results.contrast.push({ where: where_, theme, ...r });
    console.log(`  f ${where_} ${theme}: ${rows.map((r) => (r.found ? `${r.label} ${r.ratio}${r.pass ? '' : ` < ${r.required} FAIL`}` : `${r.label} not found`)).join(' | ')}`);
  }
  await setTheme(page, 'light');
  save();
}
/** The focus ring: Tab onto an element, then read its outline (or box-shadow) colour against what is under it. */
async function focusRing(page, where_, selector) {
  for (const theme of ['light', 'dark']) {
    await setTheme(page, theme);
    await page.focus(selector).catch(() => {});
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    const ring = await page.evaluate(() => {
      const e = document.activeElement; const cs = getComputedStyle(e);
      return { focus: e.dataset.test || e.id || e.tagName, outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}`, boxShadow: cs.boxShadow, focusVisible: e.matches(':focus-visible') };
    });
    const [m] = await measure(page, [{ label: 'focus ring', selector: ':focus-visible', kind: 'border', prop: ring.outline.startsWith('none') ? 'borderColor' : 'outlineColor' }]);
    results.contrast.push({ where: where_, theme, ...m, ring });
    console.log(`  f ${where_} ${theme}: focus ring on ${ring.focus} ${ring.outline} | ${ring.boxShadow} → ${m.ratio} (needs 3)`);
  }
  await setTheme(page, 'light');
}

// ---- Helpers to reach the states (the same steps as the cases) ----------------------------------------
async function pick(page, test, label) {
  const trigger = page.locator(`[data-test="${test}"]`);
  await trigger.click();
  await page.locator(`#${await trigger.getAttribute('aria-controls')} [role="option"]`, { hasText: label }).first().click();
  await settle(page, 300);
}
async function openGroup(page, name) {
  if (!(await tt(page.locator('[data-test="admin-program"]')))?.startsWith('APCS')) await pick(page, 'admin-program', 'APCS ·');
  if (!(await tt(page.locator('[data-test="admin-cohort"]')))?.includes('2024')) await pick(page, 'admin-cohort', '2024');
  await page.locator(`[data-test="group-row"][data-group-name="${name}"] [data-test="group-open"]`).click();
  await settle(page, 300);
}
const row = (page, code) => page.locator(`[data-test="group-panel"] [data-test="course-row"][data-course="${code}"]`);
const cancel = async (page) => { await page.click('dialog[open] [data-test="dialog-cancel"], dialog[open] [data-test="confirm-no"]'); await settle(page, 300); };
async function findCourse(page, code) { await page.fill('[data-test="catalog-code"]', code); await page.click('[data-test="catalog-find"]'); await settle(page, 300); }

// =========================================================================================================
const browser = await launch();
log(`axe-core ${AXE_VERSION}; screenshots in ${SHOTS}`);
const a1t = await apiSignIn(EMAIL.A1);
const a2t = await apiSignIn(EMAIL.A2);
const a3t = await apiSignIn(EMAIL.A3);
const a4t = await apiSignIn(EMAIL.A4);
const apcs = (await api('GET', '/admin/programs', a1t)).json.programs.find((p) => p.code === 'APCS');
const khmt = (await api('GET', '/admin/programs', a2t)).json.programs.find((p) => p.code === 'CNTT-TCTA-KHMT');
const APCS24 = apcs.curricula.find((c) => c.cohortYear === 2024).id;
const KHMT25 = khmt.curricula.find((c) => c.cohortYear === 2025).id;
const c24 = (await api('GET', '/programs/APCS/curricula/2024', a1t)).json;
const groupId = (c, n) => c.requirementGroups.find((g) => g.name === n).id;
const ACid = groupId(c24, AC);
const KGid = groupId((await api('GET', '/programs/CNTT-TCTA-KHMT/curricula/2025', a2t)).json, KG);
const setupCourse = await api('POST', '/admin/catalog/courses', a3t, { code: 'ZZADM05S', nameVi: 'Học phần thử ADM-05 màn hình', credits: 3 });
check('setup', 'ZZADM05S created for the catalog states (201)', setupCourse.status === 201);

try {
  // ---- S1: no permission, the grants not checked, Settings ------------------------------------------
  {
    const page = await newPage(browser);
    await signIn(page, EMAIL.S1);
    await goto(page, '/admin');
    await capture(page, 'admin-no-permission');
    await contrast(page, 'no-permission card', [{ label: 'card text', selector: '[data-test="admin-no-permission"] p.t2', kind: 'text' }]);
    const unblock = await block(page, 'api/admin/grants');
    await page.reload({ waitUntil: 'networkidle' });
    await settle(page);
    check('A11Y-01 states', 'grants not checked: "Chưa kiểm tra được quyền quản trị của bạn." with Thử lại', (await tt(page.locator('[data-test="admin-grants-failed"]')))?.startsWith('Chưa kiểm tra được quyền quản trị của bạn.'), await tt(page.locator('[data-test="admin-grants-failed"]')));
    await capture(page, 'admin-grants-failed');
    await contrast(page, 'red note (grants failed)', [{ label: 'red note text', selector: '[data-test="admin-grants-failed"]', kind: 'text' }]);
    await unblock();
    await goto(page, '/settings');
    await capture(page, 'settings-user-id');
    await page.click('[data-test="copy-user-id"]');
    await sleep(300);
    await capture(page, 'settings-user-id-copied', { toastAtStart: await tt(page.locator('[data-test="toast"]')) });
    await page.context().close();
  }

  // ---- A1: requirement groups, a section without its permission, ADM-02j's banner ---------------------
  {
    const page = await newPage(browser);
    await signIn(page, EMAIL.A1);
    await goto(page, '/admin/curriculum');
    await pick(page, 'admin-program', 'APCS ·');
    await pick(page, 'admin-cohort', '2024');
    await page.locator('[data-test="group-row"] [data-test="group-open"]').first().click();
    await settle(page);
    const toggles = await page.locator('[data-test="group-note-toggle"]').count();
    check('A11Y-01 states', 'APCS 2024, first group open; a rule note cut to two lines with Xem thêm', toggles > 0 && (await tt(page.locator('[data-test="group-note-toggle"]').first())) === 'Xem thêm', toggles);
    await capture(page, 'curriculum-first-group-open', { noteToggles: toggles });
    await contrast(page, 'requirement groups', [
      { label: 'permission chip', selector: '[data-test="admin-held"] .chip', kind: 'text' },
      { label: 'chip "Chưa ghi nhận"', selector: '[data-test="group-panel"] .chip.warn', kind: 'text' },
      { label: 'chip "Không có tiên quyết"', selector: '[data-test="group-panel"] .chip.ok', kind: 'text' },
      { label: 'field border (code box)', selector: '#link-code', kind: 'border', prop: 'borderTopColor' },
      { label: 'Xem thêm link', selector: '[data-test="group-note-toggle"]', kind: 'text' },
    ]);
    await page.setViewportSize({ width: 600, height: 800 });
    await sleep(300);
    await contrast(page, 'card borders at 600 px (requirement groups)', [{ label: 'card border', selector: '[data-test="group-panel"] table.admin-cards tbody tr', kind: 'border', prop: 'borderTopColor' }]);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.click('[data-test="add-group"]');
    await settle(page, 300);
    await capture(page, 'group-dialog-new');
    await contrast(page, 'group dialog', [{ label: 'radio button', selector: 'dialog[open] input[type=radio]', kind: 'border', prop: 'borderTopColor' }, { label: 'field border', selector: 'dialog[open] [data-test="group-name"]', kind: 'border', prop: 'borderTopColor' }]);
    await focusRing(page, 'focus ring in the group dialog', 'dialog[open] [data-test="group-name"]');
    await cancel(page);
    await page.locator('[data-test="group-edit"]').first().click();
    await settle(page, 300);
    await capture(page, 'group-dialog-edit');
    await cancel(page);
    await page.locator('[data-test="group-delete"]').first().click();
    await settle(page, 300);
    await capture(page, 'delete-group-dialog');
    await cancel(page);
    await openGroup(page, AE);
    for (const [state, choice] of [['unknown', 'prerequisite-state-unknown'], ['none', 'prerequisite-state-none'], ['codes', 'prerequisite-state-codes']]) {
      await row(page, 'CS420').locator('[data-test="edit-prerequisites"]').click();
      await settle(page, 300);
      const radio = page.locator(`dialog[open] [data-test^="prerequisite-state-"]`);
      const names = await radio.evaluateAll((l) => l.map((e) => e.dataset.test));
      const target = names.find((n) => n.endsWith(state)) ?? names[['unknown', 'none', 'codes'].indexOf(state)];
      await page.check(`dialog[open] [data-test="${target}"]`);
      await capture(page, `prerequisites-dialog-${state}`, { radios: names });
      if (state === 'codes') {
        await page.fill('dialog[open] [data-test="prerequisite-codes"]', '');
        const m = mark(page);
        await page.click('dialog[open] [data-test="dialog-save"]');
        await settle(page, 300);
        check('A11Y-01 states', '"Nhập ít nhất một mã, hoặc chọn “Không có tiên quyết”." and nothing sent', (await tt(page.locator('[data-test="prerequisite-codes-needed"]'))) === 'Nhập ít nhất một mã, hoặc chọn “Không có tiên quyết”.' && sent(page, m).length === 0, fmt(sent(page, m)));
        await capture(page, 'prerequisites-dialog-codes-needed');
      }
      await cancel(page);
    }
    await row(page, 'CS420').locator('[data-test="edit-terms"]').click();
    await settle(page, 300);
    await capture(page, 'offering-terms-dialog');
    await contrast(page, 'offering-terms dialog', [{ label: 'checkbox', selector: 'dialog[open] input[type=checkbox]', kind: 'border', prop: 'borderTopColor' }]);
    await focusRing(page, 'focus ring in the offering-terms dialog', 'dialog[open] [data-test="term-1"]');
    await cancel(page);
    await row(page, 'CS420').locator('[data-test="unlink-course"]').click();
    await settle(page, 300);
    await capture(page, 'remove-course-dialog');
    await cancel(page);
    await openGroup(page, AC);
    await page.fill('[data-test="link-code"]', 'zzadm99');
    await page.click('[data-test="link-submit"]');
    await settle(page);
    await capture(page, 'link-refused-404');
    await contrast(page, 'link refusal', [{ label: 'red note text', selector: '[data-test="group-panel"] [data-test="admin-problem"]', kind: 'text' }]);
    // A lost answer on a link (ADM-05f): not saved, unknown, and the page warning.
    let unblock = await block(page, 'api/admin/programs');
    await page.fill('[data-test="link-code"]', 'ZZADM05S');
    await page.click('[data-test="link-submit"]');
    await settle(page, 1200);
    await capture(page, 'link-lost-not-saved', { note: await tt(page.locator('[data-test="group-panel"] [data-test="admin-problem"]')) });
    await contrast(page, 'link not saved', [{ label: 'yellow note text', selector: '[data-test="group-panel"] [data-test="admin-problem"]', kind: 'text' }]);
    await unblock();
    unblock = await block(page, 'api/admin/programs', 'api/programs/');
    await page.click('[data-test="link-submit"]');
    await settle(page, 1200);
    await capture(page, 'link-lost-unknown', { note: await tt(page.locator('[data-test="group-panel"] [data-test="admin-problem"]')) });
    await page.fill('[data-test="link-code"]', 'ZZADM05');
    await settle(page, 300);
    await capture(page, 'curriculum-page-warning', { warning: await tt(page.locator('[data-test="curriculum-stale"]')) });
    await unblock();
    if (await visible(page.locator('[data-test="curriculum-reload"]'))) { await page.click('[data-test="curriculum-reload"]'); await settle(page); }
    const linked = (await api('GET', '/programs/APCS/curricula/2024', a1t)).json.requirementGroups.find((g) => g.name === AC).courses.some((c) => c.code === 'ZZADM05S');
    check('A11Y-01 states', 'the blocked links saved nothing: ZZADM05S is not in {AC}', !linked);
    await goto(page, '/admin/catalog');
    await capture(page, 'section-denied-catalog-as-a1');
    // ADM-02j's banner, before and after "Tải lại theo quyền hiện tại".
    await goto(page, '/admin/curriculum');
    await openGroup(page, AE);
    await row(page, 'CS420').locator('[data-test="edit-terms"]').click();
    await page.check('[data-test="term-1"]');
    await page.check('[data-test="term-2"]');
    check('A11Y-01 states', 'A4 revokes A1\'s APCS grant', (await api('DELETE', `/admin/access/users/${ID.A1}/programs/${apcs.id}`, a4t)).status === 200);
    await page.click('dialog[open] [data-test="dialog-save"]');
    await settle(page);
    await cancel(page);
    check('A11Y-01 states', 'banner shown', await visible(page.locator('[data-test="admin-refused"]')));
    await capture(page, 'refused-save-banner');
    await contrast(page, 'refused-save banner', [{ label: 'red banner text', selector: '[data-test="admin-refused"] p', kind: 'text' }]);
    await page.click('[data-test="admin-refused-close"]');
    await settle(page);
    await capture(page, 'refused-save-banner-reloaded');
    check('A11Y-01 states', 'A1\'s grant given back; CS420 still null', (await api('PUT', `/admin/access/users/${ID.A1}/programs/${apcs.id}`, a4t)).status === 200 && (await api('GET', '/programs/APCS/curricula/2024', a1t)).json.requirementGroups.find((g) => g.name === AE).courses.find((c) => c.code === 'CS420').offeringTerms === null);
    await page.context().close();
  }

  // ---- A3: the course catalog ---------------------------------------------------------------------------
  {
    const page = await newPage(browser);
    await signIn(page, EMAIL.A3);
    await goto(page, '/admin/catalog');
    await capture(page, 'catalog-empty');
    await findCourse(page, 'ZZA11Y99');
    await capture(page, 'catalog-no-such-course');
    await findCourse(page, 'BAA00104');
    await capture(page, 'catalog-baa00104');
    await findCourse(page, 'ZZADM05S');
    await capture(page, 'catalog-course-unused');
    await page.click('[data-test="catalog-add"]');
    await settle(page, 300);
    await capture(page, 'course-dialog-new');
    await page.fill('[data-test="course-code"]', 'cs-1');
    await page.fill('[data-test="course-nameVi"]', 'Học phần thử ADM-05 màn hình');
    await page.fill('[data-test="course-credits"]', '0');
    await page.click('dialog[open] [data-test="dialog-save"]');
    await settle(page);
    await capture(page, 'course-dialog-new-field-errors');
    await contrast(page, 'course dialog field errors', [{ label: 'field error text', selector: 'dialog[open] [data-test="field-error"]', kind: 'text' }, { label: 'invalid field border', selector: 'dialog[open] [aria-invalid="true"]', kind: 'border', prop: 'borderTopColor' }, { label: 'red note text', selector: 'dialog[open] [data-test="admin-problem"]', kind: 'text' }]);
    await cancel(page);
    await page.click('[data-test="catalog-edit"]');
    await settle(page, 300);
    await capture(page, 'course-dialog-edit');
    await focusRing(page, 'focus ring in the course dialog', 'dialog[open] [data-test="course-nameVi"]');
    await page.fill('[data-test="course-credits"]', '0');
    await page.click('dialog[open] [data-test="dialog-save"]');
    await settle(page);
    await capture(page, 'course-dialog-edit-field-errors');
    await cancel(page);
    await findCourse(page, 'BAA00104');
    await page.click('[data-test="catalog-edit"]');
    await settle(page, 300);
    await contrast(page, 'shared-course warning', [{ label: 'yellow warning text', selector: 'dialog[open] [data-test="shared-warning"] p', kind: 'text' }, { label: 'yellow warning title', selector: 'dialog[open] [data-test="shared-warning"] b', kind: 'text' }]);
    await page.fill('[data-test="course-nameEn"]', 'History of the Communist Party of Vietnam');
    await page.click('dialog[open] [data-test="dialog-save"]');
    await settle(page);
    await capture(page, 'impact-review');
    await contrast(page, 'impact review table', [{ label: 'review header', selector: 'dialog[open] .impact-changes th[scope=col]', kind: 'text' }, { label: 'review cell', selector: 'dialog[open] .impact-changes td', kind: 'text' }]);
    await cancel(page);
    // The review after impact_changed, with ZZADM05S (ADM-05g's steps, never confirmed).
    check('A11Y-01 states', 'A1 links ZZADM05S to {AC}', (await api('PUT', `/admin/programs/${apcs.id}/cohorts/${APCS24}/requirement-groups/${ACid}/courses/ZZADM05S`, a1t)).status === 204);
    await findCourse(page, 'ZZADM05S');
    await page.click('[data-test="catalog-edit"]');
    await page.fill('[data-test="course-credits"]', '4');
    await page.click('dialog[open] [data-test="dialog-save"]');
    await settle(page);
    check('A11Y-01 states', 'A2 links ZZADM05S to {KG}', (await api('PUT', `/admin/programs/${khmt.id}/cohorts/${KHMT25}/requirement-groups/${KGid}/courses/ZZADM05S`, a2t)).status === 204);
    await page.click('[data-test="impact-confirm"]');
    await settle(page);
    check('A11Y-01 states', 'review after impact_changed shown', await visible(page.locator('[data-test="impact-changed"]')));
    await capture(page, 'impact-review-changed');
    await cancel(page);
    check('A11Y-01 states', 'both links removed again', (await api('DELETE', `/admin/programs/${apcs.id}/cohorts/${APCS24}/requirement-groups/${ACid}/courses/ZZADM05S`, a1t)).status === 204 && (await api('DELETE', `/admin/programs/${khmt.id}/cohorts/${KHMT25}/requirement-groups/${KGid}/courses/ZZADM05S`, a2t)).status === 204);
    await findCourse(page, 'ZZADM05S');
    await page.click('[data-test="catalog-delete"]');
    await settle(page, 300);
    await capture(page, 'course-delete-dialog');
    await cancel(page);
    await findCourse(page, 'BAA00104');
    await page.click('[data-test="catalog-delete"]');
    await page.click('dialog[open] [data-test="confirm-yes"]');
    await settle(page);
    await capture(page, 'course-delete-refused');
    await cancel(page);
    // The three lost-answer outcomes (ADM-05f).
    await findCourse(page, 'ZZADM05S');
    await page.click('[data-test="catalog-edit"]');
    await page.fill('[data-test="course-credits"]', '4');
    let unblock = await block(page, 'api/admin/catalog/courses');
    await page.click('dialog[open] [data-test="dialog-save"]');
    await settle(page, 1200);
    await capture(page, 'catalog-lost-not-saved');
    await unblock();
    unblock = await block(page, 'api/admin/catalog/courses', 'api/courses/');
    await page.click('dialog[open] [data-test="dialog-save"]');
    await settle(page, 1200);
    await capture(page, 'catalog-lost-unknown');
    await cancel(page);
    await capture(page, 'catalog-page-warning');
    await contrast(page, 'catalog page warning', [{ label: 'yellow note text', selector: '[data-test="catalog-stale"]', kind: 'text' }]);
    await unblock();
    await page.click('[data-test="catalog-reload"]');
    await settle(page);
    await page.evaluate(() => {
      const realFetch = window.fetch;
      window.fetch = async (input, init = {}) => {
        if ((init.method ?? 'GET').toUpperCase() === 'GET') return realFetch(input, init);
        window.fetch = realFetch;
        await realFetch(input, init);
        throw new TypeError('ADM-05f: answer dropped by the test');
      };
    });
    await page.click('[data-test="catalog-edit"]');
    await page.fill('[data-test="course-credits"]', '5');
    await page.click('dialog[open] [data-test="dialog-save"]');
    await settle(page, 1200);
    await capture(page, 'catalog-lost-saved');
    await contrast(page, 'green line (saved after all)', [{ label: 'green note text', selector: '.callout.ok', kind: 'text' }]);
    await page.context().close();
  }

  // ---- A4: access --------------------------------------------------------------------------------
  {
    const page = await newPage(browser);
    await signIn(page, EMAIL.A4);
    await goto(page, '/admin/access');
    await capture(page, 'access-empty');
    const find = async (id) => { await page.fill('[data-test="access-user-id"]', id); await page.click('[data-test="access-find"]'); await settle(page); };
    await find(ID.S1);
    await capture(page, 'access-user-no-grant');
    await contrast(page, 'access: not held', [{ label: 'chip "Chưa có"', selector: '[data-test="access-status"] .chip', kind: 'text' }]);
    await pick(page, 'access-program', 'APCS ·');
    await page.click('[data-test="access-grant-program"]');
    await settle(page);
    await page.click('[data-test="access-grant-catalog_maintainer"]');
    await settle(page);
    await capture(page, 'access-user-program-and-global');
    await contrast(page, 'access: held', [{ label: 'chip "Đang có"', selector: '[data-test="access-global-catalog_maintainer"] .chip.ok', kind: 'text' }, { label: 'granter ID', selector: '.granter', kind: 'text' }]);
    await page.locator('[data-test="access-revoke-program"]').click();
    await settle(page, 300);
    await capture(page, 'access-revoke-dialog');
    await page.click('dialog[open] [data-test="confirm-yes"]');
    await settle(page);
    await page.click('[data-test="access-revoke-catalog_maintainer"]');
    await page.click('dialog[open] [data-test="confirm-yes"]');
    await settle(page);
    const g = (await api('GET', `/admin/access/users/${ID.S1}/grants`, a4t)).json;
    check('A11Y-01 states', 'S1\'s two grants revoked again', !g.programs.length && !g.permissions.length);
    await find('00000000-0000-4000-8000-000000000000');
    await capture(page, 'access-no-such-account');
    await find('not-an-id');
    await capture(page, 'access-id-refused');
    await find(ID.A4);
    await capture(page, 'access-own-account');
    await page.click('[data-test="access-revoke-access_manager"]');
    await settle(page, 300);
    await capture(page, 'access-revoke-dialog-own');
    await page.click('dialog[open] [data-test="confirm-yes"]');
    await settle(page);
    await capture(page, 'access-last-access-manager');
    await cancel(page);
    await page.context().close();
  }
} finally {
  const del = await api('DELETE', '/admin/catalog/courses/ZZADM05S', a3t);
  check('clean-up', 'ZZADM05S deleted (204), GET 404', del.status === 204 && (await api('GET', '/courses/ZZADM05S', a3t)).status === 404);
  const a4g = (await api('GET', `/admin/access/users/${ID.A4}/grants`, a4t)).json;
  const a1g = (await api('GET', `/admin/access/users/${ID.A1}/grants`, a4t)).json;
  check('clean-up', 'A4 still access_manager; A1 holds APCS', a4g.permissions.map((p) => p.permission).join() === 'access_manager' && a1g.programs.map((p) => p.programCode).join() === 'APCS');
  const baa = (await api('GET', '/courses/BAA00104', a3t)).json;
  check('clean-up', 'BAA00104 still N0, 11 memberships', baa.nameEn === 'History of Vietnamese Communist Party' && baa.memberships.length === 11);
  results.finishedAt = new Date().toISOString();
  save();
  log(failureCount() ? `${failureCount()} FAIL(S)` : 'All checks ok');
  await browser.close();
}
