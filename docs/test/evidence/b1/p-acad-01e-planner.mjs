// ACAD-01e, the plans part: the load of one main term of an APCS 2024 plan at 9, 10, 22 and 23 credits.
// API (PUT placements, GET issues) and Screen (the Plan check panel and the term row), in Vietnamese and English.
// Account: the S1 stand-in b1-run-<run>-p01@example.com, whose transcript holds only ZZ codes.
import { T, browser, check, email, log, setLang, shot, signedIn, sleep, summary, text, SITE } from './p-lib.mjs';

const LOADS = [
  [9, ['CS160', 'BAA00101', 'BAA00102']],
  [10, ['CS160', 'CS163', 'BAA00102']],
  [22, ['CS160', 'CS163', 'CS201', 'CS202', 'CS250', 'BAA00102']],
  [23, ['CS160', 'CS163', 'CS201', 'CS202', 'BAA00101', 'BAA00102', 'BAA00103']],
];
const TEXT = {
  vi: { count: (n) => `${n} cần xem lại`, 9: ['Dưới mức tín chỉ tối thiểu', '9 TC, dưới mức tối thiểu 10 TC. Được phép nếu có đơn được duyệt.'], 23: ['Vượt mức tín chỉ tối đa', '23 TC, vượt mức tối đa 22 TC. Được phép nếu có đơn được duyệt.'], term: 'HK1 2024–2025', load: (n) => `${n} / 22 TC`, tip: 'Mở quy chế: QĐ 1175/QĐ-KHTN Điều 7.2', range: '10–22 TC', unknowns: 'Chưa ghi nhận', coverage: 'Khi hoàn thành kế hoạch', panel: 'Kiểm tra kế hoạch' },
  en: { count: (n) => `${n} worth a look`, 9: ['Below the minimum load', '9 credits, below the minimum of 10. A petition can allow it.'], 23: ['Above the maximum load', '23 credits, above the maximum of 22. A petition can allow it.'], term: 'Term 1 2024–2025', load: (n) => `${n} / 22 credits`, tip: 'Open the regulation: QĐ 1175/QĐ-KHTN Điều 7.2', range: '10–22 credits', unknowns: 'Not recorded yet', coverage: 'With the plan completed', panel: 'Plan check' },
};

const b = await browser();
const A = await signedIn(b, email('01'));
const page = A.page;
await page.goto(`${SITE}/plans/all`); await page.waitForLoadState('networkidle');
const tr = await A.api('GET', '/users/me/transcript');
log(`transcript of the account: ${tr.json?.rows?.map((r) => r.courseCode).join(' ')}`);
const made = await A.api('POST', '/plans', { name: 'Caps 01e', programCode: 'APCS', cohortYear: 2024 });
check('ACAD-01e', 'plan "Caps 01e" created on APCS 2024 (201)', made.status === 201 && made.json?.curriculum?.code === 'APCS2024', `${made.status} ${made.json?.curriculum?.code}`);
const id = made.json.id;

