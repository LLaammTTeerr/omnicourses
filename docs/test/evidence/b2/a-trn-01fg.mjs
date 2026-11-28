// TC-B2-TRN-01f and TRN-01g on staging (docs/test/test-cases-b2.md §4, v0.14). Synthetic account T (b2-s8) only.
//   node docs/test/evidence/b2/a-trn-01fg.mjs
// Headless Chrome through playwright-core, 1280 px, light theme, English, as §4 says. Starts from the transcript T holds
// (read and printed first) and saves nothing: f loads pasted rows into the review table, g cancels them.
// The shell's bell polls GET /api/notifications/unread-count on its own (#204); "no request" leaves that poll out and counts it.
// Beyond the case's TSV, f also pastes the same rows with "|" and ";" columns (Lâm's bot, 28 November 2026).
import { isDeepStrictEqual } from 'node:util';
import { EMAIL, api, launch, newPage, signIn, settle, mark, sent, fmt, toasts, clearToasts, pageToken, has, shot, check, failureCount, log, sleep } from './b-lib.mjs';

log('a-trn-01fg');
const browser = await launch();
const page = await newPage(browser, { lang: 'en' });
await signIn(page, EMAIL.T);
await page.click('[data-test="nav-transcript"]');
await settle(page, 800);

const tt = (loc) => loc.innerText().then((s) => s.trim()).catch(() => null);
const visible = (loc) => loc.isVisible().catch(() => false);
const BELL = '/api/notifications/unread-count';
const own = (from, opts) => sent(page, from, opts).filter((r) => r.path !== BELL);
const bell = (from) => sent(page, from).filter((r) => r.path === BELL).length;
const lastToast = async () => (await toasts(page)).at(-1) ?? null;
const transcript = async () => (await api('GET', '/users/me/transcript', await pageToken(page))).json.rows;
const simple = (rows) => rows.map((r) => [r.courseCode, r.courseName, r.credits, r.result, r.grade, r.term.year, r.term.number]);
const cell = (i, n) => page.locator(`[data-test="row-${i}"] td:nth-child(${n})`);
const listed = async () => {
  const n = await page.locator('[data-test^="row-"]').count();
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push([
      await tt(cell(i, 1).locator('[role="combobox"]')),
      await cell(i, 2).locator('input').inputValue(),
      await cell(i, 3).locator('input').inputValue(),
      await cell(i, 4).locator('input').inputValue(),
      await tt(cell(i, 5).locator('[role="combobox"]')),
      await cell(i, 6).locator('input').inputValue().catch(async () => tt(cell(i, 6))),
      await tt(cell(i, 7)),
    ]);
  }
  return out;
};
const summary = () => tt(page.locator('[data-test="summary"]'));
const diffText = async () => ((await visible(page.locator('[data-test="diff-summary"]'))) ? tt(page.locator('[data-test="diff-summary"]')) : null);
const saveBtn = page.locator('.head-actions button.primary');
const dialog = page.locator('[data-test="paste-dialog"]');
const preview = () => page.locator('[data-test="paste-preview-row"]').evaluateAll((trs) => trs.map((tr) => [...tr.querySelectorAll('td')].map((td) => td.innerText.trim())));
const pasteErrors = () => page.locator('[data-test="paste-error"]').evaluateAll((l) => l.map((e) => e.innerText.trim()));
const chips = () => tt(page.locator('[data-test="paste-summary"]'));
const disabled = async (test) => page.locator(`[data-test="${test}"]`).isDisabled();
async function openPaste() {
  await page.click('[data-test="open-paste"]');
  await sleep(300);
  return { open: await visible(dialog), text: await page.locator('[data-test="paste-input"]').inputValue() };
}
async function paste(text) {
  await page.locator('[data-test="paste-input"]').fill(text);
  await sleep(250);
}
async function cancelPaste() {
  await page.click('[data-test="paste-cancel"]');
  await sleep(300);
  return !(await visible(dialog));
}

const TSV = 'Học kỳ\tMã MH\tTên học phần\tTín chỉ\tĐiểm\n2024-1\tcs160\tNhập môn Tin học\t4\t8,5\nHK2 2024-2025\tCS163\tCấu trúc dữ liệu\t4\t8.0\n2024-2\tBAA00030\tGDQP-AN\t4\tĐ';
const BAD = `${TSV}\n2024-2\tbad_code!\tBroken\t4\t8.0\n2024-2\tCS201\tLập trình hệ thống\t4\t11.5`;
const PIPE = '| Học kỳ | Mã MH | Tên học phần | Tín chỉ | Điểm |\n| 2024-1 | cs160 | Nhập môn Tin học | 4 | 8,5 |\n| HK2 2024-2025 | CS163 | Cấu trúc dữ liệu | 4 | 8.0 |\n| 2024-2 | BAA00030 | GDQP-AN | 4 | Đ |';
const SEMI = 'Học kỳ;Mã MH;Tên học phần;Tín chỉ;Điểm\n2024-1;cs160;Nhập môn Tin học;4;8,5\nHK2 2024-2025;CS163;Cấu trúc dữ liệu;4;8.0\n2024-2;BAA00030;GDQP-AN;4;Đ';
const WANT_PREVIEW = [
  ['Term 1 2024–2025', 'CS160', 'Nhập môn Tin học', '4', 'Graded', '8.5'],
  ['Term 2 2024–2025', 'CS163', 'Cấu trúc dữ liệu', '4', 'Graded', '8.0'],
  ['Term 2 2024–2025', 'BAA00030', 'GDQP-AN', '4', 'Pass', 'No grade'],
];

