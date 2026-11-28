// TC-B2-SHARE-01l on staging (docs/test/test-cases-b2.md §7, v0.14). Synthetic b2- accounts only.
//   node a-share-01l.mjs
// O owns {P}. The script stops the 25 Nov link {T4} first, so that (1) starts from a plan with no link, and adds CS202
// to 2026-1 (24 credits, above the 22 maximum) so the shared page carries a rule-engine issue; both are put back at the
// end except the link, which (3) stops. The new link is printed as {T5}. Never prints a token or a password.
import path from 'node:path';
import { BASE, EVIDENCE, fmt, launch, mark, newPage, sent, settle, signIn, toasts } from './b-lib.mjs';
import { call, check, failureCount, log, secret, signInApi } from './c-lib.mjs';

const O = 'b2-s12@example.com';
const P = '580c48d3-1ad9-4c74-8625-c78eb5ed7c36';
const course = (courseCode) => ({ kind: 'course', courseCode });
const FIVE = ['CS160', 'CS163', 'CS201', 'MTH251', 'PH211'].map(course);
const SIX = [...FIVE, course('CS202')];
const board = (placements) => ({ terms: [{ term: { year: 2026, number: 1 }, placements }] });
const GRADES = /\b(8[.,]5|7[.,]5|7[.,]0)\b/;
const A4_PRINTABLE_PX = 718;
const SMALLEST_READABLE_PX = 9;

log('a-share-01l');
console.log('--- setup');
const o = (await signInApi(O)).token;
const before = await call('GET', `/plans/${P}/share`, { token: o, show: (j) => JSON.stringify({ share: j.share && { ...j.share, token: '{T4}' } }) });
const t4 = before.json.share?.token;
secret(t4, '{T4}');
const stop4 = await call('DELETE', `/plans/${P}/share`, { token: o });
check('setup', '{T4} stopped (204) so that (1) starts with no link', stop4.status === 204, stop4.status);
if (t4) check('setup', '{T4} now reads 404', (await call('GET', `/shared-plans/${t4}`, { quiet: true })).status === 404);
const put6 = await call('PUT', `/plans/${P}/placements`, { token: o, body: board(SIX), quiet: true });
const issues6 = await call('GET', `/plans/${P}/issues`, { token: o, quiet: true });
const above = (issues6.json?.issues ?? []).filter((i) => i.code === 'load_above_maximum');
check('setup', 'CS202 added: 24 credits in 2026-1 and a load_above_maximum flag', put6.status === 200 && above.length === 1, above);

const browser = await launch();
const owner = await newPage(browser, { lang: 'en' });
await signIn(owner, O);
await owner.goto(`${BASE}/plans/${P}`, { waitUntil: 'networkidle' });
await settle(owner);

console.log('--- SHARE-01l (1) the Share dialog');
await owner.click('[data-test="share-plan"]');
await owner.waitForSelector('[data-test="share-show-name"]');
const name = owner.locator('[data-test="share-show-name"]');
const checks = owner.locator('[data-test="share-show-transcript-checks"]');
const warning = owner.locator('[data-test="transcript-checks-warning"]');
check('SHARE-01l', '(1) both boxes start unchecked, no live link, the "anyone with the link" note',
  !(await name.isChecked()) && !(await checks.isChecked()) && (await owner.locator('[data-test="active-share"]').count()) === 0 && (await owner.locator('[data-test="share-anyone-note"]').count()) === 1);
let m = mark(owner);
await name.check();
await checks.check();
const warnText = (await warning.innerText().catch(() => '')).trim();
check('SHARE-01l', '(1) ticking the transcript checks shows the warning, and nothing is sent', warnText.startsWith('Anyone with the link can infer your course history') && sent(owner, m).length === 0, { warnText, sent: fmt(sent(owner, m)) });
await owner.screenshot({ path: path.join(EVIDENCE, 'a-share-01l-dialog-warning.png') });
m = mark(owner);
await owner.click('[data-test="create-share-link"]');
await owner.waitForSelector('[data-test="share-url"]');
await settle(owner);
const url = await owner.locator('[data-test="share-url"]').inputValue();
const t5 = url.split('/shared/')[1];
secret(t5, '{T5}');
console.log(`  link: ${url}`);
check('SHARE-01l', '(1) Create link: one PUT …/share, the read-only /shared/{T5} URL and Copy link, the toast',
  sent(owner, m, { writes: true }).length === 1 && url === `${BASE}/shared/${t5}` && (await owner.locator('[data-test="copy-share-link"]').count()) === 1 && (await toasts(owner)).includes('Created read-only shared plan link.'),
  { writes: fmt(sent(owner, m, { writes: true })), toasts: await toasts(owner) });
