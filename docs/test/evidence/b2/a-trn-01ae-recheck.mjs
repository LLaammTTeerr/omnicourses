// Recheck of TC-B2-TRN-01a–e on staging, 28 November 2026 (docs/test/test-cases-b2.md §4, v0.14), after TRN-01f–g.
//   node docs/test/evidence/b2/a-trn-01ae-recheck.mjs
// The TRN-01 block of a-screens.mjs (run of 25 November 2026) unchanged, except: T exists already, so it is not signed
// up; the setup empties T's transcript through the API (TRN-01a starts from no transcript); screenshots are named
// a-trn-01ae-r28-*.png so the 25 November ones stay. Headless Chrome, 1280 px, light theme, English. Never prints a token.
import { isDeepStrictEqual } from 'node:util';
import { EMAIL, api, apiSignIn, launch, newPage, signIn, settle, mark, sent, fmt, toasts, clearToasts, block, pageToken, where, has, shot, focused, check, failureCount, log, sleep } from './b-lib.mjs';

log('a-trn-01ae-recheck');
const browser = await launch();
const tt = (loc) => loc.innerText().then((s) => s.trim()).catch(() => null);
const visible = (loc) => loc.isVisible().catch(() => false);
const lastToast = async (page) => (await toasts(page)).at(-1) ?? null;
function API_BASE() { return 'https://stag-omnicourses.lamter.cc/api'; }

