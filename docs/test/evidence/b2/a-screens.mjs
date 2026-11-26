// The B2 screen cases on staging (docs/test/test-cases-b2.md): ADM-01d–e, ADM-02i–j, ADM-05e–g, ADM-06g, ADM-07j
// (the console snippet) and TRN-01a–e.
//   node docs/test/evidence/b2/a-screens.mjs <01d|01e|02i|02j|05e|05f|05g|06g|07j|trn01>
// Headless Chrome through playwright-core, 1280 px, light theme, Vietnamese (TRN-01: English), as §1 says.
// "Network shows …" is read from the requests the page sent; "Block a request" aborts it as DevTools' request
// blocking does (net::ERR_BLOCKED_BY_CLIENT). Prints statuses and texts, never a token.
import { isDeepStrictEqual } from 'node:util';
import {
  ID, EMAIL, api, apiSignIn, launch, newPage, signIn, settle, mark, sent, fmt, toasts, clearToasts, block, pageToken,
  where, bodyText, has, shot, focused, goto, addressBar, check, failureCount, log, sleep,
} from './b-lib.mjs';

const which = process.argv[2];
log(`a-screens ${which}`);
const browser = await launch();

const N0 = 'History of Vietnamese Communist Party';
const N1 = 'History of the Communist Party of Vietnam';
const AE = 'Kiến thức Computer Science (A): tự chọn';
const AC = 'Tự chọn Computer Science (C)';
const KG = 'Kiến thức bắt buộc chuyên ngành';

const curriculum = async (token, program, year) => (await api('GET', `/programs/${program}/curricula/${year}`, token)).json;
const groupNamed = (c, name) => (c.requirementGroups ?? c.groups ?? []).find((g) => g.name === name);
const courseIn = (c, groupName, code) => groupNamed(c, groupName)?.courses.find((x) => x.code === code);
const R1 = async (token) => {
  const course = (await api('GET', '/courses/BAA00104', token)).json;
  const apcs = courseIn(await curriculum(token, 'APCS', 2024), 'Kiến thức Non Computer Science', 'BAA00104');
  const khmt = courseIn(await curriculum(token, 'CNTT-TCTA-KHMT', 2025), 'Lý luận chính trị - Pháp luật', 'BAA00104');
  const r = { course: course.nameEn, apcs2024: apcs?.nameEn, khmt2025: khmt?.nameEn, memberships: course.memberships.map((m) => m.curriculumCode) };
  console.log(`  R1 ${JSON.stringify({ ...r, memberships: r.memberships.length })}`);
  return r;
};
const reads = (r, n) => r.course === n && r.apcs2024 === n && r.khmt2025 === n;
const tt = (loc) => loc.innerText().then((s) => s.trim()).catch(() => null);
const visible = (loc) => loc.isVisible().catch(() => false);
const dialogOpen = (page, test) => page.locator(`dialog[open] [data-test="${test}"], dialog[open][data-test="${test}"]`).first().isVisible().catch(() => false);
async function pick(page, test, label) {
  const trigger = page.locator(`[data-test="${test}"]`);
  await trigger.click();
  const list = page.locator(`#${await trigger.getAttribute('aria-controls')}`);
  await list.locator('[role="option"]', { hasText: label }).first().click();
  await settle(page, 300);
}
const options = async (page, test) => {
  const trigger = page.locator(`[data-test="${test}"]`);
  await trigger.click();
  const labels = await page.locator(`#${await trigger.getAttribute('aria-controls')} [role="option"]`).allInnerTexts();
  await page.keyboard.press('Escape');
  return labels.map((s) => s.trim());
};
/** Opens a group of APCS 2024 in the curriculum section (the page is already on /admin/curriculum). */
async function openGroup(page, groupName, { program = 'APCS', year = 2024 } = {}) {
  if (!(await tt(page.locator('[data-test="admin-program"]')))?.startsWith(program)) await pick(page, 'admin-program', `${program} ·`);
  if (!(await tt(page.locator('[data-test="admin-cohort"]')))?.includes(String(year))) await pick(page, 'admin-cohort', String(year));
  await page.locator(`[data-test="group-row"][data-group-name="${groupName}"] [data-test="group-open"]`).click();
  await settle(page, 300);
}
const courseRow = (page, code) => page.locator(`[data-test="group-panel"] [data-test="course-row"][data-course="${code}"]`);
async function findCourse(page, code) {
  await page.fill('[data-test="catalog-code"]', code);
  await page.click('[data-test="catalog-find"]');
  await settle(page, 300);
}
const card = (page) => page.locator('[data-test="catalog-course"]');
const problem = (page) => tt(page.locator('dialog[open] [data-test="admin-problem"]'));
const lastToast = async (page) => (await toasts(page)).at(-1) ?? null;