const saveBtn = owner.locator('[data-test="save-share-options"]');
const disabledAfterCreate = await saveBtn.isDisabled();
m = mark(owner);
await checks.uncheck();
const staged = { warning: await warning.count(), saveEnabled: await saveBtn.isEnabled(), sent: sent(owner, m).length };
await checks.check();
const stagedOn = { warning: await warning.count(), saveEnabled: await saveBtn.isEnabled(), sent: sent(owner, m).length };
await checks.uncheck();
check('SHARE-01l', '(1) toggling the box stages it: the warning follows the box, Save changes enables, nothing sent until Save',
  disabledAfterCreate && staged.warning === 0 && staged.saveEnabled && stagedOn.warning === 1 && !stagedOn.saveEnabled && sent(owner, m).length === 0,
  { disabledAfterCreate, off: staged, on: stagedOn });
m = mark(owner);
await saveBtn.click();
await settle(owner);
const saveReq = sent(owner, m, { writes: true });
check('SHARE-01l', '(1) Save changes: one PUT …/share with showName true, showTranscriptChecks false; Save disabled again',
  saveReq.length === 1 && JSON.parse(saveReq[0].body ?? '{}').showTranscriptChecks === false && JSON.parse(saveReq[0].body ?? '{}').showName === true && (await saveBtn.isDisabled()),
  { writes: fmt(saveReq), body: saveReq[0]?.body });

console.log('--- SHARE-01l (2) the reader, signed out');
const reader = await newPage(browser, { lang: 'en' });
const readShared = async (label) => {
  await reader.goto(`${BASE}/shared/${t5}`, { waitUntil: 'networkidle' });
  await settle(reader);
  const text = await reader.locator('body').innerText();
  const s = {
    robots: await reader.evaluate(() => document.querySelector('meta[name="robots"]')?.content ?? null),
    banner: (await reader.locator('[data-test="readonly-banner"]').innerText().catch(() => '')).trim(),
    owner: (await reader.locator('[data-test="owner-name"]').innerText().catch(() => '')).trim() || null,
    placements: await reader.locator('[data-test="term-2026-1"] [data-test^="placement-"]').count(),
    load: (await reader.locator('[data-test="term-2026-1"] [data-test="term-load"]').innerText().catch(() => '')).trim(),
    flags: await reader.locator('[data-test="shared-issues"] [data-test="issue-flag"]').allInnerTexts(),
    violations: await reader.locator('[data-test="shared-issues"] [data-test="issue-violation"]').count(),
    withheld: await reader.locator('[data-test="withheld-checks-notice"]').count(),
    coverage: await reader.locator('[data-test="shared-coverage"]').count(),
    inputs: await reader.locator('input, textarea, select, [contenteditable="true"], [draggable="true"]').count(),
    buttons: (await reader.locator('main button, main a.btn').allInnerTexts()).map((x) => x.trim()),
    signedInChrome: await reader.locator('[data-test="nav-plans"], [data-test="share-plan"]').count(),
    grades: GRADES.test(text),
    email: /@example\.com/.test(text),
    width: await reader.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  };
  console.log(`  ${label}: ${JSON.stringify(s)}`);
  return s;
};
const r1 = await readShared('reader, showName on, checks off');
await reader.screenshot({ path: path.join(EVIDENCE, 'a-share-01l-reader-1280.png'), fullPage: true });
check('SHARE-01l', '(2) robots noindex, nofollow; read-only banner; "Shared by Test Student"; the six courses at 24 credits; the load_above_maximum flag; the withheld note; no coverage; no editing control; no grade or email',
  r1.robots === 'noindex, nofollow' && r1.banner.includes('Shared plan · read-only') && r1.owner === 'Shared by Test Student' && r1.placements === 6 && r1.flags.some((t) => t.includes('24 credits')) && r1.withheld === 1 && r1.coverage === 0 && r1.inputs === 0 && r1.signedInChrome === 0 && !r1.grades && !r1.email && r1.width, r1);

await name.uncheck();
await checks.check();
m = mark(owner);
await saveBtn.click();
await settle(owner);
check('SHARE-01l', '(2) as O: name off, checks on, Save changes sends one PUT', sent(owner, m, { writes: true }).length === 1, fmt(sent(owner, m, { writes: true })));
const r2 = await readShared('reader, showName off, checks on');
await reader.screenshot({ path: path.join(EVIDENCE, 'a-share-01l-reader-checks-on.png'), fullPage: true });
check('SHARE-01l', '(2) after reload: no owner name; the transcript checks and group coverage show; no withheld note; still no grade or email',
  r2.owner === null && r2.coverage === 1 && r2.withheld === 0 && !r2.grades && !r2.email, r2);

const narrow = await newPage(browser, { lang: 'vi', width: 360, height: 800 });
await narrow.goto(`${BASE}/shared/${t5}`, { waitUntil: 'networkidle' });
await settle(narrow);
const narrowState = { width: await narrow.evaluate(() => document.documentElement.scrollWidth <= innerWidth), lang: await narrow.evaluate(() => document.documentElement.lang), banner: (await narrow.locator('[data-test="readonly-banner"]').innerText().catch(() => '')).trim() };
await narrow.screenshot({ path: path.join(EVIDENCE, 'a-share-01l-reader-360-vi.png'), fullPage: true });
check('SHARE-01l', '(2) 360 px, Vietnamese: no sideways scroll, banner "Kế hoạch được chia sẻ · chỉ đọc"', narrowState.width && narrowState.banner.includes('Kế hoạch được chia sẻ · chỉ đọc'), narrowState);
await narrow.context().close();

