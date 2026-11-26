// TC-B2-A11Y-01b on staging (docs/test/test-cases-b2.md §10): the four administration journeys without the mouse.
//   node docs/test/evidence/b2/a-a11y-01b.mjs
// Headless Chrome through playwright-core, 1280 px, light, Vietnamese. After the sign-in (done by the script through
// the form), every step is a key press: Tab / Shift+Tab to move, Enter, Space, arrows and Esc, never a click. Each
// focus stop is recorded with whether a focus indicator is drawn. Undoes what it changes: CS420's offering terms go
// back to "not recorded", S1's catalog grant is revoked, BAA00104's English name is never saved.
import {
  ID, EMAIL, api, launch, newPage, signIn, settle, mark, sent, fmt, toasts, clearToasts, pageToken, where, focused, goto,
  check, failureCount, log, sleep,
} from './b-lib.mjs';

const AE = 'Kiến thức Computer Science (A): tự chọn';
const N1 = 'History of the Communist Party of Vietnam';
const tt = (loc) => loc.innerText().then((s) => s.trim()).catch(() => null);

/** The focused element, its box, and whether a focus indicator is drawn (outline or box-shadow). */
const stop = (page) => page.evaluate(() => {
  const e = document.activeElement;
  if (!e || e === document.body) return { desc: 'body', visible: false };
  const cs = getComputedStyle(e);
  const r = e.getBoundingClientRect();
  const ring = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || (cs.boxShadow && cs.boxShadow !== 'none');
  return {
    desc: [e.tagName.toLowerCase(), e.id && `#${e.id}`, e.dataset.test && `[${e.dataset.test}]`, e.getAttribute('aria-label') && `"${e.getAttribute('aria-label')}"`, (e.innerText || e.value || '').trim().slice(0, 30)].filter(Boolean).join(' '),
    visible: !!ring, inDialog: !!e.closest('dialog[open]'), top: Math.round(r.top), left: Math.round(r.left),
  };
});
const journeyLog = [];
/** Presses Tab (or Shift+Tab) until the focus matches, at most `max` times. Records every stop. */
async function tabTo(page, label, match, { back = false, max = 80 } = {}) {
  for (let i = 1; i <= max; i++) {
    await page.keyboard.press(back ? 'Shift+Tab' : 'Tab');
    await sleep(40);
    const s = await stop(page);
    journeyLog.push({ label, ...s });
    if (!s.visible && s.desc !== 'body') console.log(`  no focus indicator on ${s.desc}`);
    if (match(s.desc)) return { ok: true, presses: i, s };
  }
  console.log(`  NOT REACHED: ${label} within ${max} presses`);
  return { ok: false, presses: max };
}
const has = (str) => (d) => d.includes(str);
async function key(page, k, wait = 300) { await page.keyboard.press(k); await settle(page, wait); }
/** Opens a SelectMenu by keyboard and moves with the arrows until the active option contains `label`, then Enter. */
async function choose(page, label) {
  await page.keyboard.press('ArrowDown');
  await sleep(150);
  for (let i = 0; i < 30; i++) {
    const active = await page.evaluate(() => { const id = document.activeElement.getAttribute('aria-activedescendant'); return id ? document.getElementById(id)?.innerText.trim() : null; });
    if (active?.includes(label)) { await key(page, 'Enter'); return true; }
    await page.keyboard.press('ArrowDown');
    await sleep(80);
  }
  await key(page, 'Escape');
  return false;
}

const browser = await launch();