// ------------------------------------------------------------------------------------------------
if (which === '01d') {
  const page = await newPage(browser);
  await signIn(page, EMAIL.A3);
  const token = await pageToken(page);
  const r0 = await R1(token);
  check('ADM-01d', 'R1 reads N0 everywhere before', reads(r0, N0), r0);
  await page.click('[data-test="nav-admin"]');
  await settle(page);
  check('ADM-01d', '/admin opens /admin/catalog', where(page) === '/admin/catalog', where(page));
  const tabs = await page.locator('[data-test="admin-tabs"] a').allInnerTexts();
  check('ADM-01d', 'Danh mục học phần is the only tab', isDeepStrictEqual(tabs.map((s) => s.trim()), ['Danh mục học phần']), tabs);
  const chips = await page.locator('[data-test="admin-held"] li').allInnerTexts();
  check('ADM-01d', 'chip "Quản lý danh mục học phần"', isDeepStrictEqual(chips.map((s) => s.trim()), ['Quản lý danh mục học phần']), chips);
  await findCourse(page, 'baa00104');
  check('ADM-01d', 'Tìm finds BAA00104 (upper-cased)', (await card(page).getAttribute('data-course')) === 'BAA00104');
  const credits = await tt(page.locator('[data-test="catalog-credits"] dd'));
  const nameEn = await tt(page.locator('[data-test="catalog-name-en"]'));
  const members = (await page.locator('[data-test="catalog-membership"]').allInnerTexts()).map((s) => s.trim());
  check('ADM-01d', 'card: 2 credits, N0, 11 curricula under Dùng trong, APCS 2024 and CNTT-TCTA-KHMT 2025 among them',
    credits === '2' && nameEn === N0 && members.length === 11 && members.some((s) => s.includes('APCS') && s.includes('2024')) && members.some((s) => s.includes('CNTT-TCTA-KHMT') && s.includes('2025')), { credits, nameEn, members });
  await shot(page, 'a-adm-01d-card.png');
  await page.click('[data-test="catalog-edit"]');
  await settle(page, 300);
  const warn = await tt(page.locator('[data-test="shared-warning"]'));
  check('ADM-01d', 'yellow box "Sửa ở đây đổi mọi chương trình đào tạo dùng học phần này", then "Đang dùng:" with the 11 codes',
    !!warn && warn.includes('Sửa ở đây đổi mọi chương trình đào tạo dùng học phần này') && warn.includes('Đang dùng:') && r0.memberships.every((c) => warn.includes(c)), warn);
  await page.fill('[data-test="course-nameEn"]', N1);
  await clearToasts(page);
  let m = mark(page);
  await page.click('[data-test="dialog-save"]');
  await settle(page);
  let w = sent(page, m, { writes: true });
  check('ADM-01d', 'Lưu sends one PATCH without confirmImpact, answered 409', w.length === 1 && w[0].method === 'PATCH' && !w[0].body.includes('confirmImpact') && w[0].status === 409, fmt(w));
  check('ADM-01d', 'no toast', (await toasts(page)).length === 0, await toasts(page));
  const title = await tt(page.locator('#course-dialog-title'));
  check('ADM-01d', 'dialog becomes "Xem lại ảnh hưởng trước khi lưu", focus on that title', title === 'Xem lại ảnh hưởng trước khi lưu' && (await focused(page)).includes('#course-dialog-title'), { title, focus: await focused(page) });
  const changes = await page.locator('[data-test="impact-change"]').evaluateAll((rows) => rows.map((r) => [...r.children].map((c) => c.innerText.trim())));
  check('ADM-01d', 'one row: Tên tiếng Anh, Hiện tại N0, Mới N1', isDeepStrictEqual(changes, [['Tên tiếng Anh', N0, N1]]), changes);
  const heads = await page.locator('dialog[open] .impact-changes thead th').allInnerTexts();
  check('ADM-01d', 'columns Hiện tại and Mới', heads.map((s) => s.trim()).includes('Hiện tại') && heads.map((s) => s.trim()).includes('Mới'), heads);
  const count = await tt(page.locator('[data-test="impact-count"]'));
  const affected = (await page.locator('[data-test="impact-curriculum"]').allInnerTexts()).map((s) => s.trim());
  const affectedCodes = await page.locator('[data-test="impact-curriculum"]').evaluateAll((l) => l.map((e) => e.dataset.curriculum));
  check('ADM-01d', '"11 chương trình đào tạo bị ảnh hưởng" and 11 lines such as "APCS · Khóa 2024 (APCS2024)", the same 11 as ADM-01a',
    count === '11 chương trình đào tạo bị ảnh hưởng' && affected.length === 11 && affected.includes('APCS · Khóa 2024 (APCS2024)') && isDeepStrictEqual([...affectedCodes].sort(), [...r0.memberships].sort()), { count, affected });
  await shot(page, 'a-adm-01d-review.png');
  m = mark(page);
  await page.click('[data-test="impact-back"]');
  await settle(page, 300);
  check('ADM-01d', 'Quay lại sửa sends nothing, back to the form with N1, focus in Tên tiếng Việt',
    sent(page, m).length === 0 && (await page.inputValue('[data-test="course-nameEn"]')) === N1 && (await focused(page)).includes('#course-nameVi'), { sent: fmt(sent(page, m)), focus: await focused(page) });
  m = mark(page);
  await page.click('[data-test="dialog-save"]');
  await settle(page);
  w = sent(page, m, { writes: true });
  check('ADM-01d', 'Lưu brings the review back with one more PATCH like the first', w.length === 1 && !w[0].body.includes('confirmImpact') && w[0].status === 409 && (await visible(page.locator('[data-test="impact-review"]'))), fmt(w));
  m = mark(page);
  await page.click('dialog[open] [data-test="dialog-cancel"]');
  await settle(page);
  check('ADM-01d', 'Hủy sends nothing, dialog closes with no toast, card still N0',
    sent(page, m).length === 0 && !(await dialogOpen(page, 'course-dialog')) && (await toasts(page)).length === 0 && (await tt(page.locator('[data-test="catalog-name-en"]'))) === N0, fmt(sent(page, m)));
  check('ADM-01d', 'R1 reads N0 everywhere', reads(await R1(token), N0));
  check('ADM-01d', 'up to here no request carried confirmImpact', page.requests.every((r) => !(r.body ?? '').includes('confirmImpact')));
  await page.click('[data-test="catalog-edit"]');
  await page.fill('[data-test="course-nameEn"]', N1);
  await page.click('[data-test="dialog-save"]');
  await settle(page);
  m = mark(page);
  await page.click('[data-test="impact-confirm"]');
  await settle(page);
  w = sent(page, m, { writes: true });
  check('ADM-01d', 'Xác nhận và lưu sends one PATCH with confirmImpact, answered 200', w.length === 1 && w[0].body.includes('confirmImpact') && w[0].status === 200, fmt(w));
  check('ADM-01d', 'dialog closes, toast "Đã lưu học phần BAA00104.", focus on Sửa, card N1',
    !(await dialogOpen(page, 'course-dialog')) && (await lastToast(page)) === 'Đã lưu học phần BAA00104.' && (await focused(page)).includes('catalog-edit') && (await tt(page.locator('[data-test="catalog-name-en"]'))) === N1,
    { toast: await lastToast(page), focus: await focused(page) });
  check('ADM-01d', 'R1 reads N1 in the course, APCS 2024 and CNTT-TCTA-KHMT 2025', reads(await R1(token), N1));
  console.log('--- restore');
  await page.click('[data-test="catalog-edit"]');
  await page.fill('[data-test="course-nameEn"]', N0);
  await page.click('[data-test="dialog-save"]');
  await settle(page);
  await page.click('[data-test="impact-confirm"]');
  await settle(page);
  check('ADM-01d', 'after the restore, R1 reads N0', reads(await R1(token), N0));
}

if (which === '01e') {
  const page = await newPage(browser);
  await signIn(page, EMAIL.A1);
  await page.click('[data-test="nav-admin"]');
  await settle(page);
  check('ADM-01e', '/admin opens /admin/curriculum', where(page) === '/admin/curriculum', where(page));
  const tabs = (await page.locator('[data-test="admin-tabs"] a').allInnerTexts()).map((s) => s.trim());
  const chips = (await page.locator('[data-test="admin-held"] li').allInnerTexts()).map((s) => s.trim());
  check('ADM-01e', 'Nhóm yêu cầu is the only tab, chip "Quản trị chương trình · APCS"', isDeepStrictEqual(tabs, ['Nhóm yêu cầu']) && isDeepStrictEqual(chips, ['Quản trị chương trình · APCS']), { tabs, chips });
  const m = mark(page);
  await addressBar(page, '/admin/catalog');
  const tabs2 = (await page.locator('[data-test="admin-tabs"] a').allInnerTexts()).map((s) => s.trim());
  const alert = await tt(page.locator('[data-test="admin-section-denied"]'));
  check('ADM-01e', 'tabs stay as they were', isDeepStrictEqual(tabs2, ['Nhóm yêu cầu']), tabs2);
  check('ADM-01e', 'red alert "Mục này cần quyền “Quản lý danh mục học phần”. Tài khoản của bạn không có quyền đó."', alert === 'Mục này cần quyền “Quản lý danh mục học phần”. Tài khoản của bạn không có quyền đó.', alert);
  check('ADM-01e', 'no code box and no course card', !(await visible(page.locator('[data-test="catalog-code"]'))) && !(await visible(card(page))));
  const bad = sent(page, m).filter((r) => r.path.startsWith('/api/courses') || r.path.startsWith('/api/admin/catalog'));
  check('ADM-01e', 'no request to api/courses or api/admin/catalog', bad.length === 0, fmt(sent(page, m)));
  await shot(page, 'a-adm-01e-denied.png');
}

