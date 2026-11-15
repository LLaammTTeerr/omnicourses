import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { sha256 } from '../regulations/regulation-files.js';
import {
  extractHandbook,
  type HandbookDocument,
  type HandbookSource,
  MAX_PASSAGE,
  paragraphs,
  personNames,
  redactionRule,
  renderHandbookMarkdown,
  splitLong,
} from './handbook.js';
import { HANDBOOK_DIR, handbookIds, handbookJson, readHandbookSource } from './handbook-files.js';

// The handbook PDF and its text layer stay out of git (the PDF prints staff contacts), so CI checks
// the committed passages themselves: their shape, and that no personal data got through. With
// HANDBOOK_TEXT_DIR set to a folder holding `<id>.txt` (the pdftotext output), the spec also proves
// the committed JSON is exactly what the extractor writes from it.

describe.each(handbookIds())('handbook %s', (id) => {
  const source = readHandbookSource(id);
  const committedJson = readFileSync(join(HANDBOOK_DIR, `${id}.json`), 'utf8');
  const document = JSON.parse(committedJson) as HandbookDocument;
  const firstPrinted = 1;
  const lastPrinted = source.pdf.pages - source.printedPageOffset;

  it('has a Markdown version generated from the JSON', () => {
    expect(readFileSync(join(HANDBOOK_DIR, `${id}.md`), 'utf8')).toBe(renderHandbookMarkdown(document));
  });

  it('carries the source file it was extracted with', () => {
    const { passages: _p, redactions: _r, ...rest } = document;
    expect(rest).toEqual(source);
  });

  it('has unique ids under its sections, each with a label, pages and text', () => {
    const ids = document.passages.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    const sections = new Map(source.sections.map((s) => [s.id, s]));
    for (const p of document.passages) {
      const section = sections.get(p.section.id);
      expect(section, p.id).toBeDefined();
      expect(p.id.startsWith(`${id}/${p.section.id}/`), p.id).toBe(true);
      expect(p.id).toMatch(/^[a-z0-9-]+(?:\/[a-z0-9-]+){2,4}$/);
      expect(p.label.startsWith(section!.title), p.id).toBe(true);
      expect(p.text.trim().length, p.id).toBeGreaterThan(0);
      expect(p.text.length, p.id).toBeLessThanOrEqual(MAX_PASSAGE * 2);
      expect(p.pages.length, p.id).toBeGreaterThan(0);
      for (const page of p.pages) expect(page, p.id).toBeGreaterThanOrEqual(firstPrinted);
      for (const page of p.pages) expect(page, p.id).toBeLessThanOrEqual(lastPrinted);
      if (section!.kind === 'regulation' && p.article) expect(p.label, p.id).toContain(`Điều ${p.article.number}`);
    }
  });

  it('cites only pages inside its section and outside the excluded ranges', () => {
    const printed = (pdf: number) => pdf - source.printedPageOffset;
    for (const p of document.passages) {
      const section = source.sections.find((s) => s.id === p.section.id)!;
      for (const page of p.pages) {
        expect(page, p.id).toBeGreaterThanOrEqual(printed(section.pdfPages[0]));
        expect(page, p.id).toBeLessThanOrEqual(printed(section.pdfPages[1]));
      }
    }
    for (const e of source.excluded) {
      for (const s of source.sections) {
        const overlaps = s.pdfPages[0] <= e.pdfPages[1] && e.pdfPages[0] <= s.pdfPages[1];
        // A section may share its first or last page with an excluded range (startsAt / endsBefore).
        const sharesEdge = s.pdfPages[1] === e.pdfPages[0] && s.endsBefore !== undefined;
        expect(overlaps && !sharesEdge, `${s.id} overlaps excluded ${e.pdfPages.join('–')}`).toBe(false);
      }
    }
  });

  it('publishes no e-mail address, phone number, academic title or personal name', () => {
    const leaks: string[] = [];
    for (const p of document.passages) {
      for (const line of [p.label, ...p.text.split('\n')]) {
        const rule = redactionRule(line);
        if (rule) leaks.push(`${p.id}: ${rule}`);
      }
    }
    // The rule names only: a failing run must not print the line it caught.
    expect(leaks).toEqual([]);
  });

  it('keeps public web addresses on the school domain or its official pages only', () => {
    const urls = document.passages.flatMap((p) => p.text.match(/\b(?:https?:\/\/|www\.)\S+/gu) ?? []);
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) expect(url).toMatch(/hcmus|facebook\.com|fb\.me|zalo\.me|youtube\.com/);
  });

  it.runIf(process.env.HANDBOOK_TEXT_DIR)('is exactly what the extractor writes from the text layer', () => {
    const pdftotext = readFileSync(join(process.env.HANDBOOK_TEXT_DIR!, `${id}.txt`), 'utf8');
    expect(sha256(pdftotext)).toBe(source.textLayer.sha256);
    expect(committedJson).toBe(handbookJson(extractHandbook(source, pdftotext)));
  });
});

