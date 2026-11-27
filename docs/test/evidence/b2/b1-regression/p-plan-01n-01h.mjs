// PLAN-01n (the Taken strip) and the second part of PLAN-01h (status strip with the completion fixture),
// as the stand-in for b1-06: b1-run-<run>-p06@example.com, APCS 2024, completion fixture saved.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { T, board, browser, call, check, email, log, openPlans, setLang, shot, signedIn, summary, text, tokenFor } from './p-lib.mjs';

const FIXTURE = new URL('../../../../../src/backend/test/fixtures/apcs-2024-completion.json', import.meta.url);
const bytes = readFileSync(FIXTURE);
const sha = createHash('sha256').update(bytes).digest('hex');
check('setup', 'fixture SHA-256 is d0a0493f…facde', sha === 'd0a0493f2fe62da8b070d853392100a9f47babac789f2c099ed69ccfdf3facde', sha);
const fixture = JSON.parse(bytes);

const mail = email('06');
const token = await tokenFor(mail);
const ob = await call(token, 'PUT', '/users/me/onboarding', { program: 'APCS', cohort: 2024, targetGraduationTerm: null, creditsPerTerm: null, internshipTerm: null, finished: true });
check('setup', 'onboarding APCS 2024 saved (200)', ob.status === 200, ob.status);
const put = await call(token, 'PUT', '/users/me/transcript', fixture);
const got = await call(token, 'GET', '/users/me/transcript');
check('setup', 'fixture saved: PUT 200 and 45 rows read back', put.status === 200 && got.json?.rows?.length === 45, `${put.status}, ${got.json?.rows?.length} rows`);
const audit = (await call(token, 'GET', '/users/me/audit')).json;
check('setup', 'audit: graduation done, accumulated 172, towardTotal 164', audit?.graduation?.status === 'done' && audit?.credits?.accumulated === 172 && audit?.credits?.towardTotal === 164, { graduation: audit?.graduation?.status, credits: audit?.credits });
// What the six listed terms hold, worked out from the fixture itself (not from the app).
const before = (r) => r.term.year < 2026;
const listed = fixture.rows.filter(before);
const later = fixture.rows.filter((r) => !before(r));
log(`fixture: ${listed.length} rows in 2024-1..2025-3 with ${listed.reduce((s, r) => s + r.credits, 0)} credits; ${later.length} rows from 2026-1 on (${later.map((r) => r.courseCode).join(' ')})`);

const b = await browser();
const { page, keep } = await signedIn(b, mail);
await openPlans(page);
await T(page, 'past').waitFor({ timeout: 15000 });

for (const lang of ['vi', 'en']) {
  if (lang === 'en') { await setLang(page, 'en'); await T(page, 'past').waitFor({ timeout: 15000 }); }
  const span = await text(page.locator('[data-test="past"] .trow-l small'));
  const figure = await text(page.locator('[data-test="past"] .tload'));
  const tags = await page.$$eval('[data-test="past"] .codes button', (els) => els.map((e) => e.textContent.trim()));
  check('PLAN-01n', `${lang}: span of the Taken strip`, lang === 'vi' ? span === '6 học kỳ · HK1 2024–2025 → HK3 2025–2026' : span === '6 terms · Term 1 2024–2025 → Term 3 2025–2026', span);
  check('PLAN-01n', `${lang}: credit figure is for the six listed terms (102)`, /^102\b/.test(figure), figure);
  const lateTags = tags.filter((c) => later.some((r) => r.courseCode === c));
  check('PLAN-01n', `${lang}: no tag for a course of HK1 2026–2027 or later`, lateTags.length === 0, `${tags.length} tags; from later terms: ${lateTags.join(' ') || 'none'}`);
  check('PLAN-01n', `${lang}: no tag for CS468 (2027-3)`, !tags.includes('CS468'), tags.includes('CS468') ? 'CS468 tag shown' : 'no CS468 tag');
  // PLAN-01h, second part
  const small = await text(page.locator('[data-test="estimate"] small'));
  const large = await text(page.locator('[data-test="estimate"] b'));
  const bad = await T(page, 'estimate').evaluate((e) => e.classList.contains('bad'));
  const icon = await page.locator('[data-test="estimate"] .est-ic').evaluate((e) => ({ bg: getComputedStyle(e).backgroundColor, html: e.innerHTML.slice(0, 200) }));
  check('PLAN-01h', `${lang}: as the fixture account the large line says every checkable requirement is met`, large === (lang === 'vi' ? 'Đủ các yêu cầu kiểm tra được' : 'Every requirement that can be checked is met'), large);
  check('PLAN-01h', `${lang}: icon is the green cap (not the red state)`, !bad, { bad, bg: icon.bg, icon: /cap/.test(icon.html) ? 'cap' : icon.html });
  check('PLAN-01h', `${lang}: small line (note)`, null, small);
  const strip = await text(T(page, 'status-strip'));
  check('PLAN-01h', `${lang}: the strip names no graduation term and never says "can graduate"`, !/HK\d|Term \d|20\d\d|có thể tốt nghiệp|can graduate/i.test(strip), strip);
  if (lang === 'vi') await shot(page, 'p-plan-01n-strip-vi.png');
}
await setLang(page, 'vi');
await T(page, 'past').waitFor();
log('board rows:', JSON.stringify((await board(page)).map((r) => `${r.name} [${r.load}] ${r.tiles.join(',')}`)));
const first = page.locator('[data-test="past"] .codes button').first();
const code = (await first.textContent()).trim();
await first.click();
await page.waitForURL(/\/explorer/, { timeout: 10000 }).catch(() => {});
check('PLAN-01n', `a tag opens the explorer at that course (/explorer?course=${code})`, new URL(page.url()).pathname === '/explorer' && new URL(page.url()).searchParams.get('course') === code, page.url().replace(/^https:\/\/[^/]+/, ''));
await keep();
await b.close();
summary();