console.log('--- starting state');
const start = await transcript();
console.log(`  T's saved transcript: ${JSON.stringify(simple(start))}`);
const startScreen = await listed();
console.log(`  screen: ${JSON.stringify(startScreen)}; summary ${JSON.stringify(await summary())}; diff ${JSON.stringify(await diffText())}; cancel-edits shown ${await visible(page.locator('[data-test="cancel-edits"]'))}`);
check('TRN-01 start', 'T holds TRN-01e\'s transcript: CM102 graded 9, MTH251 fail, PH211 graded 6.5, all 2024/1',
  isDeepStrictEqual(start.map((r) => [r.courseCode, r.result, r.grade, r.term.year, r.term.number]), [['CM102', 'graded', 9, 2024, 1], ['MTH251', 'fail', null, 2024, 1], ['PH211', 'graded', 6.5, 2024, 1]]), simple(start));

console.log('--- TRN-01f (1)');
let m = mark(page);
let o = await openPaste();
check('TRN-01f', '(1) Paste grades table opens the dialog with an empty box', o.open && o.text === '', o);
await paste(TSV);
const p1 = await preview();
console.log(`  preview: ${JSON.stringify(p1)}; chips ${JSON.stringify(await chips())}; errors ${JSON.stringify(await pasteErrors())}`);
check('TRN-01f', '(1) the header line is skipped and the preview shows the 3 normalized rows (CS160 graded 8.5 in 2024-1, CS163 graded 8.0 in 2024-2, BAA00030 pass, no grade, in 2024-2); no error',
  isDeepStrictEqual(p1, WANT_PREVIEW) && (await pasteErrors()).length === 0 && !(await disabled('paste-replace')) && !(await disabled('paste-append')), p1);
await shot(page, 'a-trn-01f-preview.png');
check('TRN-01f', '(1) closing with Cancel leaves the table as it was', (await cancelPaste()) && isDeepStrictEqual(await listed(), startScreen));
o = await openPaste();
await paste(TSV);
const p2 = await preview();
check('TRN-01f', '(1) the same text pasted again: the box started empty, and the same 3 rows', o.text === '' && isDeepStrictEqual(p2, p1), p2);
check('TRN-01f', '(1) no request at all while pasting and previewing (no model, no network)', own(m).length === 0, fmt(own(m)) + ` (bell polls left out: ${bell(m)})`);

console.log('--- TRN-01f (2)');
await paste(BAD);
const errs = await pasteErrors();
console.log(`  errors: ${JSON.stringify(errs)}; chips ${JSON.stringify(await chips())}; preview rows ${(await preview()).length}`);
check('TRN-01f', '(2) paste-errors lists line 5 (invalid code) and line 6 (invalid grade), by line number',
  (await visible(page.locator('[data-test="paste-errors"]'))) && errs.length === 2 &&
  errs[0].startsWith('Line 5: invalid course code (2–20 letters or digits)') && errs[0].includes('bad_code!') &&
  errs[1].startsWith('Line 6: invalid grade (0–10, one decimal)') && errs[1].includes('11.5'), errs);
check('TRN-01f', '(2) Replace and Add are both disabled', (await disabled('paste-replace')) && (await disabled('paste-append')));
await shot(page, 'a-trn-01f-errors.png');
check('TRN-01f', '(2) Cancel closes the dialog and leaves the review table open and unchanged', (await cancelPaste()) && isDeepStrictEqual(await listed(), startScreen) && (await diffText()) === null);

