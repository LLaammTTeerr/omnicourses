// TC-B1-USER-01w (as reworded in cases 0.8, #129) and USER-01x, on staging, for the B1 regression.
// In B1 they ran by hand on production (w failed as then written) and through the API locally. Here: a fresh account
// a06 of this run as S1, with a02 of this run as S2. Two browser contexts are browsers A and B. Prints statuses,
// booleans, row counts and the deadline only: never a token, a password or a hash.
import { launch, newPage, BASE, email, screenSignIn, pageToken, api, apiSignUp, apiOnboard, check, log } from './a-lib.mjs';

const S1 = email(process.env.S1_NN ?? '06'); // 07 on the second run: a06 is the first run's S1
const S2 = email('02');
const ZZ = [
  { courseCode: 'ZZ101', courseName: 'Synthetic Course One', credits: 4, result: 'graded', grade: 8.5, term: { year: 2024, number: 1 } },
  { courseCode: 'ZZ102', courseName: 'Synthetic Course Two', credits: 2, result: 'pass', grade: null, term: { year: 2024, number: 3 } },
  { courseCode: 'ZZ103', courseName: 'Synthetic Course Three', credits: 3, result: 'in_progress', grade: null, term: { year: 2025, number: 1 } },
];
const counts = (x) => Object.fromEntries(Object.entries(x.tables).map(([k, v]) => [k, v.length]));
const withoutVolatile = (x) => {
  const { exportedAt, ...rest } = x;
  const { updated_at, updatedAt, ...user } = rest.user;
  const { sessions, ...tables } = rest.tables;
  return JSON.stringify({ ...rest, user, tables });
};

log('---- Prepare S1 (a06): onboarding with three goals, the S1 transcript, one plan');
const token0 = await apiSignUp(S1);
log('onboarding PUT', (await apiOnboard(token0, 2024, { targetGraduationTerm: { year: 2027, number: 2 }, creditsPerTerm: 18, internshipTerm: { year: 2027, number: 1 } })).status);
log('transcript PUT', (await api('PUT', '/users/me/transcript', { token: token0, body: { rows: ZZ } })).status);
log('plan POST', (await api('POST', '/plans', { token: token0, body: { name: 'Standard 4-Year', programCode: 'APCS', cohortYear: 2024 } })).status);
const e1 = (await api('GET', '/users/me/export', { token: token0 })).json;
log('E1 tables', JSON.stringify(counts(e1)));

const browser = await launch();
const A = await newPage(browser);
const B = await newPage(browser);
check('USER-01w', 'S1 signs in on browser A', (await screenSignIn(A, S1)).status() === 200);
check('USER-01w', 'S1 signs in on browser B', (await screenSignIn(B, S1)).status() === 200);

log('---- USER-01w: delete in A');
await A.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
await A.locator('button.btn.sm.danger').click();
const body = await A.locator('#delete-body').innerText();
const passwordFirst = await A.evaluate(() => {
  const b = document.querySelector('#delete-body');
  const p = document.querySelector('#delete-password');
  return Boolean(b && p && b.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_FOLLOWING);
});
check('USER-01w', 'the dialog explains the 30-day grace period before asking for the password', /30 ngày/.test(body) && passwordFirst, body);
await A.fill('#delete-password', 'correct horse battery');
const sentAt = Date.now();
const [del] = await Promise.all([A.waitForResponse((r) => r.url().endsWith('/api/users/me') && r.request().method() === 'DELETE'), A.locator('form.delete-form button[type=submit]').click()]);
const delJson = await del.json();
const graceMinutes = (Date.parse(delJson.purgeAfter) - sentAt) / 60000;
check('USER-01w', 'the API answers 202 with purgeAfter 30 days after the request, to the minute', del.status() === 202 && Math.abs(graceMinutes - 30 * 24 * 60) <= 1, { status: del.status(), purgeAfter: delJson.purgeAfter, minutesAfterRequest: Math.round(graceMinutes * 10) / 10 });
await A.waitForURL((u) => new URL(u).pathname === '/', { timeout: 15000 }).catch(() => {});
const toast = A.locator('[data-test="toast"]');
await toast.filter({ hasText: /\S/ }).waitFor({ timeout: 10000 }).catch(() => {});
const toastText = (await toast.innerText()).trim();
const expectedParts = await A.evaluate((iso) => {
  const d = new Date(iso);
  const two = (n) => String(n).padStart(2, '0');
  return { hm: `${two(d.getHours())}:${two(d.getMinutes())}`, year: String(d.getFullYear()), day: String(d.getDate()) };
}, delJson.purgeAfter);
const toastOk = toastText.startsWith('Tài khoản sẽ bị xóa vĩnh viễn sau ') && toastText.endsWith('. Đăng nhập lại trước đó để hủy.') && toastText.includes(expectedParts.hm) && toastText.includes(expectedParts.year) && toastText.includes(expectedParts.day);
const signedOut = await A.evaluate(() => sessionStorage.getItem('omnicourse.session') === null);
check('USER-01w', 'A shows the public home page /, signed out, with the deletion toast naming the purgeAfter time', new URL(A.url()).pathname === '/' && toastOk && signedOut, { url: new URL(A.url()).pathname, toast: toastText, expectedTimeParts: expectedParts, tokenGone: signedOut });

log('---- USER-01w: then use B');
const bApi = [];
B.on('response', (r) => r.url().includes('/api/') && bApi.push(`${r.request().method()} ${new URL(r.url()).pathname} ${r.status()}`));
await B.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
await B.waitForURL(/sign-in/, { timeout: 15000 }).catch(() => {});
check("USER-01w", "B's next request gets 401 and B shows the sign-in screen", bApi[0]?.endsWith(' 401') && /\/sign-in/.test(B.url()), { firstApi: bApi.slice(0, 3), url: new URL(B.url()).pathname + new URL(B.url()).search });

const again = await api('POST', '/auth/sign-up', { body: { email: S1, password: 'correct horse battery', displayName: 'Test Student', acceptedTerms: true } });
check('USER-01w', 'signing up again with the same email: 409', again.status === 409, again.status);
const s2 = await api('POST', '/auth/sign-in', { body: { email: S2, password: 'correct horse battery' } });
const s2me = await api('GET', '/users/me', { token: s2.json?.token });
check('USER-01w', 'S2 is still signed in: GET /api/users/me 200', s2me.status === 200, s2me.status);

log('---- USER-01x: sign in again before the deadline');
const C = await newPage(browser);
const back = await screenSignIn(C, S1);
const backJson = await back.json();
await C.waitForLoadState('networkidle');
const restoredToast = (await C.locator('[data-test="toast"]').innerText().catch(() => '')).trim();
check('USER-01x', 'sign-in 200 with accountRestored true, and the screen says the account was restored', back.status() === 200 && backJson.accountRestored === true && restoredToast.startsWith('Chào mừng trở lại.'), { status: back.status(), accountRestored: backJson.accountRestored, toast: restoredToast });
const e2 = (await api('GET', '/users/me/export', { token: await pageToken(C) })).json;
const u = e2.user;
check('USER-01x', 'deletion_requested_at and purge_after are in the export user row and null again', 'deletion_requested_at' in u && 'purge_after' in u && u.deletion_requested_at === null && u.purge_after === null, { deletion_requested_at: u.deletion_requested_at, purge_after: u.purge_after });
check('USER-01x', 'E2 matches E1 except exportedAt, user.updated_at and the sessions rows', withoutVolatile(e1) === withoutVolatile(e2), { e1: counts(e1), e2: counts(e2) });
await browser.close();