// A synthetic two-page handbook: invented office, people and numbers (AGENTS.md hard rule 3).
const SYNTHETIC: HandbookSource = {
  id: 'so-tay-test',
  title: 'Sổ tay thử',
  shortName: 'Sổ tay thử',
  issuer: 'Trường thử',
  obtained: 'synthetic',
  pdf: { sha256: 'x', pages: 3 },
  textLayer: { command: 'pdftotext', tool: 'test', sha256: 'x' },
  printedPageOffset: 0,
  sections: [
    { id: 'phong', title: 'Các phòng', kind: 'prose', pdfPages: [1, 1] },
    { id: 'quy-dinh', title: 'Quy định thử', kind: 'regulation', pdfPages: [2, 2] },
  ],
  overrides: [{ kind: 'dropLines', pdfPage: 1, reason: 'hidden text', lines: ['HK9'] }],
  excluded: [{ pdfPages: [3, 3], reason: 'phone directory' }],
  notes: [],
};
const SYNTHETIC_TEXT = [
  [
    'PHÒNG THỬ NGHIỆM',
    '- Tiếp nhận hồ sơ của sinh viên và',
    'trả kết quả trong ngày.',
    'HK9',
    'Thông tin liên hệ',
    'Trưởng phòng:',
    'ThS. Trịnh Văn Thử',
    '(thu@example.edu.vn)',
    'Phòng A.01, Cơ sở 1',
    '(028) 1234 5678',
    'www.example.hcmus.edu.vn',
    'Sinh viên được hỗ trợ miễn phí mọi thủ tục giấy tờ.',
    '1',
  ].join('\n'),
  [
    'QUY ĐỊNH THỬ',
    'Điều 1. Phạm vi',
    'áp dụng',
    '1.1. Quy định này áp dụng cho sinh viên chính quy.',
    '1.2. Sinh viên nộp đơn trong 10 ngày.',
    'Điều 2: Thời hạn',
    '1. Đơn nộp muộn không',
    'được xét.',
    '2.',
    'Kết quả công bố sau 15 ngày.',
    '2',
  ].join('\n'),
  'Bảo vệ: 0901 234 567',
].join('\f');

