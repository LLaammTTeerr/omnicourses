// TC-B2-NOTIF-01a–i on staging (docs/test/test-cases-b2.md §8). Synthetic b2- accounts only.
//   node a-notif-01.mjs main      a–h, then i(1)–(3) (waits 11 minutes)
//   node a-notif-01.mjs i5        i(5), after the bot has run i(4)'s query
//   node a-notif-01.mjs cleanup   i's clean-up (every test date but E-d)
//   node a-notif-01.mjs d2        d(2) on D+3, then deletes E-d
// The IDs of the test dates are kept between the parts in a state file (STATE_DIR). Never prints a token.
import { isDeepStrictEqual } from 'node:util';
import { BASE, block, launch, newPage, pageToken, settle, signIn, where, mark, sent, fmt } from './b-lib.mjs';
import { account, call, check, deleteAccount, failureCount, ID, log, PROGRAM, signInApi, sleep, state, T_A, T_B, vnDate } from './c-lib.mjs';

const part = process.argv[2] ?? 'main';
const st = state('notif-01');
const S = st.data;
const EMAIL = { N1: 'b2-s9@example.com', N2: 'b2-s10@example.com', N3: 'b2-s11@example.com', A1: 'b2-a1@example.com', A2: 'b2-a2@example.com' };
const D = S.D ?? vnDate(0);
const day = (n) => new Date(Date.parse(`${D}T00:00:00Z`) + n * 86400_000).toISOString().slice(0, 10);
log(`a-notif-01 ${part}; D = ${D} (Vietnam)`);

const quietList = (json) => (json?.notifications ? `{${json.notifications.length} notifications, nextBefore ${json.nextBefore ? 'set' : 'null'}}` : JSON.stringify(json));
/** "As N, read": GET /api/notifications, following nextBefore so that nothing is missed. */
async function read(token, query = '') {
  const out = [];
  let before = null;
  for (let i = 0; i < 20; i++) {
    const q = [query, before && `before=${before}`].filter(Boolean).join('&');
    const r = await call('GET', `/notifications${q ? `?${q}` : ''}`, { token, show: quietList });
    if (r.status !== 200) return { status: r.status, list: out };
    out.push(...r.json.notifications);
    if (!r.json.nextBefore) break;
    before = r.json.nextBefore;
  }
  return { status: 200, list: out };
}
const of = (list, eventId) => list.filter((n) => n.event?.id === eventId);
const brief = (list) => list.map((n) => ({ kind: n.kind, startsOn: n.event?.startsOn ?? null, readAt: n.readAt, createdAt: n.createdAt, id: n.id }));
const unread = async (token) => (await call('GET', '/notifications/unread-count', { token })).json?.unread;
const testDate = (x, kind, from, to) => ({ academicYear: 2026, kind, startsOn: from, endsOn: to, title: `Ngày thử NOTIF-01${x}`, titleEn: `NOTIF-01${x} test date` });
async function enter(token, program, x, kind, from, to) {
  const r = await call('POST', `/admin/programs/${program}/calendar-events`, { token, body: testDate(x, kind, from, to) });
  if (r.status === 201) { S[`E-${x}`] = r.json.id; S[`P-${x}`] = program; st.save(); console.log(`  E-${x} = ${r.json.id}`); }
  return r;
}
const events = (token, x) => `/admin/programs/${S[`P-${x}`]}/calendar-events/${S[`E-${x}`]}`;