if (which === '02i') {
  // (1) S1
  let page = await newPage(browser);
  await signIn(page, EMAIL.S1);
  check('ADM-02i', '(1) S1\'s sidebar has no Quản trị', (await page.locator('[data-test="nav-admin"]').count()) === 0);
  let m = mark(page);
  await addressBar(page, '/admin');
  const none = await tt(page.locator('[data-test="admin-no-permission"]'));
  check('ADM-02i', '(1) /admin opens with no redirect and the card "Bạn không có quyền quản trị", the sentence and Mở Cài đặt',
    where(page) === '/admin' && !!none && none.includes('Bạn không có quyền quản trị') && none.includes('Nếu bạn cần quyền, hãy gửi mã người dùng của bạn (ở trang Cài đặt) cho người quản lý phân quyền.') && none.includes('Mở Cài đặt'), { url: where(page), none });
  await shot(page, 'a-adm-02i-no-permission.png');
  await page.click('[data-test="admin-no-permission"] a');
  await settle(page);
  check('ADM-02i', '(1) Mở Cài đặt opens /settings#profile', where(page) === '/settings#profile', where(page));
  await page.context().close();
  // (2) A3
  page = await newPage(browser);
  await signIn(page, EMAIL.A3);
  m = mark(page);
  await addressBar(page, '/admin/curriculum');
  const tabs = (await page.locator('[data-test="admin-tabs"] a').allInnerTexts()).map((s) => s.trim());
  const a1 = await tt(page.locator('[data-test="admin-section-denied"]'));
  await addressBar(page, '/admin/access');
  const a2 = await tt(page.locator('[data-test="admin-section-denied"]'));
  check('ADM-02i', '(2) Danh mục học phần is A3\'s only tab', isDeepStrictEqual(tabs, ['Danh mục học phần']), tabs);
  check('ADM-02i', '(2) alerts with “Quản trị chương trình”, then “Quản lý phân quyền”',
    a1 === 'Mục này cần quyền “Quản trị chương trình”. Tài khoản của bạn không có quyền đó.' && a2 === 'Mục này cần quyền “Quản lý phân quyền”. Tài khoản của bạn không có quyền đó.', { a1, a2 });
  let bad = sent(page, m).filter((r) => /^\/api\/(admin\/(programs|access)|programs)/.test(r.path));
  check('ADM-02i', '(2) the refused sections load nothing of their own', bad.length === 0, fmt(sent(page, m)));
  await page.context().close();
  // (3) A4
  page = await newPage(browser);
  await signIn(page, EMAIL.A4);
  await page.click('[data-test="nav-admin"]');
  await settle(page);
  const head = await tt(page.locator('#access-admin-title, [aria-labelledby] h2').first());
  const tabs4 = (await page.locator('[data-test="admin-tabs"] a').allInnerTexts()).map((s) => s.trim());
  check('ADM-02i', '(3) /admin opens /admin/access, "Phân quyền quản trị", Phân quyền the only tab', where(page) === '/admin/access' && (await has(page, 'Phân quyền quản trị')) && isDeepStrictEqual(tabs4, ['Phân quyền']), { url: where(page), head, tabs4 });
  m = mark(page);
  await addressBar(page, '/admin/catalog');
  const b1 = await tt(page.locator('[data-test="admin-section-denied"]'));
  await addressBar(page, '/admin/curriculum');
  const b2 = await tt(page.locator('[data-test="admin-section-denied"]'));
  check('ADM-02i', '(3) alerts with “Quản lý danh mục học phần” and “Quản trị chương trình”',
    b1 === 'Mục này cần quyền “Quản lý danh mục học phần”. Tài khoản của bạn không có quyền đó.' && b2 === 'Mục này cần quyền “Quản trị chương trình”. Tài khoản của bạn không có quyền đó.', { b1, b2 });
  bad = sent(page, m).filter((r) => /^\/api\/(admin\/(programs|catalog)|programs|courses)/.test(r.path));
  check('ADM-02i', '(3) the refused sections load nothing of their own', bad.length === 0, fmt(sent(page, m)));
  await page.context().close();
  // (4) A2
  page = await newPage(browser);
  await signIn(page, EMAIL.A2);
  await page.click('[data-test="nav-admin"]');
  await settle(page);
  const opts = await options(page, 'admin-program');
  check('ADM-02i', '(4) the Chương trình picker lists CNTT-TCTA-KHMT only, never APCS', opts.length === 1 && opts[0].startsWith('CNTT-TCTA-KHMT') && !opts.some((o) => o.startsWith('APCS')), opts);
}

if (which === '02j') {
  const page = await newPage(browser);
  await signIn(page, EMAIL.A1);
  const a4 = await apiSignIn(EMAIL.A4);
  const apcs = (await api('GET', '/admin/access/programs', a4)).json.programs.find((p) => p.code === 'APCS');
  await page.click('[data-test="nav-admin"]');
  await settle(page);
  await openGroup(page, AE);
  const termsCell = courseRow(page, 'CS420').locator('[data-test="offering-terms"]');
  check('ADM-02j', 'CS420\'s Kỳ mở reads "Chưa ghi nhận" before', (await tt(termsCell))?.startsWith('Chưa ghi nhận'), await tt(termsCell));
  await courseRow(page, 'CS420').locator('[data-test="edit-terms"]').click();
  await page.check('[data-test="term-1"]');
  await page.check('[data-test="term-2"]');
  const rev = await api('DELETE', `/admin/access/users/${ID.A1}/programs/${apcs.id}`, a4);
  check('ADM-02j', 'A4 revokes A1\'s APCS grant (200)', rev.status === 200);
  let m = mark(page);
  await page.click('dialog[open] [data-test="dialog-save"]');
  await settle(page);
  const w = sent(page, m, { writes: true });
  check('ADM-02j', 'Lưu sends one PUT, answered 403', w.length === 1 && w[0].method === 'PUT' && w[0].status === 403, fmt(w));
  const note = await problem(page);
  check('ADM-02j', 'dialog stays open with HK1 and HK2 ticked, note "Thao tác này cần quyền “Quản trị chương trình”. Tài khoản của bạn không có quyền đó. Chưa lưu gì."',
    (await dialogOpen(page, 'terms-dialog')) && (await page.isChecked('[data-test="term-1"]')) && (await page.isChecked('[data-test="term-2"]')) && note === 'Thao tác này cần quyền “Quản trị chương trình”. Tài khoản của bạn không có quyền đó. Chưa lưu gì.', note);
  check('ADM-02j', 'Quản trị leaves the sidebar at once', (await page.locator('[data-test="nav-admin"]').count()) === 0);
  await shot(page, 'a-adm-02j-refused-dialog.png');
  await page.click('dialog[open] [data-test="dialog-cancel"]');
  await settle(page);
  const banner = await tt(page.locator('[data-test="admin-refused"]'));
  check('ADM-02j', 'after Hủy: the group table stays, with the red banner and "Trang này được giữ nguyên để bạn chép lại những gì đã nhập."',
    (await visible(page.locator('[data-test="group-panel"]'))) && !!banner && banner.includes('Lần lưu vừa rồi bị từ chối: thao tác đó cần quyền “Quản trị chương trình”, mà tài khoản của bạn không có. Chưa lưu gì.') && banner.includes('Trang này được giữ nguyên để bạn chép lại những gì đã nhập.'), banner);
  await shot(page, 'a-adm-02j-banner.png');
  await page.click('[data-test="admin-refused-close"]');
  await settle(page);
  check('ADM-02j', 'after Tải lại theo quyền hiện tại: focus on the heading "Quản trị", card "Bạn không có quyền quản trị"',
    (await focused(page)).includes('#admin-title') && (await tt(page.locator('#admin-title'))) === 'Quản trị' && (await has(page, 'Bạn không có quyền quản trị')), await focused(page));
  const c = await curriculum(a4, 'APCS', 2024);
  check('ADM-02j', 'CS420 still reads offeringTerms null', courseIn(c, AE, 'CS420')?.offeringTerms === null);
  const back = await api('PUT', `/admin/access/users/${ID.A1}/programs/${apcs.id}`, a4);
  const g = (await api('GET', `/admin/access/users/${ID.A1}/grants`, a4)).json;
  check('ADM-02j', 'restore 200, A1 holds APCS again', back.status === 200 && g.programs.map((p) => p.programCode).join() === 'APCS');
}

// ------------------------------------------------------------------------------------------------
const fieldError = (page, field) => tt(page.locator(`dialog[open] #course-${field}-error`));
async function saveDialog(page) {
  const m = mark(page);
  await page.click('dialog[open] [data-test="dialog-save"]');
  await settle(page);
  return sent(page, m, { writes: true });
}