describe('extractHandbook on a synthetic handbook', () => {
  const document = extractHandbook(SYNTHETIC, SYNTHETIC_TEXT);
  const byId = new Map(document.passages.map((p) => [p.id, p]));

  it('splits a prose section at its heading and drops the contact block but its web address', () => {
    const office = byId.get('so-tay-test/phong/p1')!;
    expect(office.label).toBe('Các phòng – PHÒNG THỬ NGHIỆM');
    expect(office.text).toBe(
      'PHÒNG THỬ NGHIỆM\n- Tiếp nhận hồ sơ của sinh viên và trả kết quả trong ngày. www.example.hcmus.edu.vn Sinh viên được hỗ trợ miễn phí mọi thủ tục giấy tờ.',
    );
    expect(office.text).not.toMatch(/Trịnh|example\.edu\.vn|1234|A\.01|HK9/u);
    expect(document.redactions).toEqual({ contact_block: 6, override: 1 });
  });

  it('splits an excerpted regulation into Điều and khoản with dotted and plain numbering', () => {
    expect([...byId.keys()]).toEqual([
      'so-tay-test/phong/p1',
      'so-tay-test/quy-dinh/d1/k1',
      'so-tay-test/quy-dinh/d1/k2',
      'so-tay-test/quy-dinh/d2/k1',
      'so-tay-test/quy-dinh/d2/k2',
    ]);
    const k = byId.get('so-tay-test/quy-dinh/d1/k2')!;
    expect(k.label).toBe('Quy định thử, Điều 1, khoản 2');
    expect(k.article).toEqual({ number: 1, title: 'Phạm vi áp dụng' });
    expect(k.pages).toEqual([2]);
    expect(byId.get('so-tay-test/quy-dinh/d2/k1')!.text).toBe('1. Đơn nộp muộn không được xét.');
    expect(byId.get('so-tay-test/quy-dinh/d2/k2')!.text).toBe('2. Kết quả công bố sau 15 ngày.');
  });

  it('refuses a text layer with another page count', () => {
    expect(() => extractHandbook(SYNTHETIC, 'one page')).toThrow(/pages/);
  });

  it('refuses an override that matches no line', () => {
    const broken = { ...SYNTHETIC, overrides: [{ kind: 'dropLines' as const, pdfPage: 1, reason: 'x', lines: ['NOT THERE'] }] };
    expect(() => extractHandbook(broken, SYNTHETIC_TEXT)).toThrow(/no line/);
  });
});

describe('redaction rules', () => {
  it.each([
    ['an e-mail address', 'Liên hệ: hotro@example.edu.vn', 'email'],
    ['a landline', 'ĐT: (028) 1234 5678', 'phone'],
    ['a mobile number', 'Hotline 0901.234.567', 'phone'],
    ['an extension', 'Số nội bộ 123', 'phone'],
    ['an academic title before a name', 'PGS.TS. Trịnh Văn Thử', 'academic_title'],
    ['a spelled-out title', 'Thạc sĩ Lục Thị Mẫu', 'academic_title'],
    ['an honorific', 'Ông Khúc Thừa', 'honorific'],
    ['a name with a Đ surname', 'Đoàn Văn Mẫu phụ trách', 'person_name'],
  ])('catches %s', (_what, line, rule) => {
    expect(redactionRule(line)).toBe(rule);
  });

  it.each([
    ['a date range', '06/9 - 14/9/2024: Sinh hoạt đầu khóa'],
    ['a street named after a person', '227 Nguyễn Văn Cừ, Quận 5'],
    ['the city', 'Đại học Quốc gia Thành phố Hồ Chí Minh'],
    ['an organisation', 'Đoàn Thanh niên Cộng sản Hồ Chí Minh'],
    ['a rule with numbers', 'Sinh viên đăng ký tối thiểu 14 tín chỉ/học kỳ'],
  ])('keeps %s', (_what, line) => {
    expect(redactionRule(line)).toBeNull();
    expect(personNames(line)).toEqual([]);
  });
});

describe('paragraphs and splitLong', () => {
  it('joins wrapped lines and starts a paragraph at a marker, a heading or after a colon', () => {
    expect(paragraphs(['- một', 'hai', '1.', 'ba', 'bốn:', 'năm', 'HỌC KỲ 1', 'sáu'])).toEqual(['- một hai', '1. ba bốn:', 'năm', 'HỌC KỲ 1 sáu']);
  });

  it('keeps a calendar date with its event', () => {
    expect(paragraphs(['HỌC KỲ HÈ', '14/7 - 20/7/2025:', 'Bắt đầu HK hè'])).toEqual(['HỌC KỲ HÈ 14/7 - 20/7/2025: Bắt đầu HK hè']);
  });

  it('splits long text at paragraph breaks only', () => {
    const paragraph = 'chữ '.repeat(200).trim();
    const parts = splitLong([paragraph, paragraph, paragraph].join('\n'));
    expect(parts.length).toBeGreaterThan(1);
    for (const part of parts) expect(part.split('\n').every((p) => p === paragraph)).toBe(true);
  });
});
