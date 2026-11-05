import type { GuideFile, GuideGroup, GuideLang, GuideStatus } from '../guide-file.js';
import { addDays, addMonths, isOutOfDate, OUT_OF_DATE_MONTHS } from '../out-of-date.js';

// Synthetic guides for the cases of TC-B1-GUIDE-01 the real batch cannot reach (i–o).
// Loaded by the tests and by `npm run db:seed -w src/backend -- --guide-fixtures`, on test
// databases only. Never put them in ../content/. Each title holds its ID, so a search finds it.

/** The oldest last-checked date still fresh on `today`: 6 months back, or a little later when that month is shorter. */
export function oldestFreshDate(today: string): string {
  let date = addMonths(today, -OUT_OF_DATE_MONTHS);
  while (isOutOfDate(date, today)) date = addDays(date, 1);
  return date;
}

function fixture(id: string, lang: GuideLang, status: GuideStatus, checkedOn: string, group: GuideGroup): GuideFile {
  const vi = lang === 'vi';
  return {
    id,
    lang,
    status,
    version: 1,
    changeNote: vi ? 'Bản thử nghiệm.' : 'Test version.',
    lastChecked: { on: checkedOn, by: 'Test team' },
    group,
    title: vi ? `Hướng dẫn thử ${id}` : `Test guide ${id}`,
    keywords: [id],
    summary: vi ? 'Hướng dẫn giả lập để kiểm thử, không phải thủ tục thật.' : 'A synthetic guide for testing, not a real school task.',
    when: {
      text: vi ? 'Khi chạy kiểm thử.' : 'When the tests run.',
      announcement: { label: vi ? 'Thông báo thử' : 'Test announcement', url: 'https://example.com/announcement' },
    },
    appliesTo: vi ? 'Tài khoản kiểm thử' : 'Test accounts',
    portal: { name: vi ? 'Cổng thử' : 'Test portal', url: `https://example.com/portal/${id}`, account: vi ? 'Tài khoản thử' : 'Test account' },
    prepare: [{ text: vi ? 'Một tài khoản thử.' : 'A test account.' }],
    steps: [{ text: vi ? 'Mở cổng thử.' : 'Open the test portal.' }, { text: vi ? 'Bấm “Gửi”.' : 'Press “Gửi” (Send).' }],
    notes: [{ text: vi ? 'Ghi chú thử.' : 'A test note.', source: { kind: 'team' } }],
    ifPortalDown: vi ? 'Thử lại sau.' : 'Try again later.',
  };
}

/** The test-only guides of TC-B1-GUIDE-01, dated back from `today` (a Vietnam date, YYYY-MM-DD). */
export function guideFixtures(today: string): GuideFile[] {
  const edge = oldestFreshDate(today);
  const both = (id: string, status: GuideStatus, on: string, group: GuideGroup) => [
    fixture(id, 'vi', status, on, group),
    fixture(id, 'en', status, on, group),
  ];
  return [
    ...both('zz-fresh', 'published', today, 'registration'),
    ...both('zz-six-months', 'published', edge, 'tuition-and-fees'),
    ...both('zz-six-months-and-a-day', 'published', addDays(edge, -1), 'tuition-and-fees'),
    fixture('zz-vi-only', 'vi', 'published', today, 'records-and-certificates'),
    fixture('zz-en-only', 'en', 'published', today, 'records-and-certificates'),
    ...both('zz-draft', 'draft', today, 'registration'),
    ...both('zz-withdrawn', 'withdrawn', today, 'registration'),
  ];
}