if (which === '05e') {
  const page = await newPage(browser);
  await signIn(page, EMAIL.A3);
  await page.click('[data-test="nav-admin"]');
  await settle(page);
  await page.click('[data-test="catalog-add"]');
  await page.fill('[data-test="course-code"]', 'cs-1');
  await page.fill('[data-test="course-nameVi"]', 'Học phần thử ADM-05 màn hình');
  await page.fill('[data-test="course-credits"]', '0');
  let w = await saveDialog(page);
  check('ADM-05e', 'first Lưu sends one POST, answered 400', w.length === 1 && w[0].method === 'POST' && w[0].status === 400, fmt(w));
  let note = await problem(page);
  check('ADM-05e', 'dialog open, red note "Máy chủ từ chối giá trị đã nhập. Chưa lưu gì."', (await dialogOpen(page, 'course-dialog')) && note?.startsWith('Máy chủ từ chối giá trị đã nhập. Chưa lưu gì.'), note);
  const inv = await page.getAttribute('[data-test="course-credits"]', 'aria-invalid');
  check('ADM-05e', '"credits must not be less than 1" under Tín chỉ, marked invalid; nothing under Mã học phần',
    (await fieldError(page, 'credits')) === 'credits must not be less than 1' && inv === 'true' && (await fieldError(page, 'code')) === null, { credits: await fieldError(page, 'credits'), inv, code: await fieldError(page, 'code') });
  await shot(page, 'a-adm-05e-field-error.png');
  await page.fill('[data-test="course-credits"]', '2.5');
  w = await saveDialog(page);
  check('ADM-05e', 'with 2.5, Tín chỉ says "credits must be an integer number"', w[0]?.status === 400 && (await fieldError(page, 'credits')) === 'credits must be an integer number', await fieldError(page, 'credits'));
  await page.fill('[data-test="course-credits"]', '3');
  w = await saveDialog(page);
  check('ADM-05e', 'with 3, POST 400 and Mã học phần says `code: "cs-1" is not a course code (letters A-Z and digits, 2 to 20)`',
    w[0]?.status === 400 && (await fieldError(page, 'code')) === 'code: "cs-1" is not a course code (letters A-Z and digits, 2 to 20)', { w: fmt(w), code: await fieldError(page, 'code') });
  await page.fill('[data-test="course-code"]', ' zzadm05s ');
  await clearToasts(page);
  w = await saveDialog(page);
  check('ADM-05e', 'fourth Lưu 201, toast "Đã thêm học phần ZZADM05S vào danh mục."', w[0]?.status === 201 && (await lastToast(page)) === 'Đã thêm học phần ZZADM05S vào danh mục.', { w: fmt(w), toast: await lastToast(page) });
  check('ADM-05e', 'card ZZADM05S, 3 credits, "Chưa có chương trình đào tạo nào dùng học phần này."',
    (await card(page).getAttribute('data-course')) === 'ZZADM05S' && (await tt(page.locator('[data-test="catalog-credits"] dd'))) === '3' && (await tt(page.locator('[data-test="catalog-unused"]'))) === 'Chưa có chương trình đào tạo nào dùng học phần này.');
  await page.click('[data-test="catalog-add"]');
  await page.fill('[data-test="course-code"]', 'ZZADM05S');
  await page.fill('[data-test="course-nameVi"]', 'Học phần thử ADM-05 màn hình');
  await page.fill('[data-test="course-credits"]', '3');
  w = await saveDialog(page);
  note = await problem(page);
  check('ADM-05e', 'second course 409 with "Danh mục đã có học phần mang mã này. Chưa lưu gì."', w[0]?.status === 409 && note === 'Danh mục đã có học phần mang mã này. Chưa lưu gì.', { w: fmt(w), note });
  await page.click('dialog[open] [data-test="dialog-cancel"]');
  await settle(page, 300);
  check('ADM-05e', 'Hủy closes the dialog', !(await dialogOpen(page, 'course-dialog')));
  let m = mark(page);
  await page.click('[data-test="catalog-edit"]');
  await page.fill('[data-test="course-credits"]', '4');
  await page.click('dialog[open] [data-test="dialog-cancel"]');
  await settle(page, 300);
  await page.click('[data-test="catalog-edit"]');
  await page.fill('[data-test="course-credits"]', '4');
  await page.keyboard.press('Escape');
  await settle(page, 300);
  check('ADM-05e', 'Hủy and Esc send no request, card still 3 credits', sent(page, m).length === 0 && !(await dialogOpen(page, 'course-dialog')) && (await tt(page.locator('[data-test="catalog-credits"] dd'))) === '3', fmt(sent(page, m)));
  await clearToasts(page);
  await page.click('[data-test="catalog-edit"]');
  m = mark(page);
  await page.click('dialog[open] [data-test="dialog-save"]');
  await settle(page);
  check('ADM-05e', 'saving the unchanged form sends nothing, toast "Không có gì thay đổi, nên chưa gửi gì."', sent(page, m).length === 0 && (await lastToast(page)) === 'Không có gì thay đổi, nên chưa gửi gì.', { sent: fmt(sent(page, m)), toast: await lastToast(page) });
  if (await dialogOpen(page, 'course-dialog')) await page.click('dialog[open] [data-test="dialog-cancel"]');
  await findCourse(page, 'BAA00104');
  m = mark(page);
  await page.click('[data-test="catalog-delete"]');
  await settle(page, 300);
  const dTitle = await tt(page.locator('#admin-confirm-title'));
  check('ADM-05e', 'Xóa opens "Xóa học phần BAA00104?" with the focus on Hủy', dTitle === 'Xóa học phần BAA00104?' && (await focused(page)).includes('confirm-no'), { dTitle, focus: await focused(page) });
  await page.click('dialog[open] [data-test="confirm-no"]');
  await settle(page, 300);
  check('ADM-05e', 'Hủy sends nothing', sent(page, m).length === 0, fmt(sent(page, m)));
  await page.click('[data-test="catalog-delete"]');
  m = mark(page);
  await page.click('dialog[open] [data-test="confirm-yes"]');
  await settle(page);
  w = sent(page, m, { writes: true });
  note = await problem(page);
  check('ADM-05e', 'second Xóa sends one DELETE, answered 409', w.length === 1 && w[0].method === 'DELETE' && w[0].status === 409, fmt(w));
  check('ADM-05e', '"Chưa gỡ được vì còn chỗ đang dùng mục này. Chưa đổi gì. Gỡ các chỗ sau trước:" over a list with APCS2024 and CNTT-TCTA-KHMT-2025 in words',
    !!note && note.includes('Chưa gỡ được vì còn chỗ đang dùng mục này. Chưa đổi gì. Gỡ các chỗ sau trước:') && note.includes('chương trình đào tạo APCS2024 còn dùng học phần này') && note.includes('chương trình đào tạo CNTT-TCTA-KHMT-2025 còn dùng học phần này'), note);
  await shot(page, 'a-adm-05e-refused-delete.png');
  await page.click('dialog[open] [data-test="confirm-no"]');
  check('ADM-05e', 'BAA00104 is still there', (await api('GET', '/courses/BAA00104', await pageToken(page))).status === 200);
  await page.context().close();
  // A1's link of an unknown code
  const p1 = await newPage(browser);
  await signIn(p1, EMAIL.A1);
  await p1.click('[data-test="nav-admin"]');
  await settle(p1);
  await openGroup(p1, AC);
  const before = (await p1.locator('[data-test="group-panel"] [data-test="course-row"]').evaluateAll((l) => l.map((e) => e.dataset.course)));
  await p1.fill('[data-test="link-code"]', 'zzadm99');
  m = mark(p1);
  await p1.click('[data-test="link-submit"]');
  await settle(p1);
  w = sent(p1, m, { writes: true });
  const linkNote = await tt(p1.locator('[data-test="group-panel"] [data-test="admin-problem"]'));
  check('ADM-05e', 'A1\'s link sends one PUT, answered 404, with "Không tìm thấy: … Chưa lưu gì."',
    w.length === 1 && w[0].method === 'PUT' && w[0].status === 404 && linkNote === 'Không tìm thấy: danh mục không có học phần mang mã này, hoặc nhóm này vừa bị xóa. Học phần mới do người quản lý danh mục tạo trước. Chưa lưu gì.', { w: fmt(w), linkNote });
  const after = (await p1.locator('[data-test="group-panel"] [data-test="course-row"]').evaluateAll((l) => l.map((e) => e.dataset.course)));
  const apiAfter = groupNamed(await curriculum(await pageToken(p1), 'APCS', 2024), AC).courses.map((c) => c.code);
  check('ADM-05e', 'the group is unchanged', isDeepStrictEqual(after, before) && isDeepStrictEqual([...apiAfter].sort(), [...before].sort()), { before, after });
}

