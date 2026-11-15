// PLAN-01m: a rate-limited save. An empty plan "Retry 01m" as the S1 stand-in b1-run-<run>-p01@example.com.
// Deviation from the case: the 120 saves do not sign in again (the sign-in limit is shared with other workers of this
// run). They are sent from Node on this machine with the session token the browser page already holds, so the
// browser and the script share both the address and the session.
import { API, T, board, browser, check, email, log, newPlan, openPlans, shot, signedIn, sleep, summary, text } from './p-lib.mjs';

const b = await browser();
const A = await signedIn(b, email('01'));
const page = A.page;
await openPlans(page);
const { id } = await newPlan(page, process.env.PLAN_NAME ?? 'Retry 01m');
const tiles = async () => (await board(page)).map((r) => `${r.name}: ${r.tiles.join(' ') || '-'}`).join(' | ');
log(`plan "Retry 01m" made, board: ${await tiles()}; waiting 65 s so no earlier save counts toward the minute`);
await sleep(65000);

// FROM=node: the 120 saves go out from Node on this machine (first run: no 429 followed, so staging counted Node
// and the browser as different addresses, e.g. IPv4 and IPv6). FROM=page (default): the same 120 requests are sent
// with fetch from the browser page itself, so they surely share the browser's address.
const FROM = process.env.FROM ?? 'page';
// COUNT: 120 as the case says. The second run showed x-ratelimit-remaining 1 after 120 saves and the 121st request
// answered 200, so a third run sends saves until the first 429 (COUNT=until429, at most 130) and then adds the course.
const COUNT = process.env.COUNT ?? '120';
const MAX = COUNT === 'until429' ? 130 : Number(COUNT);
let counts = {};
let remaining = [];
const s0 = Date.now();
if (FROM === 'node') {
  const token = await page.evaluate(() => sessionStorage.getItem('omnicourse.session'));
  for (let i = 0; i < MAX; i++) {
    const r = await fetch(`${API}/plans/${id}/placements`, { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{"terms":[]}' });
    await r.arrayBuffer();
    counts[r.status] = (counts[r.status] ?? 0) + 1;
    remaining.push(r.headers.get('x-ratelimit-remaining'));
  }
} else {
  ({ counts, remaining } = await page.evaluate(async ([planId, max, stopAt429]) => {
    const counts = {}; const remaining = [];
    for (let i = 0; i < max; i++) {
      const r = await fetch(`/api/plans/${planId}/placements`, { method: 'PUT', headers: { Authorization: `Bearer ${sessionStorage.getItem('omnicourse.session')}`, 'Content-Type': 'application/json' }, body: '{"terms":[]}' });
      await r.arrayBuffer();
      counts[r.status] = (counts[r.status] ?? 0) + 1;
      remaining.push(`${r.status}:${r.headers.get('x-ratelimit-remaining') ?? `retry-after ${r.headers.get('retry-after')}`}`);
      if (stopAt429 && r.status === 429) break;
    }
    return { counts, remaining };
  }, [id, MAX, COUNT === 'until429']));
}
log(`every answer as status:x-ratelimit-remaining, in order: ${remaining.join(' ')}`);
log(`saves sent from ${FROM}; x-ratelimit-remaining of the first, 60th and last answer: ${remaining[0]}, ${remaining[59]}, ${remaining[119]}`);
const scriptMs = Date.now() - s0;
log(`script: 120 PUT …/placements of the empty board in ${(scriptMs / 1000).toFixed(1)} s; status counts ${JSON.stringify(counts)}`);
check('PLAN-01m', COUNT === 'until429' ? 'saves until the first 429 (note: how many were answered 200)' : 'the script prints 120 200', COUNT === 'until429' ? null : counts[200] === 120, counts);

let t0 = 0;
const puts = [];
page.on('response', (r) => { if (t0 === 0) return; if (r.request().method() === 'PUT' && /\/placements$/.test(r.url())) { puts.push({ at: ((Date.now() - t0) / 1000).toFixed(1), status: r.status() }); log(`browser PUT …/placements answered ${r.status()} at +${((Date.now() - t0) / 1000).toFixed(1)} s`); } });
t0 = Date.now();
await T(page, `add-${process.env.COURSE ?? 'CS160'}`).click();
log(`CS160 added in the browser ${((t0 - s0 - scriptMs) / 1000).toFixed(1)} s after the script ended`);
const seen = [];
let last = '';
let shotTaken = false;
while (Date.now() - t0 < 30000) {
  const chip = await text(T(page, 'save-state'));
  const err = (await T(page, 'save-error').count()) ? await text(T(page, 'save-error')) : '';
  const now = `chip "${chip}" | error "${err}" | board ${await tiles()}`;
  if (now !== last) { seen.push({ at: (Date.now() - t0) / 1000, now }); log(`+${((Date.now() - t0) / 1000).toFixed(1)} s ${now}`); last = now; }
  if (!shotTaken && puts.length >= 1 && Date.now() - t0 > 3000) { await shot(page, 'p-plan-01m-saving-after-429.png'); shotTaken = true; }
  await sleep(250);
}
const chip = await text(T(page, 'save-state'));
const err = (await T(page, 'save-error').count()) ? await text(T(page, 'save-error')) : '';
const first429 = puts.find((p) => p.status === 429);
check('PLAN-01m', 'the browser\'s PUT is answered 429', !!first429, puts);
const gaps = puts.slice(1).map((p, i) => (p.at - puts[i].at).toFixed(1));
check('PLAN-01m', 'it is sent again after 2, 5 and 10 seconds', gaps.length >= 1 && gaps.every((g, i) => Math.abs(g - [2, 5, 10][i]) < 1), `PUTs ${JSON.stringify(puts)}; gaps ${gaps.join(', ')} s`);
// The board never goes back at the first 429: CS160 stays until the last resend has answered.
const lastPutAt = Number(puts.at(-1)?.at ?? 0);
const wentBackEarly = seen.some((s) => s.at < lastPutAt - 0.3 && !new RegExp(process.env.COURSE ?? 'CS160').test(s.now));
check('PLAN-01m', 'CS160 stays on the board and the chip says Đang lưu… while the save is resent; the board never goes back at the first 429', !wentBackEarly && seen.some((s) => /chip "Đang lưu…"/.test(s.now) && new RegExp(process.env.COURSE ?? 'CS160').test(s.now)), seen.map((s) => `+${s.at.toFixed(1)} s ${s.now}`));
const savingFor = (() => { const a = seen.find((s) => /Đang lưu/.test(s.now)); const z = seen.find((s) => s.at > (a?.at ?? 0) && !/Đang lưu/.test(s.now)); return a && z ? (z.at - a.at).toFixed(1) : null; })();
check('PLAN-01m', 'how long the chip said Đang lưu… (note; the case says about 17 s)', null, `${savingFor} s`);
const ending = puts.at(-1)?.status === 200 ? 'saved' : 'went back';
if (ending === 'saved') check('PLAN-01m', 'ending 1: a resend landed after the minute; chip Đã lưu', chip === 'Đã lưu' && new RegExp(process.env.COURSE ?? 'CS160').test(await tiles()), `chip "${chip}"; ${await tiles()}`);
else check('PLAN-01m', 'ending 2: the last resend also got 429; the board goes back, with the message and chip Chưa lưu', err === 'Chưa lưu được thay đổi. Kế hoạch đã trở về lần lưu gần nhất.' && chip === 'Chưa lưu' && !new RegExp(process.env.COURSE ?? 'CS160').test(await tiles()), `error "${err}"; chip "${chip}"; ${await tiles()}`);
await shot(page, 'p-plan-01m-end.png');
await page.reload(); await T(page, 'status-strip').waitFor(); await page.waitForLoadState('networkidle');
const api = await A.api('GET', `/plans/${id}`);
const savedCodes = api.json?.terms?.flatMap((t) => t.placements.map((p) => p.courseCode)) ?? [];
check('PLAN-01m', `after a reload CS160 is ${ending === 'saved' ? 'still there' : 'not saved'} (screen and API agree with the ending)`, (ending === 'saved') === new RegExp(process.env.COURSE ?? 'CS160').test(await tiles()) && (ending === 'saved') === savedCodes.includes(process.env.COURSE ?? 'CS160'), `ending: ${ending}; screen ${await tiles()}; API placements [${savedCodes}] (GET ${api.status})`);
await A.keep();
await b.close();
summary();