// (1) A1: requirement groups.
{
  const page = await newPage(browser);
  await signIn(page, EMAIL.A1);
  // A full page load of the dashboard, so the focus starts at the top of the document (after the sign-in redirect it
  // does not: the first run's first Tab reached a link of the dashboard instead).
  await goto(page, '/dashboard');
  console.log(`--- (1) A1 at ${where(page)}`);
  await page.keyboard.press('Tab');
  const skip = await stop(page);
  const skipHref = await page.evaluate(() => document.activeElement.getAttribute('href'));
  check('A11Y-01b (1)', 'the first Tab reaches the skip link (href #main), with a focus indicator', skipHref === '#main' && skip.visible, { ...skip, skipHref });
  await key(page, 'Enter');
  check('A11Y-01b (1)', 'the skip link jumps to the main content', await page.evaluate(() => !!document.activeElement.closest('#main') || document.activeElement.id === 'main'), await focused(page));
  let r = await tabTo(page, 'Quản trị', has('[nav-admin]'), { back: true });
  await key(page, 'Enter', 800);
  check('A11Y-01b (1)', 'Quản trị opens from the sidebar by keyboard', r.ok && where(page) === '/admin/curriculum', where(page));
  r = await tabTo(page, 'program picker', has('[admin-program]'));
  const progOk = r.ok && (await choose(page, 'APCS'));
  r = await tabTo(page, 'cohort picker', has('[admin-cohort]'));
  const cohortOk = r.ok && (await choose(page, '2024'));
  check('A11Y-01b (1)', 'the pickers open, move and choose with the arrow keys and Enter (APCS, Khóa 2024)', progOk && cohortOk && (await tt(page.locator('[data-test="admin-cohort"]')))?.includes('2024'), await tt(page.locator('[data-test="admin-cohort"]')));
  r = await tabTo(page, `open ${AE}`, (d) => d.includes('[group-open]') && d.includes(AE));
  await key(page, 'Enter');
  const panel = await tt(page.locator('#group-panel-title'));
  check('A11Y-01b (1)', `"${AE}" opens`, r.ok && !!panel && panel.includes(AE), panel);
  const terms = page.locator('[data-test="group-panel"] [data-test="course-row"][data-course="CS420"] [data-test="offering-terms"]');
  check('A11Y-01b (1)', 'CS420\'s Kỳ mở reads "Chưa ghi nhận"', (await tt(terms))?.startsWith('Chưa ghi nhận'), await tt(terms));
  r = await tabTo(page, 'Sửa kỳ mở của CS420', has('"Sửa kỳ mở của CS420"'));
  await key(page, 'Enter');
  let f = await stop(page);
  check('A11Y-01b (1)', 'the offering-terms dialog takes focus on its first field', r.ok && f.inDialog && f.desc.includes('term-1'), f);
  await key(page, 'Space', 150);
  check('A11Y-01b (1)', 'Space ticks HK1', await page.isChecked('[data-test="term-1"]'));
  r = await tabTo(page, 'Lưu', has('[dialog-save]'));
  let m = mark(page);
  await key(page, 'Enter', 800);
  f = await stop(page);
  check('A11Y-01b (1)', 'Lưu saves (one PUT 200); the focus is not lost to the top of the page', sent(page, m, { writes: true })[0]?.status === 200 && f.desc !== 'body', { sent: fmt(sent(page, m, { writes: true })), focus: f });
  check('A11Y-01b (1)', 'Kỳ mở reads HK1', (await tt(terms))?.includes('1'), await tt(terms));
  if (!f.desc.includes('Sửa kỳ mở của CS420')) r = await tabTo(page, 'Sửa kỳ mở của CS420 (again)', has('"Sửa kỳ mở của CS420"'), { back: true });
  await key(page, 'Enter');
  await key(page, 'Space', 150);
  r = await tabTo(page, 'Lưu', has('[dialog-save]'));
  await key(page, 'Enter', 800);
  check('A11Y-01b (1)', 'unticked and saved: back to "Chưa ghi nhận"; API null', (await tt(terms))?.startsWith('Chưa ghi nhận') && (await api('GET', '/programs/APCS/curricula/2024', await pageToken(page))).json.requirementGroups.find((g) => g.name === AE).courses.find((c) => c.code === 'CS420').offeringTerms === null, await tt(terms));
  r = await tabTo(page, 'Thêm nhóm', has('[add-group]'), { back: true });
  await key(page, 'Enter');
  f = await stop(page);
  check('A11Y-01b (1)', 'Thêm nhóm: the dialog takes focus on its first field', r.ok && f.inDialog && f.desc.includes('group-name'), f);
  r = await tabTo(page, 'Hủy', has('[dialog-cancel]'));
  m = mark(page);
  await key(page, 'Enter');
  f = await stop(page);
  check('A11Y-01b (1)', 'Hủy closes it, sends nothing, and gives the focus back to Thêm nhóm', r.ok && sent(page, m).length === 0 && f.desc.includes('add-group'), f);
  await page.context().close();
}