if (which === '05f') {
  const page = await newPage(browser);
  await signIn(page, EMAIL.A3);
  await page.click('[data-test="nav-admin"]');
  await settle(page);
  await findCourse(page, 'ZZADM05S');
  check('ADM-05f', 'ZZADM05S has 3 credits', (await tt(page.locator('[data-test="catalog-credits"] dd'))) === '3');
  // (1) Not saved
  await page.click('[data-test="catalog-edit"]');
  await page.fill('[data-test="course-credits"]', '4');
  let unblock = await block(page, 'api/admin/catalog/courses');
  await clearToasts(page);
  let m = mark(page);
  await page.click('dialog[open] [data-test="dialog-save"]');
  await settle(page, 1500);
  let s = sent(page, m);
  check('ADM-05f', '(1) the PATCH is blocked, the screen reads the course again (GET 200), no second PATCH, no toast',
    s.filter((r) => r.method === 'PATCH').length === 1 && String(s.find((r) => r.method === 'PATCH')?.status).includes('BLOCKED') && s.some((r) => r.method === 'GET' && r.path === '/api/courses/ZZADM05S' && r.status === 200) && (await toasts(page)).length === 0, fmt(s));
  let note = await problem(page);
  check('ADM-05f', '(1) dialog open, yellow note "Máy chủ không trả lời yêu cầu lưu, … Dữ liệu đã lưu chưa có thay đổi này. Kiểm tra lại, rồi lưu lần nữa nếu cần."',
    (await dialogOpen(page, 'course-dialog')) && note === 'Máy chủ không trả lời yêu cầu lưu, nên OmniCourse đã tải lại dữ liệu đã lưu. Dữ liệu đã lưu chưa có thay đổi này. Kiểm tra lại, rồi lưu lần nữa nếu cần.' && (await page.getAttribute('dialog[open] [data-test="admin-problem"]', 'class')).includes('warn'), note);
  await shot(page, 'a-adm-05f-not-saved.png');
  await unblock();
  let w = await saveDialog(page);
  check('ADM-05f', '(1) second Lưu 200, toast "Đã lưu học phần ZZADM05S.", card 4', w[0]?.status === 200 && (await lastToast(page)) === 'Đã lưu học phần ZZADM05S.' && (await tt(page.locator('[data-test="catalog-credits"] dd'))) === '4', { w: fmt(w), toast: await lastToast(page) });
  // (2) Unknown
  await page.click('[data-test="catalog-edit"]');
  await page.fill('[data-test="course-credits"]', '5');
  unblock = await block(page, 'api/admin/catalog/courses', 'api/courses/');
  m = mark(page);
  await page.click('dialog[open] [data-test="dialog-save"]');
  await settle(page, 1500);
  note = await problem(page);
  check('ADM-05f', '(2) "Máy chủ không trả lời, và OmniCourse cũng chưa tải lại được dữ liệu đã lưu. Chưa rõ thay đổi đã được lưu hay chưa. Hãy tải lại dữ liệu trước khi thử lại."',
    note?.startsWith('Máy chủ không trả lời, và OmniCourse cũng chưa tải lại được dữ liệu đã lưu. Chưa rõ thay đổi đã được lưu hay chưa. Hãy tải lại dữ liệu trước khi thử lại.'), note);
  check('ADM-05f', '(2) Lưu disabled, Tải lại dữ liệu offered', (await page.isDisabled('dialog[open] [data-test="dialog-save"]')) && (await visible(page.locator('dialog[open] [data-test="admin-problem"] button', { hasText: 'Tải lại dữ liệu' }))));
  await shot(page, 'a-adm-05f-unknown.png');
  await page.click('dialog[open] [data-test="dialog-cancel"]');
  await settle(page, 500);
  const stale = await tt(page.locator('[data-test="catalog-stale"]'));
  check('ADM-05f', '(2) after Hủy: "Chưa tải lại được dữ liệu đã lưu. Những gì đang hiện có thể đã cũ. Tải lại trước khi sửa tiếp.", focus on Tải lại dữ liệu, edit buttons disabled',
    stale?.startsWith('Chưa tải lại được dữ liệu đã lưu. Những gì đang hiện có thể đã cũ. Tải lại trước khi sửa tiếp.') && (await focused(page)).includes('catalog-reload') && (await page.isDisabled('[data-test="catalog-edit"]')) && (await page.isDisabled('[data-test="catalog-delete"]')), { stale, focus: await focused(page) });
  await shot(page, 'a-adm-05f-stale.png');
  await unblock();
  await page.click('[data-test="catalog-reload"]');
  await settle(page);
  check('ADM-05f', '(2) after the reload: card 4 (the saved value), warning gone, buttons work',
    (await tt(page.locator('[data-test="catalog-credits"] dd'))) === '4' && !(await visible(page.locator('[data-test="catalog-stale"]'))) && (await page.isEnabled('[data-test="catalog-edit"]')), await tt(page.locator('[data-test="catalog-credits"] dd')));
  check('ADM-05f', '(1)–(2) the screen never sent a write by itself (PATCHes: one per Lưu)', sent(page, m, { writes: true }).length === 1, fmt(sent(page, m, { writes: true })));
  // (3) Saved, answer lost
  await page.evaluate(() => {
    const realFetch = window.fetch;
    window.fetch = async (input, init = {}) => {
      if ((init.method ?? 'GET').toUpperCase() === 'GET') return realFetch(input, init);
      window.fetch = realFetch;
      await realFetch(input, init);
      throw new TypeError('ADM-05f: answer dropped by the test');
    };
  });
  await clearToasts(page);
  await page.click('[data-test="catalog-edit"]');
  await page.fill('[data-test="course-credits"]', '5');
  m = mark(page);
  await page.click('dialog[open] [data-test="dialog-save"]');
  await settle(page, 1500);
  s = sent(page, m);
  check('ADM-05f', '(3) one PATCH, answered 200, then a GET of the course', s.filter((r) => r.method === 'PATCH').length === 1 && s.find((r) => r.method === 'PATCH').status === 200 && s.findIndex((r) => r.method === 'GET' && r.path === '/api/courses/ZZADM05S') > s.findIndex((r) => r.method === 'PATCH'), fmt(s));
  const green = await page.locator('.callout.ok, [data-test="admin-notice"]').allInnerTexts();
  check('ADM-05f', '(3) dialog closes, no toast, green line "… Dữ liệu đã lưu có thay đổi này.", card 5',
    !(await dialogOpen(page, 'course-dialog')) && (await toasts(page)).length === 0 && green.some((g) => g.includes('Máy chủ không trả lời yêu cầu lưu, nên OmniCourse đã tải lại dữ liệu đã lưu. Dữ liệu đã lưu có thay đổi này.')) && (await tt(page.locator('[data-test="catalog-credits"] dd'))) === '5', { green, toasts: await toasts(page) });
  await shot(page, 'a-adm-05f-saved-answer-lost.png');
  await sleep(3000);
  check('ADM-05f', '(3) no write sent again', sent(page, m, { writes: true }).length === 1, fmt(sent(page, m, { writes: true })));
}

