// USER-01j (a plan keeps the curriculum it was made with) and PLAN-01i (plan tabs), as the stand-in for b1-02:
// b1-run-<run>-p02@example.com, onboarded to APCS 2024 through the API.
import { T, addCourse, board, browser, call, check, email, log, newPlan, openPlans, saved, shot, signedIn, sleep, summary, text, tokenFor, SITE } from './p-lib.mjs';

const mail = email(process.env.ACC ?? '03'); // p02 was used by a first run that stopped on a script error (p-user-01j-plan-01i-output.txt holds the rerun)
const token = await tokenFor(mail);
const ob = await call(token, 'PUT', '/users/me/onboarding', { program: 'APCS', cohort: 2024, targetGraduationTerm: null, creditsPerTerm: null, internshipTerm: null, finished: true });
check('setup', 'onboarded to APCS 2024 (API, 200)', ob.status === 200, ob.status);

const b = await browser();
const A = await signedIn(b, mail);
const page = A.page;
const tiles = async () => (await board(page)).map((r) => `${r.name}: ${r.tiles.join(' ') || '-'}`).join(' | ');
const toast = async (re, ms = 4000) => {
  await page.waitForFunction((s) => new RegExp(s).test(document.querySelector('[data-test="toast"]')?.textContent ?? ''), re.source, { timeout: ms }).catch(() => {});
  return text(T(page, 'toast'));
};
const tabNames = () => page.$$eval('[data-test="plan-tab"]', (e) => e.map((x) => x.textContent.trim()));
const curriculumLine = () => text(page.locator('.status-strip + p'));

// ---------- USER-01j
await page.goto(`${SITE}/dashboard`); await page.waitForLoadState('networkidle');
await page.locator('aside a[href="/plans"], nav a[href="/plans"]').first().click();
await page.waitForURL(/\/plans\/[0-9a-f-]{36}/, { timeout: 20000 });
await T(page, 'status-strip').waitFor(); await page.waitForLoadState('networkidle');
const planUrl = page.url();
check('USER-01j', 'with no plan, Lộ trình creates "Kế hoạch mặc định" and opens it', (await text(page.locator('h1'))) === 'Kế hoạch mặc định' && (await tabNames()).join() === 'Kế hoạch mặc định', `h1 "${await text(page.locator('h1'))}", tabs ${JSON.stringify(await tabNames())}`);
check('USER-01j', 'the planner has no Save button', (await page.locator('button', { hasText: /^(Lưu|Save)$/ }).count()) === 0, `${await page.locator('button', { hasText: /^(Lưu|Save)$/ }).count()} such buttons`);
await addCourse(page, 'CS160'); await saved(page);
check('USER-01j', 'CS160 added with +; chip says Đã lưu', /Đã lưu/.test(await text(T(page, 'save-state'))) && /CS160/.test(await tiles()), `${await text(T(page, 'save-state'))}; ${await tiles()}`);
check('USER-01j', 'curriculum line before the change (note)', null, await curriculumLine());
// Settings: cohort 2024 -> 2025
await page.locator('a[href="/settings"]').first().click();
await T(page, 'study-form').waitFor({ timeout: 15000 });
const selects = page.locator('[data-test="study-form"] .ui-select');
log(`Settings before: program "${await text(selects.nth(0).locator('.ui-select-value'))}", cohort "${await text(selects.nth(1).locator('.ui-select-value'))}"`);
await selects.nth(1).locator('button[role=combobox]').click();
await selects.nth(1).locator('[role=option]', { hasText: '2025' }).click();
const [resp] = await Promise.all([
  page.waitForResponse((r) => r.request().method() === 'PUT' && /\/users\/me\/onboarding$/.test(r.url())),
  page.locator('[data-test="study-form"] button[type=submit]').click(),
]);
await sleep(500);
const after = await A.api('GET', '/users/me/onboarding');
check('USER-01j', 'Settings saves the cohort 2025 (PUT 200; the API then reads APCS 2025)', resp.status() === 200 && after.json?.cohort === 2025 && after.json?.program === 'APCS', `PUT ${resp.status()}; GET program ${after.json?.program}, cohort ${after.json?.cohort}`);
await page.locator('aside a[href="/plans"], nav a[href="/plans"]').first().click();
await page.waitForURL(/\/plans\/[0-9a-f-]{36}/, { timeout: 20000 });
await T(page, 'status-strip').waitFor(); await page.waitForLoadState('networkidle');
check('USER-01j', 'the same plan opens', page.url() === planUrl && (await text(page.locator('h1'))) === 'Kế hoạch mặc định', `same address: ${page.url() === planUrl}; h1 "${await text(page.locator('h1'))}"`);
check('USER-01j', 'the line under the status strip still says "CTĐT APCS2024"', (await curriculumLine()) === 'CTĐT APCS2024', await curriculumLine());
check('USER-01j', 'CS160 is still placed', /CS160/.test(await tiles()), await tiles());
// The course list holds APCS 2024's courses: compare with the two curricula read from the API.
const c24 = (await A.api('GET', '/programs/APCS/curricula/2024')).json;
const c25 = (await A.api('GET', '/programs/APCS/curricula/2025')).json;
const codes = (c) => new Set(c.requirementGroups.flatMap((g) => g.courses.map((x) => x.code)));
const s24 = codes(c24), s25 = codes(c25);
const pool = await page.$$eval('[data-test^="pool-"]:not([data-test^="pool-group"])', (els) => els.map((e) => e.getAttribute('data-test').slice(5)));
const expect24 = [...s24].filter((c) => c !== 'CS160').sort();
const only24 = [...s24].filter((c) => !s25.has(c)), only25 = [...s25].filter((c) => !s24.has(c));
check('USER-01j', 'the course list holds exactly APCS 2024\'s courses less CS160', JSON.stringify([...pool].sort()) === JSON.stringify(expect24), `${pool.length} courses listed; APCS2024 has ${s24.size}, APCS2025 ${s25.size}; only in 2024: ${only24.join(' ') || 'none'}; only in 2025: ${only25.join(' ') || 'none'}; 2025-only courses listed: ${pool.filter((c) => only25.includes(c)).join(' ') || 'none'}`);
const plan = await A.api('GET', `/plans/${planUrl.split('/').pop()}`);
check('USER-01j', 'API: the plan\'s curriculum.code is APCS2024', plan.json?.curriculum?.code === 'APCS2024', plan.json?.curriculum);
await shot(page, 'p-user-01j-plan-after-cohort-change.png');