if (part === 'main') {
  S.D = D; st.save();
  console.log('--- before the run');
  const a1 = (await signInApi(EMAIL.A1)).token;
  const cal = await call('GET', '/academic-calendar?program=APCS', { token: a1, quiet: true });
  const near = cal.json.events.filter((e) => e.startsOn === D || e.startsOn === day(7));
  console.log(`  APCS calendar: ${cal.json.events.length} dates; starting on D or D+7: ${JSON.stringify(near.map((e) => [e.kind, e.startsOn, e.endsOn, e.title]))}`);
  const leftovers = cal.json.events.filter((e) => e.title.startsWith('Ngày thử NOTIF-01'));
  check('NOTIF-01', 'no NOTIF-01 test date from an earlier run in APCS', leftovers.length === 0, leftovers.map((e) => e.title));

  console.log('--- NOTIF-01a');
  const n1 = await account(EMAIL.N1);
  S.N1 = n1.created; st.save();
  const N1 = n1.token;
  let r = await read(N1);
  const count0 = await unread(N1);
  check('NOTIF-01a', '(1) 200, and the unread count equals the unread notifications of the list; no notification of a test date',
    r.status === 200 && count0 === r.list.filter((n) => n.readAt === null).length && !r.list.some((n) => n.event?.title?.startsWith('Ngày thử NOTIF-01')), { listed: r.list.length, count0, kinds: r.list.map((n) => [n.kind, n.event?.startsOn]) });
  const zero = '00000000-0000-4000-8000-000000000000';
  const anon = [await call('GET', '/notifications'), await call('GET', '/notifications/unread-count'), await call('POST', '/notifications/read-all'), await call('POST', `/notifications/${zero}/read`)];
  check('NOTIF-01a', '(2) signed out, each of the four routes 401', anon.every((x) => x.status === 401), anon.map((x) => x.status));
  const bad = [];
  for (const q of ['unread=yes', 'kind=add_drop', 'kind=term_start&kind=term_start', 'limit=0', 'limit=101', 'limit=1.5', 'limit=1e2', 'before=abc']) bad.push((await call('GET', `/notifications?${q}`, { token: N1 })).status);
  check('NOTIF-01a', '(3) each query 400', bad.every((s) => s === 400), bad);
  r = await call('GET', `/notifications?before=${zero}`, { token: N1 });
  check('NOTIF-01a', '(4) 404 not_found "No notification with this ID"', r.status === 404 && r.json?.code === 'not_found' && r.json?.message === 'No notification with this ID', r.json);
  const r5 = [await call('POST', `/notifications/${zero}/read`, { token: N1 }), await call('POST', '/notifications/not-an-id/read', { token: N1 })];
  check('NOTIF-01a', '(5) each 404 not_found "No notification with this ID"', r5.every((x) => x.status === 404 && x.json?.code === 'not_found' && x.json?.message === 'No notification with this ID'), r5.map((x) => x.json));

  console.log('--- NOTIF-01b');
  r = await enter(a1, PROGRAM.APCS, 'b', 'registration', day(7), day(13));
  check('NOTIF-01b', 'the date answers 201', r.status === 201);
  let list = (await read(N1)).list;
  const nb = of(list, S['E-b']);
  const KEYS = ['createdAt', 'event', 'id', 'kind', 'links', 'readAt'];
  const want = { id: S['E-b'], programCode: 'APCS', academicYear: 2026, term: null, startsOn: day(7), endsOn: day(13), title: 'Ngày thử NOTIF-01b', titleEn: 'NOTIF-01b test date' };
  check('NOTIF-01b', 'exactly one notification of E-b at once: registration_soon, readAt null, links [calendar, planner], the event as entered, exactly the six keys',
    nb.length === 1 && nb[0].kind === 'registration_soon' && nb[0].readAt === null && isDeepStrictEqual(nb[0].links, ['calendar', 'planner']) && isDeepStrictEqual(nb[0].event, want) && isDeepStrictEqual(Object.keys(nb[0]).sort(), KEYS), nb);
  const count1 = await unread(N1);
  check('NOTIF-01b', 'the unread count is one more than in NOTIF-01a', count1 === count0 + 1, { count0, count1 });
  list = (await read(N1)).list;
  check('NOTIF-01b', 'the second read still has exactly one: no repeat', of(list, S['E-b']).length === 1, brief(of(list, S['E-b'])));

  console.log('--- NOTIF-01c');
  const rc = [await enter(a1, PROGRAM.APCS, 'c', 'registration', D, day(6)), await enter(a1, PROGRAM.APCS, 'c2', 'term_start', D, D), await enter(a1, PROGRAM.APCS, 'c3', 'add_drop', D, day(3)), await enter(a1, PROGRAM.APCS, 'c4', 'exam_period', D, day(10))];
  check('NOTIF-01c', 'each date 201', rc.every((x) => x.status === 201), rc.map((x) => x.status));
  list = (await read(N1)).list;
  const nc = of(list, S['E-c']), nc2 = of(list, S['E-c2']);
  check('NOTIF-01c', 'E-c: exactly one, registration_open, links [calendar, planner], no registration_soon',
    nc.length === 1 && nc[0].kind === 'registration_open' && isDeepStrictEqual(nc[0].links, ['calendar', 'planner']), brief(nc));
  check('NOTIF-01c', 'E-c2: exactly one, term_start, links [calendar]', nc2.length === 1 && nc2[0].kind === 'term_start' && isDeepStrictEqual(nc2[0].links, ['calendar']), brief(nc2));
  check('NOTIF-01c', 'E-c3 (add_drop) and E-c4 (exam_period): none', of(list, S['E-c3']).length === 0 && of(list, S['E-c4']).length === 0);

  console.log('--- NOTIF-01d (1)');
  r = await enter(a1, PROGRAM.APCS, 'd', 'registration', day(3), day(5));
  list = (await read(N1)).list;
  check('NOTIF-01d', '(1) 201, and no notification of E-d', r.status === 201 && of(list, S['E-d']).length === 0, brief(of(list, S['E-d'])));

  console.log('--- NOTIF-01e');
  const n2 = await account(EMAIL.N2, { onboard: false });
  const N2 = n2.token;
  r = await call('PUT', '/users/me/onboarding', { token: N2, body: { program: 'APCS', cohort: 2024, targetGraduationTerm: null, creditsPerTerm: null, internshipTerm: null, finished: false } });
  let l2 = (await read(N2)).list;
  check('NOTIF-01e', '(1) onboarding 200; N2 has exactly one of E-b (registration_soon), E-c (registration_open) and E-c2 (term_start), none of E-c3, E-c4, E-d',
    r.status === 200 && isDeepStrictEqual(of(l2, S['E-b']).map((n) => n.kind), ['registration_soon']) && isDeepStrictEqual(of(l2, S['E-c']).map((n) => n.kind), ['registration_open']) && isDeepStrictEqual(of(l2, S['E-c2']).map((n) => n.kind), ['term_start'])
      && ['c3', 'c4', 'd'].every((x) => of(l2, S[`E-${x}`]).length === 0), { b: brief(of(l2, S['E-b'])), c: brief(of(l2, S['E-c'])), c2: brief(of(l2, S['E-c2'])) });
  const a2 = (await signInApi(EMAIL.A2)).token;
  r = await enter(a2, PROGRAM.KHMT, 'e', 'registration', D, day(6));
  list = (await read(N1)).list;
  l2 = (await read(N2)).list;
  check('NOTIF-01e', '(2) 201; neither N1 nor N2 has a notification of E-e, and none of either has programCode CNTT-TCTA-KHMT',
    r.status === 201 && of(list, S['E-e']).length === 0 && of(l2, S['E-e']).length === 0 && ![...list, ...l2].some((n) => n.event?.programCode === 'CNTT-TCTA-KHMT'), { n1: of(list, S['E-e']).length, n2: of(l2, S['E-e']).length });

  console.log('--- NOTIF-01f');
  list = (await read(N1)).list;
  const kept = { b: of(list, S['E-b']), c: of(list, S['E-c']), c2: of(list, S['E-c2']) };
  console.log(`  kept: ${JSON.stringify({ b: brief(kept.b), c: brief(kept.c), c2: brief(kept.c2) })}`);
  r = await call('PATCH', events(a1, 'c'), { token: a1, body: { startsOn: day(1), endsOn: day(6) } });
  list = (await read(N1)).list;
  check('NOTIF-01f', '(1) 200, nothing new for E-c; its notification still shows startsOn D', r.status === 200 && isDeepStrictEqual(of(list, S['E-c']), kept.c) && of(list, S['E-c'])[0]?.event.startsOn === D, brief(of(list, S['E-c'])));
  r = await call('PATCH', events(a1, 'c'), { token: a1, body: { startsOn: day(7), endsOn: day(13) } });
  list = (await read(N1)).list;
  const c2nd = of(list, S['E-c']);
  const soonC = c2nd.filter((n) => n.kind === 'registration_soon');
  const openC = c2nd.filter((n) => n.kind === 'registration_open');
  check('NOTIF-01f', '(2) 200; one new registration_soon of E-c with startsOn D+7; the registration_open keeps startsOn D; no second registration_open',
    r.status === 200 && c2nd.length === 2 && soonC.length === 1 && soonC[0].event.startsOn === day(7) && openC.length === 1 && isDeepStrictEqual(openC[0], kept.c[0]), brief(c2nd));
  r = await call('PATCH', events(a1, 'c2'), { token: a1, body: { kind: 'registration' } });
  list = (await read(N1)).list;
  const c2s = of(list, S['E-c2']);
  check('NOTIF-01f', '(3) 200; one new registration_open of E-c2; its term_start stays',
    r.status === 200 && c2s.length === 2 && c2s.filter((n) => n.kind === 'registration_open').length === 1 && isDeepStrictEqual(c2s.find((n) => n.kind === 'term_start'), kept.c2[0]), brief(c2s));
  r = await call('DELETE', events(a1, 'b'), { token: a1 });
  list = (await read(N1)).list;
  const cal2 = await call('GET', '/academic-calendar?program=APCS', { token: a1, quiet: true });
  check('NOTIF-01f', '(4) 204; N1\'s registration_soon of E-b is unchanged (event, createdAt, readAt); the calendar no longer lists E-b',
    r.status === 204 && isDeepStrictEqual(of(list, S['E-b']), kept.b) && !cal2.json.events.some((e) => e.id === S['E-b']), brief(of(list, S['E-b'])));
  S['E-b deleted'] = r.status === 204; st.save();

  console.log('--- NOTIF-01g (API)');
  const tc = async () => (await read(N1, 'kind=transcript_changed')).list;
  const save = async (body) => call('PUT', '/users/me/transcript', { token: N1, body, quiet: true });
  const s1 = await save(T_A); const g1 = await tc();
  const s2 = await save(T_A); const g2 = await tc();
  const s3 = await save({ rows: [...T_A.rows].reverse() }); const g3 = await tc();
  check('NOTIF-01g', '(1)–(3) each 200, and no transcript_changed', [s1, s2, s3].every((x) => x.status === 200) && g1.length === 0 && g2.length === 0 && g3.length === 0, [g1.length, g2.length, g3.length]);
  const s4 = await save(T_B);
  const raw4 = await call('GET', '/notifications?kind=transcript_changed', { token: N1, quiet: true });
  const g4 = raw4.json.notifications;
  check('NOTIF-01g', '(4) 200, exactly one: event null, links [audit]; no CS160, PH211, 6.5 or 8.5 in the answer',
    s4.status === 200 && g4.length === 1 && g4[0].event === null && isDeepStrictEqual(g4[0].links, ['audit']) && !/CS160|PH211|6\.5|8\.5/.test(raw4.text), raw4.text);
  const s5 = await call('PUT', '/users/me/transcript', { token: N1, body: { rows: [...T_B.rows, { ...T_B.rows[1], credits: 31 }] } });
  check('NOTIF-01g', '(5) 400, and still one', s5.status === 400 && (await tc()).length === 1);

  console.log('--- NOTIF-01g (screen, 6 and 7)');
  const browser = await launch();
  const page = await newPage(browser, { lang: 'en' });
  await signIn(page, EMAIL.N1);
  await page.click('[data-test="nav-transcript"]');
  await settle(page);
  const row = (code) => page.locator('[data-test^="row-"]').filter({ has: page.locator(`td:nth-child(2) input[value="${code}"]`) });
  const codes = () => page.locator('[data-test^="row-"] td:nth-child(2) input').evaluateAll((l) => l.map((e) => e.value));
  const ph = async () => { const all = await codes(); return page.locator(`[data-test="row-${all.indexOf('PH211')}"] td:nth-child(6) input`); };
  console.log(`  Transcript rows: ${JSON.stringify(await codes())}`);
  let m = mark(page);
  await (await ph()).fill('7');
  page.dialogAnswer = 'accept';
  page.lastDialog = null;
  await page.click('[data-test="nav-audit"]');
  await settle(page);
  check('NOTIF-01g', '(6) the leave dialog appears, OK leaves the page, no PUT, still one',
    page.lastDialog === 'Your transcript has unsaved changes. Leave the page and discard them?' && where(page) === '/audit' && sent(page, m, { writes: true }).length === 0 && (await tc()).length === 1, { dialog: page.lastDialog, url: where(page), writes: fmt(sent(page, m, { writes: true })) });
  page.dialogAnswer = 'dismiss';
  await page.click('[data-test="nav-transcript"]');
  await settle(page);
  await (await ph()).fill('7');
  const unblock = await block(page, 'api/users/me/transcript');
  m = mark(page);
  await page.locator('.head-actions button.primary').click();
  await settle(page, 800);
  const alert = (await page.locator('[data-test="save-error"]').innerText().catch(() => '')).trim();
  await unblock();
  page.dialogAnswer = 'accept';
  await page.reload({ waitUntil: 'networkidle' });
  await settle(page);
  page.dialogAnswer = 'dismiss';
  check('NOTIF-01g', '(7) the blocked save shows "Could not save. …"; still one', alert.startsWith('Could not save.') && (await tc()).length === 1, { alert, sent: fmt(sent(page, m)) });
  await browser.close();

  const s8 = await save({ rows: [] }); const g8 = await tc();
  check('NOTIF-01g', '(8) 200, and two', s8.status === 200 && g8.length === 2, brief(g8));
  const s9 = await save(T_A); const g9 = await tc();
  check('NOTIF-01g', '(9) 200, and still two', s9.status === 200 && g9.length === 2, brief(g9));
  check('NOTIF-01g', 'N2 has no transcript_changed', (await read(N2, 'kind=transcript_changed')).list.length === 0);
  S.tc = g9.map((n) => n.id); st.save();

  console.log('--- NOTIF-01h');
  const U = await unread(N1);
  const target = of((await read(N1)).list, S['E-b'])[0];
  const h1 = await call('POST', `/notifications/${target.id}/read`, { token: N1 });
  const h2 = await call('POST', `/notifications/${target.id}/read`, { token: N1 });
  const U2 = await unread(N1);
  check('NOTIF-01h', '(2) 200 with readAt set; again 200 with the same readAt; the count is U − 1',
    h1.status === 200 && h1.json.readAt && h2.status === 200 && h2.json.readAt === h1.json.readAt && U2 === U - 1, { U, U2, readAt: [h1.json?.readAt, h2.json?.readAt] });
  const ut = (await read(N1, 'unread=true')).list, uf = (await read(N1, 'unread=false')).list;
  check('NOTIF-01h', '(3) unread=true only unread, not that one; unread=false only read ones, that one included',
    ut.every((n) => n.readAt === null) && !ut.some((n) => n.id === target.id) && uf.every((n) => n.readAt !== null) && uf.some((n) => n.id === target.id), { true: ut.length, false: uf.length });
  const kinds = (await read(N1, 'kind=term_start&kind=registration_open')).list;
  check('NOTIF-01h', '(4) only those two kinds', kinds.length > 0 && kinds.every((n) => ['term_start', 'registration_open'].includes(n.kind)), kinds.map((n) => n.kind));
  const whole = (await read(N1)).list;
  const pages = [];
  let before = null;
  for (let i = 0; i < 50; i++) {
    const pr = await call('GET', `/notifications?limit=2${before ? `&before=${before}` : ''}`, { token: N1, show: quietList });
    pages.push(pr.json.notifications);
    if (!pr.json.nextBefore) break;
    before = pr.json.nextBefore;
  }
  const flat = pages.flat();
  const ordered = flat.every((n, i) => i === 0 || flat[i - 1].createdAt > n.createdAt || (flat[i - 1].createdAt === n.createdAt && flat[i - 1].id > n.id));
  check('NOTIF-01h', '(5) pages of at most 2, newest first, together the whole list once each',
    pages.every((p) => p.length <= 2) && ordered && isDeepStrictEqual(flat.map((n) => n.id), whole.map((n) => n.id)) && new Set(flat.map((n) => n.id)).size === flat.length, { pages: pages.length, items: flat.length, whole: whole.length, ordered });
  const ra = [await call('POST', '/notifications/read-all', { token: N1 }), await call('POST', '/notifications/read-all', { token: N1 })];
  const again = of((await read(N1)).list, S['E-b'])[0];
  check('NOTIF-01h', '(6) { unread: 0 } both times; the notification of (2) keeps its first readAt', ra.every((x) => x.status === 200 && x.json.unread === 0) && again.readAt === h1.json.readAt, { readAt: again.readAt });
  const before7 = (await read(N1)).list;
  const h7 = [await call('POST', `/notifications/${target.id}/read`, { token: N2 }), await call('POST', `/notifications/${S.tc[0]}/read`, { token: N2 })];
  check('NOTIF-01h', '(7) each 404 not_found "No notification with this ID"; N1\'s notifications as before',
    h7.every((x) => x.status === 404 && x.json?.code === 'not_found' && x.json?.message === 'No notification with this ID') && isDeepStrictEqual((await read(N1)).list, before7), h7.map((x) => x.status));

  console.log('--- NOTIF-01i (1)–(3)');
  const n3 = await account(EMAIL.N3);
  const del = await deleteAccount(n3.token);
  check('NOTIF-01i', '(1) 202', del.status === 202, del.json);
  r = await enter(a1, PROGRAM.APCS, 'i', 'term_start', D, D);
  check('NOTIF-01i', '(2) 201', r.status === 201);
  const enteredAt = new Date().toISOString();
  S.enteredAt = enteredAt; st.save();
  log('waiting 11 minutes, sending nothing as N1');
  await sleep(11 * 60_000);
  const ex = await call('GET', '/users/me/export', { token: N1, quiet: true });
  const rows = ex.json?.tables?.notifications ?? [];
  const mine = rows.filter((n) => n.calendar_event_id === S['E-i']);
  console.log(`  export: ${rows.length} notification rows; of E-i: ${JSON.stringify(mine.map((n) => ({ kind: n.kind, calendar_event_id: n.calendar_event_id, created_at: n.created_at })))}`);
  check('NOTIF-01i', '(3) 200; tables.notifications holds N1\'s term_start of E-i, made before the export (by the timer: N1 read nothing)',
    ex.status === 200 && mine.length === 1 && mine[0].kind === 'term_start' && mine[0].created_at < new Date().toISOString(), mine);
  log(`NOW: ask the bot for i(4): SELECT kind, calendar_event_id, created_at FROM notifications WHERE user_id = '<N3's ID>'; N3 = ${EMAIL.N3}; E-i = ${S['E-i']}`);
}