if (which === '05g') {
  const a2 = await apiSignIn(EMAIL.A2);
  const khmt = (await api('GET', '/admin/programs', a2)).json.programs.find((p) => p.code === 'CNTT-TCTA-KHMT');
  const KHMT25 = khmt.curricula.find((c) => c.cohortYear === 2025).id;
  const kg = groupNamed(await curriculum(a2, 'CNTT-TCTA-KHMT', 2025), KG).id;
  const p1 = await newPage(browser);
  await signIn(p1, EMAIL.A1);
  await p1.click('[data-test="nav-admin"]');
  await settle(p1);
  await openGroup(p1, AC);
  await p1.fill('[data-test="link-code"]', 'zzadm05s');
  let m = mark(p1);
  await p1.press('[data-test="link-code"]', 'Enter');
  await settle(p1);
  let w = sent(p1, m, { writes: true });
  const linkToast = await lastToast(p1);
  check('ADM-05g', 'A1\'s Enter sends one PUT, 204; toast names the group; ZZADM05S in the table; focus stays in the empty code box',
    w.length === 1 && w[0].status === 204 && !!linkToast && linkToast.includes('ZZADM05S') && linkToast.includes(AC) && (await courseRow(p1, 'ZZADM05S').count()) === 1 && (await focused(p1)).includes('link-code') && (await p1.inputValue('[data-test="link-code"]')) === '', { w: fmt(w), linkToast, focus: await focused(p1) });
  const p3 = await newPage(browser);
  await signIn(p3, EMAIL.A3);
  await p3.click('[data-test="nav-admin"]');
  await settle(p3);
  await findCourse(p3, 'ZZADM05S');
  await p3.click('[data-test="catalog-edit"]');
  await p3.fill('[data-test="course-credits"]', '4');
  w = await saveDialog(p3);
  let count = await tt(p3.locator('[data-test="impact-count"]'));
  let affected = (await p3.locator('[data-test="impact-curriculum"]').allInnerTexts()).map((s) => s.trim());
  check('ADM-05g', 'A3\'s review: "1 chương trình đào tạo bị ảnh hưởng", "APCS · Khóa 2024 (APCS2024)"', w[0]?.status === 409 && count === '1 chương trình đào tạo bị ảnh hưởng' && isDeepStrictEqual(affected, ['APCS · Khóa 2024 (APCS2024)']), { count, affected });
  const link = await api('PUT', `/admin/programs/${khmt.id}/cohorts/${KHMT25}/requirement-groups/${kg}/courses/ZZADM05S`, a2);
  check('ADM-05g', 'A2\'s link 204', link.status === 204);
  m = mark(p3);
  await p3.click('[data-test="impact-confirm"]');
  await settle(p3);
  w = sent(p3, m, { writes: true });
  const changed = await tt(p3.locator('[data-test="impact-changed"]'));
  count = await tt(p3.locator('[data-test="impact-count"]'));
  affected = (await p3.locator('[data-test="impact-curriculum"]').allInnerTexts()).map((s) => s.trim());
  check('ADM-05g', 'first Xác nhận và lưu 409; review again under the red alert, "2 chương trình đào tạo bị ảnh hưởng", APCS2024 and CNTT-TCTA-KHMT 2025',
    w[0]?.status === 409 && changed === 'Giá trị của học phần, hoặc danh sách chương trình đào tạo dùng nó, đã đổi từ lúc bạn xem. Chưa lưu gì. Xem lại danh sách mới rồi xác nhận lần nữa.' && count === '2 chương trình đào tạo bị ảnh hưởng' && isDeepStrictEqual(affected, ['APCS · Khóa 2024 (APCS2024)', 'CNTT-TCTA-KHMT · Khóa 2025 (CNTT-TCTA-KHMT-2025)']), { w: fmt(w), changed, count, affected });
  await shot(p3, 'a-adm-05g-impact-changed.png');
  check('ADM-05g', 'nothing saved yet (API: 5 credits)', (await api('GET', '/courses/ZZADM05S', a2)).json.credits === 5);
  await clearToasts(p3);
  m = mark(p3);
  await p3.click('[data-test="impact-confirm"]');
  await settle(p3);
  w = sent(p3, m, { writes: true });
  const members = await p3.locator('[data-test="catalog-membership"]').count();
  check('ADM-05g', 'second Xác nhận và lưu 200, toast "Đã lưu học phần ZZADM05S.", card 4 credits and both curricula under Dùng trong',
    w[0]?.status === 200 && (await lastToast(p3)) === 'Đã lưu học phần ZZADM05S.' && (await tt(p3.locator('[data-test="catalog-credits"] dd'))) === '4' && members === 2, { w: fmt(w), toast: await lastToast(p3), members });
  console.log('--- clean-up');
  await clearToasts(p1);
  await courseRow(p1, 'ZZADM05S').locator('[data-test="unlink-course"]').click();
  await settle(p1, 300);
  const uTitle = await tt(p1.locator('#admin-confirm-title'));
  const uBody = await tt(p1.locator('#admin-confirm-body'));
  const unlinkName = await courseRow(p1, 'ZZADM05S').locator('[data-test="unlink-course"]').getAttribute('aria-label');
  check('ADM-05g', 'bin named "Bỏ ZZADM05S khỏi nhóm"; dialog "Bỏ ZZADM05S khỏi nhóm này?" and its sentence',
    unlinkName === 'Bỏ ZZADM05S khỏi nhóm' && uTitle === 'Bỏ ZZADM05S khỏi nhóm này?' && uBody === 'ZZADM05S sẽ rời nhóm “Tự chọn Computer Science (C)”. Học phần vẫn còn trong danh mục và trong các nhóm khác.', { unlinkName, uTitle, uBody });
  check('ADM-05g', 'the confirm button says Bỏ khỏi nhóm', (await tt(p1.locator('dialog[open] [data-test="confirm-yes"]'))) === 'Bỏ khỏi nhóm');
  m = mark(p1);
  await p1.click('dialog[open] [data-test="confirm-yes"]');
  await settle(p1);
  w = sent(p1, m, { writes: true });
  check('ADM-05g', 'removal 204, "Đã bỏ ZZADM05S khỏi nhóm. Học phần vẫn còn trong danh mục."', w[0]?.status === 204 && (await lastToast(p1)) === 'Đã bỏ ZZADM05S khỏi nhóm. Học phần vẫn còn trong danh mục.', { w: fmt(w), toast: await lastToast(p1) });
  const del = await api('DELETE', `/admin/programs/${khmt.id}/cohorts/${KHMT25}/requirement-groups/${kg}/courses/ZZADM05S`, a2);
  check('ADM-05g', 'A2\'s DELETE 204', del.status === 204);
  await clearToasts(p3);
  await findCourse(p3, 'ZZADM05S');
  await p3.click('[data-test="catalog-delete"]');
  m = mark(p3);
  await p3.click('dialog[open] [data-test="confirm-yes"]');
  await settle(p3);
  w = sent(p3, m, { writes: true });
  check('ADM-05g', 'deletion 204, toast "Đã xóa học phần ZZADM05S khỏi danh mục.", card gone, focus on the code box',
    w[0]?.status === 204 && (await lastToast(p3)) === 'Đã xóa học phần ZZADM05S khỏi danh mục.' && !(await visible(card(p3))) && (await focused(p3)).includes('catalog-code'), { w: fmt(w), toast: await lastToast(p3), focus: await focused(p3) });
  check('ADM-05g', 'GET /courses/ZZADM05S 404', (await api('GET', '/courses/ZZADM05S', a2)).status === 404);
}