// (2) A3: the catalog.
{
  const page = await newPage(browser);
  await signIn(page, EMAIL.A3);
  console.log(`--- (2) A3 at ${where(page)}`);
  let r = await tabTo(page, 'Quản trị', has('[nav-admin]'));
  await key(page, 'Enter', 800);
  check('A11Y-01b (2)', 'Quản trị opens /admin/catalog', r.ok && where(page) === '/admin/catalog', where(page));
  r = await tabTo(page, 'Mã học phần', has('[catalog-code]'));
  await page.keyboard.type('BAA00104');
  await key(page, 'Enter', 800);
  check('A11Y-01b (2)', 'Enter in the code box finds BAA00104', (await page.locator('[data-test="catalog-course"]').getAttribute('data-course').catch(() => null)) === 'BAA00104');
  r = await tabTo(page, 'Sửa', has('[catalog-edit]'));
  await key(page, 'Enter');
  let f = await stop(page);
  check('A11Y-01b (2)', 'the course dialog opened by Sửa puts the focus on Tên tiếng Việt, not on the read-only code box', r.ok && f.desc.includes('#course-nameVi'), f);
  r = await tabTo(page, 'Tên tiếng Anh', has('#course-nameEn'));
  await page.keyboard.press('Control+A');
  await page.keyboard.type(N1);
  r = await tabTo(page, 'Lưu', has('[dialog-save]'));
  await key(page, 'Enter', 800);
  f = await stop(page);
  check('A11Y-01b (2)', 'Lưu shows the review, with the focus on its title', f.desc.includes('#course-dialog-title'), f);
  r = await tabTo(page, 'Quay lại sửa', has('[impact-back]'));
  await key(page, 'Enter');
  f = await stop(page);
  check('A11Y-01b (2)', 'Quay lại sửa: back to the form, focus in Tên tiếng Việt', f.desc.includes('#course-nameVi'), f);
  r = await tabTo(page, 'Lưu', has('[dialog-save]'));
  await key(page, 'Enter', 800);
  r = await tabTo(page, 'Hủy', has('[dialog-cancel]'));
  let m = mark(page);
  await key(page, 'Enter');
  f = await stop(page);
  check('A11Y-01b (2)', 'Hủy closes the review, sends nothing, gives the focus back to Sửa', r.ok && sent(page, m).length === 0 && f.desc.includes('[catalog-edit]'), f);
  r = await tabTo(page, 'Xóa', has('[catalog-delete]'));
  await key(page, 'Enter');
  f = await stop(page);
  check('A11Y-01b (2)', 'Xóa: the confirm dialog takes focus on Hủy', r.ok && f.desc.includes('[confirm-no]'), f);
  for (let i = 0; i < 4; i++) await page.keyboard.press('Tab');
  const trapped = await stop(page);
  check('A11Y-01b (2)', 'the focus stays inside the dialog', trapped.inDialog, trapped);
  m = mark(page);
  await key(page, 'Escape');
  f = await stop(page);
  check('A11Y-01b (2)', 'Esc closes it, sending nothing, and gives the focus back to Xóa', sent(page, m).length === 0 && (await page.locator('dialog[open]').count()) === 0 && f.desc.includes('[catalog-delete]'), f);
  check('A11Y-01b (2)', 'BAA00104 still N0', (await api('GET', '/courses/BAA00104', await pageToken(page))).json.nameEn === 'History of Vietnamese Communist Party');
  await page.context().close();
}