if (part === 'i5') {
  const s = await signInApi(EMAIL.N3);
  const list = (await read(s.token)).list;
  const ni = of(list, S['E-i']);
  check('NOTIF-01i', '(5) 200 with accountRestored true; the read holds E-i\'s term_start', s.accountRestored === true && ni.length === 1 && ni[0].kind === 'term_start', { accountRestored: s.accountRestored, ni: brief(ni) });
}

if (part === 'cleanup') {
  const a1 = (await signInApi(EMAIL.A1)).token;
  const out = [];
  for (const x of ['c', 'c2', 'c3', 'c4', 'i']) out.push((await call('DELETE', events(a1, x), { token: a1 })).status);
  const a2 = (await signInApi(EMAIL.A2)).token;
  out.push((await call('DELETE', events(a2, 'e'), { token: a2 })).status);
  check('NOTIF-01i', 'clean-up: each delete 204 (E-d stays until NOTIF-01d(2))', out.every((s) => s === 204), out);
}

if (part === 'd2') {
  const N1 = (await signInApi(EMAIL.N1)).token;
  const nd = of((await read(N1)).list, S['E-d']);
  check('NOTIF-01d', '(2) on D+3: exactly one notification of E-d, registration_open, no registration_soon', nd.length === 1 && nd[0].kind === 'registration_open', brief(nd));
  const a1 = (await signInApi(EMAIL.A1)).token;
  const r = await call('DELETE', events(a1, 'd'), { token: a1 });
  check('NOTIF-01d', 'clean-up: E-d deleted, 204', r.status === 204);
}

log(failureCount() ? `${failureCount()} FAIL(S)` : 'All checks ok');