if (which === '06g') {
  // (1) S1
  const s1 = await newPage(browser);
  await signIn(s1, EMAIL.S1);
  await goto(s1, '/settings');
  const shown = await s1.inputValue('[data-test="user-id"]');
  const ro = await s1.getAttribute('[data-test="user-id"]', 'readonly');
  await clearToasts(s1);
  let m = mark(s1);
  await s1.click('[data-test="copy-user-id"]');
  await settle(s1, 500);
  const clip = await s1.evaluate(() => navigator.clipboard.readText());
  const me = (await api('GET', '/users/me', await pageToken(s1))).json;
  check('ADM-06g', '(1) the box shows S1\'s whole ID, read-only', shown === me.id && ro !== null, shown);
  check('ADM-06g', '(1) Sao chép sends no request, toast "Đã sao chép mã người dùng.", focus stays on the button',
    sent(s1, m).length === 0 && (await lastToast(s1)) === 'Đã sao chép mã người dùng.' && (await focused(s1)).includes('copy-user-id'), { sent: fmt(sent(s1, m)), toast: await lastToast(s1), focus: await focused(s1) });
  check('ADM-06g', '(1) the copied ID is the one GET /api/users/me gives (the clipboard, read in place of pasting it in the address bar)', clip === me.id && me.id === ID.S1, clip);
  await shot(s1, 'a-adm-06g-settings-copied.png');
  await s1.context().close();
  // (2)–(7) A4
  const page = await newPage(browser);
  await signIn(page, EMAIL.A4);
  await page.click('[data-test="nav-admin"]');
  await settle(page);
  check('ADM-06g', '(2) /admin opens /admin/access', where(page) === '/admin/access', where(page));
  await page.fill('[data-test="access-user-id"]', ` ${ID.S1} `);
  await page.click('[data-test="access-find"]');
  await settle(page);
  const panel = await tt(page.locator('[data-test="access-user"]'));
  const states = await page.locator('[data-test="access-status"]').allInnerTexts();
  check('ADM-06g', '(2) trimmed; "Quyền của người dùng" with S1\'s ID, no name or email; "Người dùng này chưa quản trị chương trình nào."; both global "Chưa có"',
    (await tt(page.locator('[data-test="access-shown-id"]'))) === ID.S1 && panel.includes('Quyền của người dùng') && !panel.includes('Test Student') && !panel.includes('@') && panel.includes('Người dùng này chưa quản trị chương trình nào.') && states.length === 2 && states.every((s) => s.trim() === 'Chưa có'), { states });
  await clearToasts(page);
  await pick(page, 'access-program', 'APCS ·');
  m = mark(page);
  await page.click('[data-test="access-grant-program"]');
  await settle(page);
  let w = sent(page, m, { writes: true });
  const row = page.locator('[data-test="access-program-grant"][data-program="APCS"]');
  const cells = await row.locator('td').allInnerTexts();
  check('ADM-06g', '(3) one PUT 200, no confirmation, toast "Đã cấp quyền “Quản trị chương trình APCS”."', w.length === 1 && w[0].method === 'PUT' && w[0].status === 200 && !(await dialogOpen(page, 'confirm-dialog')) && (await lastToast(page)) === 'Đã cấp quyền “Quản trị chương trình APCS”.', { w: fmt(w), toast: await lastToast(page) });
  check('ADM-06g', '(3) APCS row: Cấp lúc now, Người cấp A4\'s ID', cells.length >= 2 && cells[0].trim().length > 0 && cells[1].trim() === ID.A4, cells);
  await shot(page, 'a-adm-06g-granted.png');
  await row.locator('[data-test="access-revoke-program"]').click();
  await settle(page, 300);
  const rTitle = await tt(page.locator('#admin-confirm-title'));
  const rBody = await tt(page.locator('#admin-confirm-body'));
  check('ADM-06g', '(4) "Thu hồi quyền này?" with its sentence, focus on Hủy',
    rTitle === 'Thu hồi quyền này?' && rBody === 'Người dùng này sẽ mất quyền “Quản trị chương trình APCS”. Lần ghi tiếp theo của họ cần quyền đó sẽ bị từ chối.' && (await focused(page)).includes('confirm-no'), { rTitle, rBody, focus: await focused(page) });
  m = mark(page);
  await page.click('dialog[open] [data-test="confirm-no"]');
  await settle(page, 300);
  check('ADM-06g', '(4) Hủy sends nothing', sent(page, m).length === 0, fmt(sent(page, m)));
  await row.locator('[data-test="access-revoke-program"]').click();
  m = mark(page);
  await page.click('dialog[open] [data-test="confirm-yes"]');
  await settle(page);
  w = sent(page, m, { writes: true });
  check('ADM-06g', '(4) one DELETE 200, "Đã thu hồi quyền “Quản trị chương trình APCS”.", focus on the Chương trình picker, no programs again',
    w.length === 1 && w[0].method === 'DELETE' && w[0].status === 200 && (await lastToast(page)) === 'Đã thu hồi quyền “Quản trị chương trình APCS”.' && (await focused(page)).includes('access-program') && (await has(page, 'Người dùng này chưa quản trị chương trình nào.')), { w: fmt(w), toast: await lastToast(page), focus: await focused(page) });
  m = mark(page);
  await page.click('[data-test="access-grant-catalog_maintainer"]');
  await settle(page);
  const held = await tt(page.locator('[data-test="access-global-catalog_maintainer"] [data-test="access-status"]'));
  check('ADM-06g', '(5) Cấp gives "Đang có · cấp lúc …" with a check; focus stays on that row\'s button, now Thu hồi',
    sent(page, m, { writes: true })[0]?.status === 200 && held?.startsWith('Đang có · cấp lúc') && (await page.locator('[data-test="access-global-catalog_maintainer"] [data-test="access-status"] svg, [data-test="access-global-catalog_maintainer"] [data-test="access-status"] .icon').count()) > 0 && (await focused(page)).includes('access-action-catalog_maintainer') && (await focused(page)).includes('Thu hồi'), { held, focus: await focused(page) });
  await page.click('[data-test="access-revoke-catalog_maintainer"]');
  await page.click('dialog[open] [data-test="confirm-yes"]');
  await settle(page);
  check('ADM-06g', '(5) the revocation brings back "Chưa có"', (await tt(page.locator('[data-test="access-global-catalog_maintainer"] [data-test="access-status"]'))) === 'Chưa có');
  await page.fill('[data-test="access-user-id"]', '00000000-0000-4000-8000-000000000000');
  await page.click('[data-test="access-find"]');
  await settle(page);
  const r1 = await tt(page.locator('[data-test="access-refused"]'));
  await page.fill('[data-test="access-user-id"]', 'not-an-id');
  await page.click('[data-test="access-find"]');
  await settle(page);
  const r2 = await tt(page.locator('[data-test="access-refused"]'));
  const under = await tt(page.locator('#access-user-id-error'));
  check('ADM-06g', '(6) "Không có tài khoản nào mang mã này.", then "Máy chủ không nhận mã này." with the API\'s message under the box',
    r1 === 'Không có tài khoản nào mang mã này.' && r2 === 'Máy chủ không nhận mã này.' && !!under, { r1, r2, under });
  await shot(page, 'a-adm-06g-not-an-id.png');
  await page.fill('[data-test="access-user-id"]', ID.A4);
  await page.click('[data-test="access-find"]');
  await settle(page);
  const own = await tt(page.locator('[data-test="access-own"]'));
  await page.click('[data-test="access-revoke-access_manager"]');
  await settle(page, 300);
  const ownBody = await tt(page.locator('dialog[open]'));
  m = mark(page);
  await page.click('dialog[open] [data-test="confirm-yes"]');
  await settle(page);
  w = sent(page, m, { writes: true });
  const lastNote = await problem(page);
  check('ADM-06g', '(7) chip "Tài khoản của bạn"; the dialog adds "Đây là tài khoản của bạn: bạn sẽ mất quyền này ngay."', own === 'Tài khoản của bạn' && ownBody.includes('Đây là tài khoản của bạn: bạn sẽ mất quyền này ngay.'), { own, ownBody });
  check('ADM-06g', '(7) DELETE 409, "Đây là người quản lý phân quyền cuối cùng còn hoạt động. Cấp quyền này cho người khác trước khi thu hồi. Chưa đổi gì."',
    w[0]?.status === 409 && lastNote === 'Đây là người quản lý phân quyền cuối cùng còn hoạt động. Cấp quyền này cho người khác trước khi thu hồi. Chưa đổi gì.', { w: fmt(w), lastNote });
  await shot(page, 'a-adm-06g-last-access-manager.png');
  await page.click('dialog[open] [data-test="confirm-no"]');
  await settle(page, 300);
  check('ADM-06g', '(7) "Quản lý phân quyền" still reads "Đang có"', (await tt(page.locator('[data-test="access-global-access_manager"] [data-test="access-status"]')))?.startsWith('Đang có'));
  const tok = await pageToken(page);
  const g4 = (await api('GET', `/admin/access/users/${ID.A4}/grants`, tok)).json;
  const gs = (await api('GET', `/admin/access/users/${ID.S1}/grants`, tok)).json;
  check('ADM-06g', 'A4 still holds access_manager, S1 holds no grant', g4.permissions.map((p) => p.permission).join() === 'access_manager' && !gs.programs.length && !gs.permissions.length);
}