{
  console.log('--- setup (not a case): T onboarded to APCS 2024, transcript emptied');
  const t0 = await apiSignIn(EMAIL.T);
  const ob = await api('GET', '/users/me/onboarding', t0);
  check('TRN-01 setup', 'T is onboarded to APCS 2024', ob.json?.program === 'APCS' && ob.json?.cohort === 2024 && ob.json?.finished === true, ob.json);
  const before = (await api('GET', '/users/me/transcript', t0)).json.rows;
  console.log(`  transcript before the setup: ${before.length} rows`);
  const put = await api('PUT', '/users/me/transcript', t0, { rows: [] });
  const tr0 = (await api('GET', '/users/me/transcript', t0)).json;
  check('TRN-01 setup', 'T has no transcript', put.status === 200 && (tr0.rows ?? []).length === 0, tr0);
}
{
  const resume = false;
  const page = await newPage(browser, { lang: 'en' });
  await signIn(page, EMAIL.T);
  const token = await pageToken(page);
  const row = (i) => page.locator(`[data-test="row-${i}"]`);
  const cell = (i, n) => row(i).locator(`td:nth-child(${n})`);
  const termOf = (i) => tt(cell(i, 1).locator('[role="combobox"]'));
  const checkOf = (i) => tt(row(i).locator('[data-test="check"]'));
  const fixOf = (i) => tt(page.locator(`[data-test="problems-${i}"]`));
  const summary = () => tt(page.locator('[data-test="summary"]'));
  const saveBtn = page.locator('.head-actions button.primary');
  const pickIn = async (trigger, label) => {
    await trigger.click();
    await page.locator(`#${await trigger.getAttribute('aria-controls')} [role="option"]`, { hasText: label }).first().click();
  };
  const fillRow = async (i, { term, code, name, credits, result, grade }) => {
    if (term) await pickIn(cell(i, 1).locator('[role="combobox"]'), term);
    if (code !== undefined) { await cell(i, 2).locator('input').fill(code); await cell(i, 2).locator('input').blur(); }
    if (name !== undefined) await cell(i, 3).locator('input').fill(name);
    if (credits !== undefined) await cell(i, 4).locator('input').fill(credits);
    if (result) await pickIn(cell(i, 5).locator('[role="combobox"]'), result);
    if (grade !== undefined) await cell(i, 6).locator('input').fill(grade);
    await sleep(150);
  };
  // The page's token, read at each call: a reload refreshes the session and rotates the token.
  const transcript = async () => (await api('GET', '/users/me/transcript', await pageToken(page))).json.rows;
  const T1 = 'Term 1 2024–2025';

  const simple = (rows) => rows.map((r) => [r.courseCode, r.courseName, r.credits, r.result, r.grade, r.term.year, r.term.number]);
  const listed = async () => {
    const n = await page.locator('[data-test^="row-"]').count();
    const out = [];
    for (let i = 0; i < n; i++) out.push([await cell(i, 2).locator('input').inputValue(), await cell(i, 6).locator('input').inputValue().catch(async () => tt(cell(i, 6)))]);
    return out;
  };
  const TA = [['CM102', 'Tư duy độc lập', 4, 'graded', 7.5, 2024, 1], ['CS160', 'Nhập môn Tin học', 4, 'graded', 8.5, 2024, 1], ['MTH251', 'Vi tích phân I', 4, 'graded', 7, 2024, 1]];
  let m, w, rowsA;
  if (resume) {
    await page.click('[data-test="nav-transcript"]');
    await settle(page);
    rowsA = await transcript();
    check('TRN-01b', "GET still returns T-A's 3 rows (read at the start of the resumed run; nothing was written since TRN-01a's save)", isDeepStrictEqual(simple(rowsA), TA), simple(rowsA));
  } else {
  console.log('--- TRN-01a');
  await page.click('[data-test="nav-transcript"]');
  await settle(page);
  check('TRN-01a', 'before Add row: "No courses yet. Add the first row to start.", "0 rows · no changes", Save transcript disabled',
    (await has(page, 'No courses yet. Add the first row to start.')) && (await summary())?.startsWith('0 rows · no changes') && (await saveBtn.isDisabled()) && (await tt(saveBtn)) === 'Save transcript', await summary());
  m = mark(page);
  await page.click('#add-row');
  await sleep(200);
  check('TRN-01a', 'focus in the new row\'s Code box; term "Term 1 2026–2027"', (await focused(page)).includes('Code') && (await termOf(0)) === 'Term 1 2026–2027', { focus: await focused(page), term: await termOf(0) });
  check('TRN-01a', 'Check "Needs fixing", "Fix: code (2–20 letters or digits), course name, credits (0–30), result", summary "1 row · 1 to fix" + "An incomplete row cannot be saved.", save disabled',
    (await checkOf(0)) === 'Needs fixing' && (await fixOf(0)) === 'Fix: code (2–20 letters or digits), course name, credits (0–30), result' && (await summary())?.startsWith('1 row · 1 to fix') && (await summary())?.includes('An incomplete row cannot be saved.') && (await saveBtn.isDisabled()), { check: await checkOf(0), fix: await fixOf(0), summary: await summary() });
  await fillRow(0, { term: T1, code: ' cs160 ' });
  check('TRN-01a', 'leaving the Code box shows "CS160"', (await cell(0, 2).locator('input').inputValue()) === 'CS160', await cell(0, 2).locator('input').inputValue());
  await fillRow(0, { name: 'Nhập môn Tin học', credits: '4', result: 'Graded' });
  check('TRN-01a', 'Graded and no grade yet: "Fix: grade (0–10, one decimal)"', (await fixOf(0)) === 'Fix: grade (0–10, one decimal)', await fixOf(0));
  await fillRow(0, { grade: '8,5' });
  await page.click('#add-row');
  check('TRN-01a', 'the second row starts in "Term 1 2024–2025"', (await termOf(1)) === T1, await termOf(1));
  await fillRow(1, { code: 'CM102', name: 'Tư duy độc lập', credits: '4', result: 'Graded', grade: '7,5' });
  await page.click('#add-row');
  check('TRN-01a', 'the third row starts in "Term 1 2024–2025"', (await termOf(2)) === T1, await termOf(2));
  await fillRow(2, { code: 'MTH251', name: 'Vi tích phân I', credits: '4', result: 'Graded', grade: '7' });
  check('TRN-01a', 'each Check "Valid", summary "3 rows · ready to save"', [await checkOf(0), await checkOf(1), await checkOf(2)].every((c) => c === 'Valid') && (await summary())?.startsWith('3 rows · ready to save'), await summary());
  check('TRN-01a', 'nothing sent while typing', sent(page, m, { writes: true }).length === 0);
  await clearToasts(page);
  m = mark(page);
  await saveBtn.click();
  await settle(page);
  w = sent(page, m, { writes: true });
  check('TRN-01a', 'the save sends one PUT, 200; toast "Saved 3 rows."; "3 rows · no changes"; save disabled again',
    w.length === 1 && w[0].method === 'PUT' && w[0].status === 200 && (await lastToast(page)) === 'Saved 3 rows.' && (await summary())?.startsWith('3 rows · no changes') && (await saveBtn.isDisabled()), { w: fmt(w), toast: await lastToast(page), summary: await summary() });
  const rawA = await (await fetch(`${API_BASE()}/users/me/transcript`, { headers: { Authorization: `Bearer ${await pageToken(page)}` } })).text();
  rowsA = JSON.parse(rawA).rows;
  check('TRN-01a', 'GET returns exactly T-A\'s 3 rows: capitals, 4 credits, graded, grades 7.5, 8.5 and 7 (a JSON number), term 2024/1',
    isDeepStrictEqual(simple(rowsA), [['CM102', 'Tư duy độc lập', 4, 'graded', 7.5, 2024, 1], ['CS160', 'Nhập môn Tin học', 4, 'graded', 8.5, 2024, 1], ['MTH251', 'Vi tích phân I', 4, 'graded', 7, 2024, 1]]) && /"courseCode":"MTH251"[^}]*"grade":7[,}]/.test(rawA), simple(rowsA));
  await page.reload({ waitUntil: 'networkidle' });
  await settle(page);
  check('TRN-01a', 'after the reload: CM102, CS160, MTH251 with "7.5", "8.5", "7.0"', isDeepStrictEqual(await listed(), [['CM102', '7.5'], ['CS160', '8.5'], ['MTH251', '7.0']]), await listed());
  await shot(page, 'a-trn-01ae-r28-a-saved.png');

  console.log('--- TRN-01b');
  m = mark(page);
  await page.click('#add-row');
  check('TRN-01b', 'the new row starts in "Term 1 2024–2025"', (await termOf(3)) === T1, await termOf(3));
  const steps = [];
  const read = async (label) => { steps.push({ step: label, fix: await fixOf(3), check: await checkOf(3), summary: await summary(), saveDisabled: await saveBtn.isDisabled() }); };
  await read('(1)');
  await fillRow(3, { code: 'z' }); await read('(2)');
  await fillRow(3, { code: 'ZZ902', name: 'Synthetic Outside Course', credits: '31' }); await read('(3)');
  await fillRow(3, { credits: '2.5' }); await read('(4)');
  await fillRow(3, { credits: '3', result: 'Graded' }); await read('(5)');
  await fillRow(3, { grade: '10.5' }); await read('(6)');
  await fillRow(3, { grade: '8.25' }); await read('(7)');
  await fillRow(3, { grade: '8,5' }); await read('(8)');
  for (const s of steps) console.log(`  ${JSON.stringify(s)}`);
  const FIX_ALL = 'Fix: code (2–20 letters or digits), course name, credits (0–30), result';
  const want = [FIX_ALL, FIX_ALL, 'Fix: credits (0–30), result', 'Fix: credits (0–30), result', 'Fix: grade (0–10, one decimal)', 'Fix: grade (0–10, one decimal)', 'Fix: grade (0–10, one decimal)', null];
  check('TRN-01b', 'the line under the row, step by step, as the case says', isDeepStrictEqual(steps.map((s) => s.fix), want), steps.map((s) => s.fix));
  check('TRN-01b', 'through (7): "Needs fixing", "4 rows · 1 to fix", save disabled', steps.slice(0, 7).every((s) => s.check === 'Needs fixing' && s.summary?.startsWith('4 rows · 1 to fix') && s.saveDisabled));
  check('TRN-01b', 'at (8): "Valid", "4 rows · ready to save", save enabled', steps[7].check === 'Valid' && steps[7].summary?.startsWith('4 rows · ready to save') && !steps[7].saveDisabled, steps[7]);
  check('TRN-01b', 'Network shows no PUT', sent(page, m, { writes: true }).length === 0);
  const bin = row(3).locator('td:nth-child(8) button');
  check('TRN-01b', 'the bin is named "Remove row 4 (ZZ902)"', (await bin.getAttribute('aria-label')) === 'Remove row 4 (ZZ902)', await bin.getAttribute('aria-label'));
  await clearToasts(page);
  await bin.click();
  await sleep(300);
  check('TRN-01b', 'the bin sends nothing; toast "Removed row 4 (ZZ902) from the table. Your saved transcript changes only when you save."; focus on Add row; "3 rows · no changes"',
    sent(page, m).length === 0 && (await lastToast(page)) === 'Removed row 4 (ZZ902) from the table. Your saved transcript changes only when you save.' && (await focused(page)).includes('#add-row') && (await summary())?.startsWith('3 rows · no changes'), { toast: await lastToast(page), focus: await focused(page), summary: await summary() });
  check('TRN-01b', 'GET still returns T-A\'s 3 rows', isDeepStrictEqual(simple(await transcript()), simple(rowsA)));
  }

  console.log('--- TRN-01c');
  m = mark(page);
  await fillRow(0, { grade: '8' });
  await fillRow(2, { result: 'Fail' });
  check('TRN-01c', 'picking Fail replaces MTH251\'s grade box with "No grade"', (await cell(2, 6).locator('input').count()) === 0 && (await tt(cell(2, 6))) === 'No grade', await tt(cell(2, 6)));
  const bin2 = row(1).locator('td:nth-child(8) button');
  check('TRN-01c', 'CS160\'s bin is "Remove row 2 (CS160)"', (await bin2.getAttribute('aria-label')) === 'Remove row 2 (CS160)');
  await bin2.click();
  await page.click('#add-row');
  await fillRow(2, { term: T1, code: 'PH211', name: 'Vật lý đại cương I', credits: '4', result: 'Graded', grade: '6,5' });
  check('TRN-01c', 'before the save "3 rows · ready to save"', (await summary())?.startsWith('3 rows · ready to save'), await summary());
  await clearToasts(page);
  await saveBtn.click();
  await settle(page);
  w = sent(page, m, { writes: true });
  check('TRN-01c', 'one PUT, "Saved 3 rows."', w.length === 1 && w[0].status === 200 && (await lastToast(page)) === 'Saved 3 rows.', { w: fmt(w), toast: await lastToast(page) });
  const rowsC = await transcript();
  check('TRN-01c', 'GET: exactly CM102 graded 8, MTH251 fail null, PH211 graded 6.5, all 2024/1; no CS160',
    isDeepStrictEqual(rowsC.map((r) => [r.courseCode, r.result, r.grade, r.term.year, r.term.number]), [['CM102', 'graded', 8, 2024, 1], ['MTH251', 'fail', null, 2024, 1], ['PH211', 'graded', 6.5, 2024, 1]]), simple(rowsC));
  await page.reload({ waitUntil: 'networkidle' });
  await settle(page);
  const afterC = await listed();
  check('TRN-01c', 'the reloaded screen lists the same 3 rows', isDeepStrictEqual(afterC.map((r) => r[0]), ['CM102', 'MTH251', 'PH211']), afterC);

  console.log('--- TRN-01d');
  m = mark(page);
  await row(2).locator('td:nth-child(8) button').click();
  await page.click('#add-row');
  await fillRow(2, { code: 'ZZ903', name: 'Synthetic Course Three', credits: '3', result: 'Pass' });
  page.dialogAnswer = 'dismiss';
  page.lastDialog = null;
  await page.click('[data-test="nav-audit"]');
  await settle(page);
  const d1 = page.lastDialog;
  const codesNow = await page.locator('[data-test^="row-"] td:nth-child(2) input').evaluateAll((l) => l.map((e) => e.value));
  check('TRN-01d', 'the browser asks "Your transcript has unsaved changes. Leave the page and discard them?"; Cancel keeps Transcript with the edits (no PH211, ZZ903 Valid)',
    d1 === 'Your transcript has unsaved changes. Leave the page and discard them?' && where(page) === '/transcript' && !codesNow.includes('PH211') && codesNow.includes('ZZ903') && (await checkOf(codesNow.indexOf('ZZ903'))) === 'Valid', { d1, url: where(page), codesNow });
  page.dialogAnswer = 'accept';
  page.lastDialog = null;
  await page.click('[data-test="nav-audit"]');
  await settle(page);
  check('TRN-01d', 'the second time the same question; OK opens the degree audit', page.lastDialog === 'Your transcript has unsaved changes. Leave the page and discard them?' && where(page) === '/audit', { dialog: page.lastDialog, url: where(page) });
  page.dialogAnswer = 'dismiss';
  await page.click('[data-test="nav-transcript"]');
  await settle(page);
  check('TRN-01d', 'no PUT at any point', sent(page, m, { writes: true }).length === 0, fmt(sent(page, m, { writes: true })));
  check('TRN-01d', 'back on Transcript: CM102, MTH251, PH211 with "3 rows · no changes"; GET unchanged',
    isDeepStrictEqual((await listed()).map((r) => r[0]), ['CM102', 'MTH251', 'PH211']) && (await summary())?.startsWith('3 rows · no changes') && isDeepStrictEqual(simple(await transcript()), simple(rowsC)), await summary());

  console.log('--- TRN-01e');
  await fillRow(0, { grade: '9' });
  const unblock = await block(page, 'api/users/me/transcript');
  m = mark(page);
  await saveBtn.click();
  await settle(page, 800);
  const alert = await tt(page.locator('[data-test="save-error"]'));
  check('TRN-01e', 'the blocked save shows "Could not save. Your rows are still here; try again in a moment."; CM102 still 9; save enabled',
    alert === 'Could not save. Your rows are still here; try again in a moment.' && (await cell(0, 6).locator('input').inputValue()) === '9' && (await saveBtn.isEnabled()), { alert, sent: fmt(sent(page, m)) });
  await shot(page, 'a-trn-01ae-r28-e-blocked.png');
  check('TRN-01e', 'the API (as Swagger would) still has CM102 grade 8', (await transcript()).find((r) => r.courseCode === 'CM102')?.grade === 8);
  await unblock();
  await clearToasts(page);
  await saveBtn.click();
  await settle(page);
  check('TRN-01e', 'the second save "Saved 3 rows.", the alert goes', (await lastToast(page)) === 'Saved 3 rows.' && !(await visible(page.locator('[data-test="save-error"]'))), await lastToast(page));
  check('TRN-01e', 'GET has CM102 grade 9; the screen shows "9.0"', (await transcript()).find((r) => r.courseCode === 'CM102')?.grade === 9 && (await cell(0, 6).locator('input').inputValue()) === '9.0', await cell(0, 6).locator('input').inputValue());
}

log(failureCount() ? `${failureCount()} FAIL(S)` : 'All checks ok');
await browser.close();