for (const [credits, codes] of LOADS) {
  const put = await A.api('PUT', `/plans/${id}/placements`, { terms: [{ term: { year: 2024, number: 1 }, placements: codes.map((courseCode) => ({ kind: 'course', courseCode })) }] });
  check('ACAD-01e', `${credits} credits: PUT placements answers 200 (nothing blocks saving)`, put.status === 200, put.status);
  const iss = await A.api('GET', `/plans/${id}/issues`);
  const term = iss.json?.terms?.find((t) => t.term.year === 2024 && t.term.number === 1);
  const load = (iss.json?.issues ?? term?.issues ?? []).filter((i) => /^load_/.test(i.code));
  const all = JSON.stringify(iss.json);
  const loadIssues = [...all.matchAll(/\{[^{}]*"code":"load_[a-z_]+"[^{}]*(\{[^{}]*\}[^{}]*)*\}/g)].map((m) => m[0]);
  log(`${credits} credits: GET issues ${iss.status}; term 2024-1: ${JSON.stringify(term && { kind: term.kind, credits: term.credits, caps: term.caps })}; load issues: ${loadIssues.join(' ') || 'none'}; top-level keys: ${Object.keys(iss.json ?? {}).join(',')}`);
  check('ACAD-01e', `${credits} credits: GET issues gives the term caps { min: 10, max: 22 }`, JSON.stringify(term?.caps) === '{"min":10,"max":22}', term?.caps);
  if (credits === 9 || credits === 23) {
    const code = credits === 9 ? 'load_below_minimum' : 'load_above_maximum';
    const one = loadIssues.length === 1 ? JSON.parse(loadIssues[0]) : null;
    check('ACAD-01e', `${credits} credits: one ${code}, kind flag, credits ${credits}, limit ${credits === 9 ? 10 : 22}, citation QĐ 1175/QĐ-KHTN Điều 7.2`, !!one && one.code === code && one.kind === 'flag' && one.credits === credits && one.limit === (credits === 9 ? 10 : 22) && one.citation === 'QĐ 1175/QĐ-KHTN Điều 7.2', loadIssues);
  } else check('ACAD-01e', `${credits} credits: no load issue`, loadIssues.length === 0, loadIssues.length ? loadIssues : 'none');

  for (const lang of ['vi', 'en']) {
    const x = TEXT[lang];
    await page.evaluate((l) => localStorage.setItem('omnicourse.lang', l), lang);
    await page.goto(`${SITE}/plans/${id}`);
    await T(page, 'issue-counts').waitFor({ timeout: 20000 }); await page.waitForLoadState('networkidle'); await sleep(900);
    const id2 = `ACAD-01e`;
    const p = `${credits} cr, ${lang}:`;
    const counts = await page.$$eval('[data-test="issue-counts"] .chip', (e) => e.map((c) => c.textContent.trim()));
    const want = credits === 9 || credits === 23 ? 1 : 0;
    check(id2, `${p} count chip "${x.count(want)}"`, counts.includes(x.count(want)), counts);
    const title = await text(page.locator('#issues-title'));
    check(id2, `${p} panel title "${x.panel}", a flat list with no heading per kind`, title === x.panel && (await page.locator('[data-test="issues-panel"] .rail-list h3, [data-test="issues-panel"] .rail-list h4').count()) === 0, title);
    const cards = page.locator('[data-test="issues-panel"] .rail-list > li');
    const loadCards = await cards.evaluateAll((els) => els.map((e) => ({ test: e.getAttribute('data-test'), cls: e.className, title: e.querySelector('b')?.lastChild?.textContent?.trim(), text: e.querySelector('[data-test="issue-text"]')?.textContent?.trim(), chip: e.querySelector('.vfoot .chip.line')?.textContent?.trim(), link: (() => { const a = e.querySelector('a[data-test="citation"]'); return a && { shown: a.querySelector('[aria-hidden="true"]:not(svg)')?.textContent?.trim(), href: a.getAttribute('href'), target: a.target, rel: a.rel, title: a.title }; })(), icon: e.querySelector('.ic svg')?.innerHTML, icColour: getComputedStyle(e.querySelector('.ic')).color, bg: getComputedStyle(e).backgroundColor, border: getComputedStyle(e).borderLeftColor })));
    const infoIcon = await page.locator('[data-test="issue-counts"] .chip.warn svg').first().evaluate((e) => e.innerHTML).catch(() => null);
    const warn = await page.evaluate(() => { const d = document.createElement('i'); d.style.color = 'var(--warn)'; document.body.append(d); const c = getComputedStyle(d).color; d.remove(); return c; });
    if (want) {
      const c = loadCards.find((k) => k.title === x[credits][0]);
      check(id2, `${p} one card, titled "${x[credits][0]}"`, loadCards.length === 1 && !!c, loadCards.map((k) => k.title));
      check(id2, `${p} card text "${x[credits][1]}"`, c?.text === x[credits][1], c?.text);
      check(id2, `${p} the card is the amber "flag" kind with the info (i) icon, not a warning triangle`, c?.test === 'issue-flag' && /\bflag\b/.test(c?.cls) && c?.icon === infoIcon, { dataTest: c?.test, class: c?.cls, iconColour: c?.icColour, warnToken: warn, sameIconAsTheFlagChipInfoIcon: c?.icon === infoIcon, icon: c?.icon });
      check(id2, `${p} under the text: the term chip "${x.term}"`, c?.chip === x.term, c?.chip);
      check(id2, `${p} a link labelled "Điều 7.2", opening the regulation PDF in a new tab, tooltip "${x.tip}"`, c?.link?.shown === 'Điều 7.2' && c?.link?.target === '_blank' && /\.pdf/i.test(c?.link?.href ?? '') && c?.link?.title === x.tip, c?.link);
    } else check(id2, `${p} no load card`, loadCards.filter((k) => /load|tín chỉ tối|minimum load|maximum load/i.test(`${k.title}`)).length === 0, loadCards.map((k) => k.title));
    const row = page.locator('.rows > section').first();
    const rowName = await text(row.locator('h3'));
    const loadText = await row.locator('[data-test="load"]').evaluate((e) => [...e.childNodes].filter((n) => !(n.nodeType === 1 && n.classList.contains('sr-only'))).map((n) => n.textContent).join('').replace(/\s+/g, ' ').trim());
    const loadTip = await row.locator('[data-test="load"]').getAttribute('title');
    const sr = await text(row.locator('[data-test="load"] .sr-only'));
    check(id2, `${p} the term row "${x.term}" shows "${x.load(credits)}"`, rowName === x.term && loadText === x.load(credits), `${rowName}: "${loadText}"`);
    check(id2, `${p} the range "${x.range}" is only in the tooltip and the screen-reader text`, (loadTip ?? '').includes(x.range) && sr.includes(x.range) && !loadText.includes('10–22'), `tooltip "${loadTip}"; sr-only "${sr}"`);
    const meter = await row.locator('.cap').evaluate((e) => ({ cls: e.className, fill: getComputedStyle(e.querySelector('.fill')).backgroundColor, ticks: [...e.querySelectorAll('.tick em')].map((t) => t.textContent.trim()) }));
    const tok = await page.evaluate(() => Object.fromEntries(['ok', 'warn', 'bad'].map((k) => { const d = document.createElement('i'); d.style.color = `var(--${k})`; document.body.append(d); const c = getComputedStyle(d).color; d.remove(); return [k, c]; })));
    const wantCap = credits === 9 ? 'under' : credits === 23 ? 'over' : 'ok';
    const wantColour = credits === 9 ? tok.warn : credits === 23 ? tok.bad : tok.ok;
    check(id2, `${p} meter ${credits === 9 ? 'amber' : credits === 23 ? 'red' : 'green'}, ticks at 10 and 22`, new RegExp(`\\b${wantCap}\\b`).test(meter.cls) && meter.fill === wantColour && meter.ticks.join() === '10,22', { ...meter, tokens: tok });
    const rowIssues = await row.locator('.row-issues > li').evaluateAll((els) => els.map((e) => ({ cls: e.className, visibleWords: e.classList.contains('sr-only') ? '' : e.querySelector('span[aria-hidden]')?.textContent?.trim() })));
    check(id2, `${p} the row shows no words of its own for the load issue`, rowIssues.every((r) => !/tín chỉ tối|minimum load|maximum load/i.test(r.visibleWords ?? '')), rowIssues);
    const unk = await text(page.locator('[data-test="unknowns"] > summary')), unkOpen = await page.locator('[data-test="unknowns"]').evaluate((e) => e.open).catch(() => null);
    const cov = await text(page.locator('[data-test="coverage"] > summary')), covOpen = await page.locator('[data-test="coverage"]').evaluate((e) => e.open).catch(() => null);
    check(id2, `${p} collapsed "${x.unknowns} (n)" and "${x.coverage}" sections; no "Đã đạt trước đó / Already passed"`, unk === `${x.unknowns} (${codes.length * 2})` && unkOpen === false && cov.startsWith(x.coverage) && covOpen === false && !/Đã đạt trước đó|Already passed/.test(await text(T(page, 'issues-panel'))), `"${unk}" open=${unkOpen}; "${cov}" open=${covOpen}`);
    if (lang === 'vi' && (credits === 9 || credits === 23)) await shot(page, `p-acad-01e-${credits}-credits-vi.png`);
    if (lang === 'en' && credits === 23) await shot(page, 'p-acad-01e-23-credits-en.png');
  }
}
await page.evaluate(() => localStorage.setItem('omnicourse.lang', 'vi'));
// PLAN-01l follow-up: the What-if copy made earlier has a tab of its own (the first read was taken before the tabs had loaded).
await page.goto(`${SITE}/plans/${id}`); await T(page, 'plan-tabs').waitFor(); await page.waitForLoadState('networkidle'); await sleep(500);
const tabs = await page.$$eval('[data-test="plan-tab"]', (e) => e.map((x) => x.textContent.trim()));
check('PLAN-01l', 'follow-up: "What-if: Screen 01b" and "Screen 01b" each have a tab', tabs.includes('What-if: Screen 01b') && tabs.includes('Screen 01b'), tabs);
await A.keep();
await b.close();
summary();