if (which === '07j') {
  const page = await newPage(browser);
  await signIn(page, EMAIL.A3);
  const lines = [];
  page.on('console', async (msg) => {
    const args = await Promise.all(msg.args().map((a) => a.jsonValue().catch(() => String(a))));
    const line = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
    lines.push(line);
    console.log(`  console: ${line}`);
  });
  // The limits snippet of ADM-07j, unchanged, inside an async function (the console allows a top-level await).
  await page.evaluate(async () => {
    const url = '/api/admin/catalog/imports/preview';
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionStorage.getItem('omnicourse.session')}` };
    const HEADER = 'code,name_vi,name_en,credits,theory_periods,lab_periods,exercise_periods,project_periods';
    const records = (n) => Array.from({ length: n }, (_, i) => `ZZL${String(i + 1).padStart(4, '0')},Học phần giới hạn ${i + 1},,1,,,,`).join('\n');
    const send = async (label, csv) => {
      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ csv }) });
      const json = (res.headers.get('content-type') ?? '').includes('json');
      const body = json ? await res.json() : (await res.text()).slice(0, 80);
      console.log(label, res.status, json ? { code: body.code, message: body.message, summary: body.summary, errors: body.errors?.length } : body);
    };
    await send('(1) 1,000 records', HEADER + '\n' + records(1000));
    await send('(2) 1,001 records', HEADER + '\n' + records(1001));
    await send('(3) 1 MiB + 1 byte', HEADER + '\n' + 'x'.repeat(1048577 - HEADER.length - 1));
    await send('(4) JSON body of 6.3 MiB', '\u0001'.repeat(1100000));
    await send('(5) JSON body of 7.2 MiB', '\u0001'.repeat(1250000));
  });
  await sleep(500);
  const line = (n) => lines.find((l) => l.startsWith(`(${n})`)) ?? '';
  check('ADM-07j', '(1) 200, no code, inserts 1000, 0 errors', /^\(1\) 1,000 records 200 /.test(line(1)) && line(1).includes('"inserts":1000') && line(1).includes('"errors":0') && !line(1).includes('"code"'), line(1));
  check('ADM-07j', '(2) 413 payload_too_large "The CSV has more than 1000 data records"', line(2).includes(' 413 ') && line(2).includes('payload_too_large') && line(2).includes('The CSV has more than 1000 data records'), line(2));
  check('ADM-07j', '(3) 413 payload_too_large "The CSV is larger than 1 MiB of UTF-8 text"', line(3).includes(' 413 ') && line(3).includes('payload_too_large') && line(3).includes('The CSV is larger than 1 MiB of UTF-8 text'), line(3));
  check('ADM-07j', '(4) the same 413 as (3), as JSON (not nginx\'s HTML page)', line(4).includes(' 413 ') && line(4).includes('The CSV is larger than 1 MiB of UTF-8 text') && !line(4).includes('<html'), line(4));
  check('ADM-07j', '(5) 413 payload_too_large "The request body is larger than 7 MiB", as JSON', line(5).includes(' 413 ') && line(5).includes('The request body is larger than 7 MiB') && !line(5).includes('<html'), line(5));
  check('ADM-07j', 'GET /courses/ZZL0001 404', (await api('GET', '/courses/ZZL0001', await pageToken(page))).status === 404);
}

// ------------------------------------------------------------------------------------------------
if (which === 'trn01' || which === 'trn01cde') {
  // trn01cde resumes at TRN-01c from the transcript TRN-01a saved and TRN-01b left (T-A), after the first run
  // stopped on a script fault (a stale token) once TRN-01b's screen checks were done.
  const resume = which === 'trn01cde';
  // Prepare (T): signed up and onboarded through the API (setup, not a case), then the screen in English.
  if (!resume) {
  const t0 = await (async () => {
    const r = await fetch(`${API_BASE()}/auth/sign-up`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: EMAIL.T, password: 'correct horse battery', displayName: 'Test Student', acceptedTerms: true }) });
    console.log(`  API POST /auth/sign-up (${EMAIL.T}) → ${r.status}`);
    return r.status === 201 ? (await r.json()).token : apiSignIn(EMAIL.T);
  })();
  const ob = await api('PUT', '/users/me/onboarding', t0, { program: 'APCS', cohort: 2024, targetGraduationTerm: null, creditsPerTerm: null, internshipTerm: null, finished: true });
  check('TRN-01 prepare', 'T onboarded to APCS 2024', ob.status === 200);
  const tr0 = (await api('GET', '/users/me/transcript', t0)).json;
  check('TRN-01 prepare', 'T has no transcript', (tr0.rows ?? []).length === 0, tr0);
  }
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
  await shot(page, 'a-trn-01a-saved.png');

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
  await shot(page, 'a-trn-01e-blocked.png');
  check('TRN-01e', 'the API (as Swagger would) still has CM102 grade 8', (await transcript()).find((r) => r.courseCode === 'CM102')?.grade === 8);
  await unblock();
  await clearToasts(page);
  await saveBtn.click();
  await settle(page);
  check('TRN-01e', 'the second save "Saved 3 rows.", the alert goes', (await lastToast(page)) === 'Saved 3 rows.' && !(await visible(page.locator('[data-test="save-error"]'))), await lastToast(page));
  check('TRN-01e', 'GET has CM102 grade 9; the screen shows "9.0"', (await transcript()).find((r) => r.courseCode === 'CM102')?.grade === 9 && (await cell(0, 6).locator('input').inputValue()) === '9.0', await cell(0, 6).locator('input').inputValue());
}
function API_BASE() { return 'https://stag-omnicourses.lamter.cc/api'; }

log(failureCount() ? `${failureCount()} FAIL(S)` : 'All checks ok');
await browser.close();