console.log('--- SHARE-01l (3) Print / Save as PDF');
await reader.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
await reader.click('[data-test="print-pdf"]');
check('SHARE-01l', '(3) the Print / Save as PDF button calls window.print once', (await reader.evaluate(() => window.__printed)) === 1);
await reader.setViewportSize({ width: A4_PRINTABLE_PX, height: 1000 });
await reader.emulateMedia({ media: 'print' });
await settle(reader);
const print = await reader.evaluate((minPx) => {
  const visible = (e) => { const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0; };
  const sel = (q) => [...document.querySelectorAll(q)].filter(visible).length;
  const all = [...document.querySelectorAll('body *')].filter(visible);
  const overflowing = all.filter((e) => e.getBoundingClientRect().right > document.documentElement.clientWidth + 1).map((e) => e.className || e.tagName).slice(0, 5);
  const textEls = all.filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()));
  const sizes = textEls.map((e) => parseFloat(getComputedStyle(e).fontSize));
  return {
    scrollFits: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    overflowing,
    smallestFont: Math.min(...sizes),
    tooSmall: textEls.filter((e) => parseFloat(getComputedStyle(e).fontSize) < minPx).map((e) => e.textContent.trim().slice(0, 30)).slice(0, 5),
    printButton: sel('[data-test="print-pdf"]'),
    sidebarOrHeader: sel('aside.sidebar, nav, header.public-head, .mobile-top, .tabbar'),
    terms: sel('[data-test="term-2026-1"]'),
    placements: sel('[data-test^="placement-"]'),
    flags: sel('[data-test="shared-issues"] [data-test="issue-flag"]'),
    load: document.querySelector('[data-test="term-load"]')?.innerText.trim(),
    bodyBg: getComputedStyle(document.body).backgroundColor,
  };
}, SMALLEST_READABLE_PX);
console.log(`  print media at ${A4_PRINTABLE_PX} px (A4 portrait less 10 mm margins): ${JSON.stringify(print)}`);
await reader.screenshot({ path: path.join(EVIDENCE, 'a-share-01l-print-media.png'), fullPage: true });
await reader.pdf({ path: path.join(EVIDENCE, 'a-share-01l-print.pdf'), format: 'A4', margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' }, printBackground: true });
check('SHARE-01l', '(3) print layout on A4 portrait: nothing wider than the page, no button or app chrome, the term, its 6 courses, load and flag shown, text at 9 px or more',
  print.scrollFits && print.overflowing.length === 0 && print.printButton === 0 && print.terms === 1 && print.placements === 6 && print.flags >= 1 && print.smallestFont >= SMALLEST_READABLE_PX, print);
await reader.emulateMedia({ media: 'screen' });
await reader.setViewportSize({ width: 1280, height: 800 });

m = mark(owner);
await owner.click('[data-test="stop-sharing"]');
await settle(owner);
check('SHARE-01l', '(3) Stop sharing: one DELETE …/share, the toast, the dialog back to Create link',
  sent(owner, m, { writes: true }).length === 1 && (await toasts(owner)).includes('Stopped sharing. The link no longer works.') && (await owner.locator('[data-test="create-share-link"]').count()) === 1,
  fmt(sent(owner, m, { writes: true })));
await reader.goto(`${BASE}/shared/${t5}`, { waitUntil: 'networkidle' });
await settle(reader);
const gone = { notShared: (await reader.locator('[data-test="not-shared"]').innerText().catch(() => '')).trim(), terms: await reader.locator('[data-test^="term-"]').count(), planName: (await reader.locator('body').innerText()).includes('SHARE-01 plan') };
await reader.screenshot({ path: path.join(EVIDENCE, 'a-share-01l-not-shared.png') });
check('SHARE-01l', '(3) the reader\'s reload shows "This plan is not shared" and no plan data', gone.notShared.includes('This plan is not shared') && gone.terms === 0 && !gone.planName, gone);
console.log(`  console errors: owner ${JSON.stringify(owner.consoleErrors)}, reader ${JSON.stringify(reader.consoleErrors)}`);
await browser.close();

console.log('--- clean-up');
const back = await call('PUT', `/plans/${P}/placements`, { token: o, body: board(FIVE), quiet: true });
const end = await call('GET', `/plans/${P}/share`, { token: o });
check('clean-up', '{P} back to its five courses; no live link', back.status === 200 && end.json?.share === null);
log(failureCount() ? `${failureCount()} FAIL(S)` : 'All checks ok');
