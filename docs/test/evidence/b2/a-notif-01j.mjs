// TC-B2-NOTIF-01j on staging (docs/test/test-cases-b2.md §8, v0.14). Synthetic b2- accounts only.
//   node a-notif-01j.mjs
// Setup: N1 holds T-A; saving T-B, then T-A again makes two unread transcript_changed (a save that differs from a
// non-empty transcript, notifications.service.ts), and leaves N1 on T-A. Part A at 1280 px in Vietnamese, then English:
// the sidebar badge, the cards, Mark as read, an audit link. Part B at 360 px in Vietnamese, then English: the top-bar
// bell, the cards, Mark all as read. Never prints a token or a password.
import path from 'node:path';
import { BASE, EVIDENCE, fmt, focused, launch, mark, newPage, sent, settle, signIn, where } from './b-lib.mjs';
import { call, check, failureCount, log, signInApi, T_A, T_B } from './c-lib.mjs';

const N1 = 'b2-s9@example.com';
const KINDS = {
  vi: ['Sắp mở đăng ký học phần', 'Hôm nay mở đăng ký học phần', 'Hôm nay bắt đầu học kỳ', 'Bảng điểm đã thay đổi'],
  en: ['Course registration opens soon', 'Course registration opens today', 'The term starts today', 'Your transcript changed'],
};
const UNREAD_PREFIX = { vi: 'Chưa đọc: ', en: 'Unread: ' };
const TRANSCRIPT_CODES = /CS160|CM102|MTH251|PH211|CS163|\b\d[.,]\d\b/;

log('a-notif-01j');
console.log('--- setup');
const token = (await signInApi(N1)).token;
const count = async () => (await call('GET', '/notifications/unread-count', { token })).json?.unread;
const u0 = await count();
const sb = await call('PUT', '/users/me/transcript', { token, body: T_B, quiet: true });
const sa = await call('PUT', '/users/me/transcript', { token, body: T_A, quiet: true });
const u1 = await count();
check('setup', 'T-B then T-A each 200; two more unread (transcript_changed)', sb.status === 200 && sa.status === 200 && u1 === u0 + 2, { u0, u1 });