// ---------- PLAN-01i
check('PLAN-01i', 'one tab per plan, the open plan\'s tab marked', (await tabNames()).length === 1 && (await page.locator('[data-test="plan-tab"][aria-current="page"]').count()) === 1, `${JSON.stringify(await tabNames())}; marked: ${await text(page.locator('[data-test="plan-tab"][aria-current="page"]'))}`);
check('PLAN-01i', 'with one plan there is no trash button', (await T(page, 'delete-plan').count()) === 0, `${await T(page, 'delete-plan').count()} trash buttons`);
await T(page, 'new-plan').click();
await page.locator('#plan-name').waitFor();
const body = await text(page.locator('#plan-name-body'));
check('PLAN-01i', 'the dialog names the open plan\'s curriculum (APCS 2024), not the 2025 cohort of Settings', body === 'Kế hoạch dùng CTĐT APCS 2024 và giữ nguyên CTĐT này kể cả khi bạn đổi chương trình sau này.', body);
await shot(page, 'p-plan-01i-new-plan-dialog.png');
await page.keyboard.press('Escape'); await sleep(300);
const made = await newPlan(page, 'Tabs 01i');
const t1 = await toast(/Đã tạo/);
check('PLAN-01i', '"Tabs 01i" opens at once with "Đã tạo Tabs 01i."', (await text(page.locator('h1'))) === 'Tabs 01i' && t1 === 'Đã tạo Tabs 01i.', `h1 "${await text(page.locator('h1'))}"; toast "${t1}"`);
await page.waitForFunction(() => document.querySelectorAll('[data-test="plan-tab"]').length === 2, null, { timeout: 8000 }).catch(() => {});
check('PLAN-01i', 'two tabs now, "Tabs 01i" marked, and its trash button shows', (await tabNames()).length === 2 && (await text(page.locator('[data-test="plan-tab"][aria-current="page"]'))) === 'Tabs 01i' && (await T(page, 'delete-plan').count()) === 1, `${JSON.stringify(await tabNames())}; marked "${await text(page.locator('[data-test="plan-tab"][aria-current="page"]'))}"; trash buttons ${await T(page, 'delete-plan').count()}`);
const newCur = (await A.api('GET', `/plans/${made.id}`)).json?.curriculum?.code;
check('PLAN-01i', 'the new plan is on APCS2024 (API and the line under the strip)', newCur === 'APCS2024' && (await curriculumLine()) === 'CTĐT APCS2024', `${newCur}; "${await curriculumLine()}"`);
await T(page, 'delete-plan').click();
await page.locator('#delete-plan-title').waitFor();
const title = await text(page.locator('#delete-plan-title')), dbody = await text(page.locator('#delete-plan-body'));
check('PLAN-01i', 'the trash button opens "Xóa kế hoạch này?" with its warning', title === 'Xóa kế hoạch này?' && dbody === 'Kế hoạch và mọi môn đã xếp trong đó sẽ bị xóa. Không thể hoàn tác.', `"${title}" / "${dbody}" / names "${await text(T(page, 'delete-name'))}"`);
await page.locator('button', { hasText: 'Giữ lại' }).click(); await sleep(400);
const kept = (await A.api('GET', `/plans/${made.id}`)).status;
check('PLAN-01i', 'Giữ lại keeps the plan', kept === 200 && (await tabNames()).includes('Tabs 01i') && (await text(page.locator('h1'))) === 'Tabs 01i', `GET plan ${kept}; tabs ${JSON.stringify(await tabNames())}`);
await T(page, 'delete-plan').click();
await T(page, 'confirm-delete').waitFor();
check('PLAN-01i', 'the confirm button reads Xóa', (await text(T(page, 'confirm-delete'))) === 'Xóa', await text(T(page, 'confirm-delete')));
await T(page, 'confirm-delete').click();
const t2 = await toast(/Đã xóa/);
await page.waitForFunction(() => document.querySelector('h1')?.textContent?.trim() === 'Kế hoạch mặc định', null, { timeout: 15000 }).catch(() => {});
await page.waitForLoadState('networkidle');
const gone = (await A.api('GET', `/plans/${made.id}`)).status;
check('PLAN-01i', 'Xóa deletes it, says "Đã xóa Tabs 01i." and opens the other plan', t2 === 'Đã xóa Tabs 01i.' && gone === 404 && page.url() === planUrl, `toast "${t2}"; GET deleted plan ${gone}; now open: "${await text(page.locator('h1'))}"; tabs ${JSON.stringify(await tabNames())}`);
check('PLAN-01i', 'back to one plan: no trash button again', (await T(page, 'delete-plan').count()) === 0, `${await T(page, 'delete-plan').count()} trash buttons`);

await A.keep();
await b.close();
summary();