console.log('--- TRN-01f (3)');
o = await openPaste();
await paste(BAD);
await paste(TSV);
check('TRN-01f', '(3) with the two bad lines removed: no error, Replace enabled', (await pasteErrors()).length === 0 && !(await disabled('paste-replace')), await chips());
await clearToasts(page);
await page.click('[data-test="paste-replace"]');
await sleep(400);
const afterReplace = await listed();
const diff3 = await diffText();
console.log(`  table: ${JSON.stringify(afterReplace)}; summary ${JSON.stringify(await summary())}; diff ${JSON.stringify(diff3)}; toast ${JSON.stringify(await lastToast())}`);
check('TRN-01f', '(3) Replace closes the dialog and loads the 3 rows into the review table, each Valid',
  !(await visible(dialog)) && isDeepStrictEqual(afterReplace.map((r) => r.slice(0, 6)), WANT_PREVIEW.map((r) => [r[0], r[1], r[2], r[3], r[4], r[5]])) && afterReplace.every((r) => r[6] === 'Valid'), afterReplace);
check('TRN-01f', '(3) toast "Replaced draft rows with 3 rows. Your saved transcript changes only when you save."', (await lastToast()) === 'Replaced draft rows with 3 rows. Your saved transcript changes only when you save.', await lastToast());
check('TRN-01f', '(3) the diff summary against the saved transcript shows (3 added, 3 removed: no code in common)', diff3 === '+3 added / ~0 changed / -3 removed', diff3);
check('TRN-01f', '(3) summary "3 rows · ready to save"; Save transcript enabled; Cancel changes shown', (await summary())?.startsWith('3 rows · ready to save') && (await saveBtn.isEnabled()) && (await visible(page.locator('[data-test="cancel-edits"]'))), await summary());
const editable = await page.evaluate(() => [...document.querySelectorAll('[data-test^="row-"] input')].every((e) => !e.disabled && !e.readOnly) && !document.getElementById('add-row').disabled);
check('TRN-01f', '(3) Add row and the row inputs stay editable', editable);
check('TRN-01f', '(3) no PUT (nothing saved), no request at all since (1)', own(m).length === 0, fmt(own(m)) + ` (bell polls left out: ${bell(m)})`);
await shot(page, 'a-trn-01f-review.png');

console.log('--- TRN-01f, the same rows with | and ; columns');
for (const [name, text] of [['pipe', PIPE], ['semicolon', SEMI]]) {
  await openPaste();
  await paste(text);
  const p = await preview();
  check('TRN-01f', `(extra) ${name} columns: the header skipped, the same 3 rows as the TSV, no error`, isDeepStrictEqual(p, WANT_PREVIEW) && (await pasteErrors()).length === 0, { preview: p, errors: await pasteErrors() });
  await cancelPaste();
}
check('TRN-01f', '(extra) the table still holds the replaced rows; no request', isDeepStrictEqual(await listed(), afterReplace) && own(m).length === 0, fmt(own(m)) + ` (bell polls left out: ${bell(m)})`);

console.log('--- TRN-01g');
await openPaste();
await paste('2024-3\tCS202\tCác hệ thống lập trình\t4\t9');
const pg = await preview();
check('TRN-01g', 'a valid row in the paste dialog previews as one row', pg.length === 1 && pg[0][1] === 'CS202', pg);
check('TRN-01g', 'paste-cancel closes the dialog without altering the table', (await cancelPaste()) && isDeepStrictEqual(await listed(), afterReplace) && (await diffText()) === diff3);
await clearToasts(page);
await page.click('[data-test="cancel-edits"]');
await sleep(400);
const afterCancel = await listed();
console.log(`  table: ${JSON.stringify(afterCancel)}; summary ${JSON.stringify(await summary())}; diff ${JSON.stringify(await diffText())}; toasts ${JSON.stringify(await toasts(page))}`);
check('TRN-01g', 'Cancel changes restores TRN-01e\'s saved rows (CM102 9.0, MTH251 Fail, PH211 6.5), as on load',
  isDeepStrictEqual(afterCancel, startScreen) && isDeepStrictEqual(afterCancel.map((r) => [r[1], r[4], r[5]]), [['CM102', 'Graded', '9.0'], ['MTH251', 'Fail', 'No grade'], ['PH211', 'Graded', '6.5']]), afterCancel);
check('TRN-01g', 'diff summary cleared, Save transcript disabled, "3 rows · no changes", Cancel changes gone',
  (await diffText()) === null && (await saveBtn.isDisabled()) && (await summary())?.startsWith('3 rows · no changes') && !(await visible(page.locator('[data-test="cancel-edits"]'))), await summary());
check('TRN-01g', 'zero PUT requests (no request at all) from TRN-01f (1) to here', own(m, { writes: true }).length === 0 && own(m).length === 0, fmt(own(m)) + ` (bell polls left out: ${bell(m)})`);
await shot(page, 'a-trn-01g-cancelled.png');
const end = await transcript();
check('TRN-01g', 'GET /api/users/me/transcript unchanged', isDeepStrictEqual(end, start), simple(end));
if (page.consoleErrors.length) console.log(`  page errors: ${JSON.stringify(page.consoleErrors)}`);

log(failureCount() ? `${failureCount()} FAIL(S)` : 'All checks ok');
await browser.close();