// (3) A4: grant and revoke "Quản lý danh mục học phần" for S1 (ADM-06g (5)).
{
  const page = await newPage(browser);
  await signIn(page, EMAIL.A4);
  console.log(`--- (3) A4 at ${where(page)}`);
  let r = await tabTo(page, 'Quản trị', has('[nav-admin]'));
  await key(page, 'Enter', 800);
  r = await tabTo(page, 'Mã người dùng', has('[access-user-id]'));
  await page.keyboard.type(ID.S1);
  await key(page, 'Enter', 800);
  check('A11Y-01b (3)', 'S1 found by ID', (await tt(page.locator('[data-test="access-shown-id"]'))) === ID.S1);
  r = await tabTo(page, 'Cấp (catalog)', has('[access-grant-catalog_maintainer]'));
  await key(page, 'Enter', 800);
  let f = await stop(page);
  check('A11Y-01b (3)', 'Cấp grants it; the focus stays on that row\'s button, now Thu hồi', r.ok && f.desc.includes('[access-revoke-catalog_maintainer]'), f);
  await key(page, 'Enter');
  f = await stop(page);
  check('A11Y-01b (3)', 'Thu hồi: the dialog takes focus on Hủy', f.desc.includes('[confirm-no]'), f);
  r = await tabTo(page, 'Thu hồi (dialog)', has('[confirm-yes]'));
  await key(page, 'Enter', 800);
  f = await stop(page);
  check('A11Y-01b (3)', 'revoked: "Chưa có" again; the focus is not lost', (await tt(page.locator('[data-test="access-global-catalog_maintainer"] [data-test="access-status"]'))) === 'Chưa có' && f.desc !== 'body', f);
  const g = (await api('GET', `/admin/access/users/${ID.S1}/grants`, await pageToken(page))).json;
  check('A11Y-01b (3)', 'S1 holds no grant', !g.programs.length && !g.permissions.length);
  await page.context().close();
}

// (4) S1: copy the user ID in Cài đặt.
{
  const page = await newPage(browser);
  await signIn(page, EMAIL.S1);
  console.log(`--- (4) S1 at ${where(page)}`);
  let r = await tabTo(page, 'Cài đặt', has('[nav-settings]'));
  await key(page, 'Enter', 800);
  r = await tabTo(page, 'Sao chép', has('[copy-user-id]'));
  await clearToasts(page);
  await key(page, 'Enter');
  const f = await stop(page);
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  check('A11Y-01b (4)', 'Sao chép by keyboard copies the ID, says so, keeps the focus on the button', r.ok && clip === ID.S1 && (await toasts(page)).includes('Đã sao chép mã người dùng.') && f.desc.includes('[copy-user-id]'), { clip, f });
  await page.context().close();
}

const noRing = journeyLog.filter((s) => s.desc !== 'body' && !s.visible && !s.desc.startsWith('h2 #course-dialog-title'));
check('A11Y-01b', 'every focus stop draws a focus indicator (a heading focused by script, the review title, has none by design)', noRing.length === 0, [...new Set(noRing.map((s) => s.desc))]);
// A "body" stop while tabbing is the focus wrapping past the end of the document into the browser's own UI; it is
// not a loss of focus after an action. The focus after each action is checked where the action is.
console.log(`  body stops while tabbing (wrap-around): ${journeyLog.filter((s) => s.desc === 'body').map((s) => s.label).join(', ') || 'none'}`);
console.log(`  ${journeyLog.length} focus stops recorded`);
for (const s of journeyLog) console.log(`  stop [${s.label}] ${s.desc} ${s.visible ? '' : '(no ring)'} @${s.top},${s.left}${s.inDialog ? ' dialog' : ''}`);
log(failureCount() ? `${failureCount()} FAIL(S)` : 'All checks ok');
await browser.close();