async function cards(page, lang) {
  return page.evaluate(([kinds, prefix]) => [...document.querySelectorAll('[data-test="notification"]')].map((li) => {
    const h = li.querySelector('h2');
    return {
      unread: li.classList.contains('unread'),
      title: h.innerText.trim(),
      known: kinds.includes(h.textContent.replace(prefix, '').trim()),
      srUnread: h.querySelector('.sr-only')?.textContent ?? null,
      detail: li.querySelector('.note-detail')?.innerText.trim(),
      time: li.querySelector('time')?.getAttribute('datetime'),
      links: [...li.querySelectorAll('a[data-test^="link-"]')].map((a) => a.dataset.test),
      markRead: !!li.querySelector('[data-test="mark-read"]'),
    };
  }), [KINDS[lang], UNREAD_PREFIX[lang]]);
}
const newestFirst = (list) => list.every((c, i) => i === 0 || list[i - 1].time >= c.time);
const badge = (page, scope) => page.locator(`${scope} [data-test="unread-badge"] [aria-hidden="true"]`).first().innerText().catch(() => null);
const noSideways = (page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
function checkList(id, list, lang, unread, langAttr) {
  check(id, `the cards in ${lang}: all ${list.length} shown newest first, each title a known kind, ${unread} unread with the "${UNREAD_PREFIX[lang].trim()}" prefix, transcript cards name no course or grade, <html lang="${lang}">`,
    list.length > 0 && newestFirst(list) && list.every((c) => c.known) && list.filter((c) => c.unread).length === unread && list.filter((c) => c.unread).every((c) => c.srUnread === UNREAD_PREFIX[lang] && c.markRead)
      && list.filter((c) => c.links.includes('link-audit')).every((c) => !TRANSCRIPT_CODES.test(c.detail)) && langAttr === lang,
    { lang: langAttr, cards: list.map((c) => `${c.unread ? '● ' : ''}${c.title} | ${c.detail} | ${c.time} | ${c.links.join(',')}`) });
}

const browser = await launch();
console.log('--- NOTIF-01j part A: 1280 px, Vietnamese then English');
const page = await newPage(browser, { lang: 'vi' });
await signIn(page, N1);
const side = 'aside';
const a1 = { badge: await badge(page, side), api: await count() };
check('NOTIF-01j', '(1) the sidebar badge equals GET /api/notifications/unread-count', a1.badge === String(a1.api), a1);
await page.click('[data-test="nav-notifications"]');
await settle(page);
let list = await cards(page, 'vi');
const total = (await call('GET', '/notifications', { token, quiet: true })).json.notifications.length;
checkList('NOTIF-01j', list, 'vi', a1.api, await page.evaluate(() => document.documentElement.lang));
check('NOTIF-01j', '(2) every notification of the API is a card (one page of 50)', list.length === total, { cards: list.length, api: total });
await page.screenshot({ path: path.join(EVIDENCE, 'a-notif-01j-1280-vi.png'), fullPage: true });

let m = mark(page);
const firstUnread = page.locator('[data-test="notification"].unread').first();
const firstTitle = (await firstUnread.locator('h2').innerText()).replace(UNREAD_PREFIX.vi, '').trim();
await firstUnread.locator('[data-test="mark-read"]').click();
await settle(page);
const afterMark = { sent: fmt(sent(page, m)), badge: await badge(page, side), api: await count(), focus: await focused(page) };
check('NOTIF-01j', `(3) Mark as read on "${firstTitle}": POST …/read, the badge one lower, focus on that card's link or heading`,
  sent(page, m, { writes: true }).length === 1 && /POST \/api\/notifications\/[0-9a-f-]+\/read 200/.test(afterMark.sent) && afterMark.api === a1.api - 1 && afterMark.badge === String(a1.api - 1) && /^a \[data-test=link-|^h2/.test(afterMark.focus),
  afterMark);

const unreadAudit = page.locator('[data-test="notification"].unread').filter({ has: page.locator('[data-test="link-audit"]') }).first();
check('NOTIF-01j', '(3) an unread transcript_changed card is left for the audit link', (await unreadAudit.count()) === 1);
m = mark(page);
await unreadAudit.locator('[data-test="link-audit"]').click();
await settle(page);
const reqs = sent(page, m);
const readIdx = reqs.findIndex((r) => /\/read$/.test(r.path) && r.method === 'POST');
const auditIdx = reqs.findIndex((r) => r.path.startsWith('/api/audit'));
const afterLink = { url: where(page), sent: fmt(reqs), badge: await badge(page, side), api: await count() };
check('NOTIF-01j', '(3) the audit link marks it read (POST …/read before the audit loads), opens /audit, the badge one lower again',
  afterLink.url === '/audit' && readIdx >= 0 && (auditIdx === -1 || readIdx < auditIdx) && afterLink.api === a1.api - 2 && afterLink.badge === String(a1.api - 2), afterLink);
await page.goBack({ waitUntil: 'networkidle' });
await settle(page);
check('NOTIF-01j', '(3) back on /notifications', where(page) === '/notifications', where(page));
await page.click(`${side} .lang-btn`);
await settle(page);
list = await cards(page, 'en');
checkList('NOTIF-01j', list, 'en', a1.api - 2, await page.evaluate(() => document.documentElement.lang));
const subtitleEn = (await page.locator('[data-test="subtitle"]').innerText()).trim();
check('NOTIF-01j', '(2) English subtitle and sidebar badge follow', subtitleEn === `${a1.api - 2} unread ${a1.api - 2 === 1 ? 'notification' : 'notifications'}.` && (await badge(page, side)) === String(a1.api - 2), subtitleEn);
await page.screenshot({ path: path.join(EVIDENCE, 'a-notif-01j-1280-en.png'), fullPage: true });
check('NOTIF-01j', '1280 px: no sideways scroll', await noSideways(page));
console.log(`  console errors: ${JSON.stringify(page.consoleErrors)}`);
await page.context().close();

console.log('--- NOTIF-01j part B: 360 px, Vietnamese then English');
const phone = await newPage(browser, { lang: 'vi', width: 360, height: 780 });
await signIn(phone, N1);
const top = '.mobile-top';
const b1 = { badge: await badge(phone, top), api: await count(), bell: await phone.locator('[data-test="bell"]').getAttribute('aria-label') };
check('NOTIF-01j', '(1) 360 px: the top-bar bell badge equals the unread count; the bell is named with it', b1.badge === String(b1.api) && b1.bell === `Thông báo, ${b1.api} chưa đọc`, b1);
await phone.click('[data-test="bell"]');
await settle(phone);
list = await cards(phone, 'vi');
checkList('NOTIF-01j', list, 'vi', b1.api, await phone.evaluate(() => document.documentElement.lang));
check('NOTIF-01j', '360 px Vietnamese: no sideways scroll', await noSideways(phone));
await phone.screenshot({ path: path.join(EVIDENCE, 'a-notif-01j-360-vi.png'), fullPage: true });
await phone.click(`${top} .lang-btn`);
await settle(phone);
list = await cards(phone, 'en');
checkList('NOTIF-01j', list, 'en', b1.api, await phone.evaluate(() => document.documentElement.lang));
check('NOTIF-01j', '360 px English: no sideways scroll; bell named "Notifications, n unread"', (await noSideways(phone)) && (await phone.locator('[data-test="bell"]').getAttribute('aria-label')) === `Notifications, ${b1.api} unread`);
m = mark(phone);
await phone.click('[data-test="read-all"]');
await settle(phone);
const afterAll = {
  sent: fmt(sent(phone, m)),
  unreadCards: await phone.locator('[data-test="notification"].unread').count(),
  markButtons: await phone.locator('[data-test="mark-read"]').count(),
  badges: await phone.locator('[data-test="unread-badge"]').count(),
  disabled: await phone.locator('[data-test="read-all"]').isDisabled(),
  focus: await focused(phone),
  subtitle: (await phone.locator('[data-test="subtitle"]').innerText()).trim(),
  api: await count(),
};
check('NOTIF-01j', '(3) Mark all as read: POST /api/notifications/read-all, no unread marker or badge left, the button disabled, focus on the heading',
  /POST \/api\/notifications\/read-all 200/.test(afterAll.sent) && afterAll.unreadCards === 0 && afterAll.markButtons === 0 && afterAll.badges === 0 && afterAll.disabled && afterAll.focus.startsWith('h1') && afterAll.api === 0 && afterAll.subtitle === 'You have read every notification.', afterAll);
await phone.screenshot({ path: path.join(EVIDENCE, 'a-notif-01j-360-en-all-read.png'), fullPage: true });
console.log(`  console errors: ${JSON.stringify(phone.consoleErrors)}`);
await browser.close();

const end = await call('GET', '/users/me/transcript', { token, quiet: true });
check('end', 'N1 holds T-A (3 rows) and 0 unread', end.json?.rows?.length === 3 && (await count()) === 0);
log(failureCount() ? `${failureCount()} FAIL(S)` : 'All checks ok');
