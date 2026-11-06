import { describe, expect, it } from 'vitest';
import type { GuideFile } from './guide-file.js';
import { parseGuideSet, portalsMissingFromBoard, validateGuideFile, validateGuideSet } from './validate-guide.js';

function published(overrides: Partial<GuideFile> = {}): GuideFile {
  return {
    id: 'zz-sample',
    lang: 'en',
    status: 'published',
    version: 1,
    changeNote: 'First version.',
    lastChecked: { on: '2026-11-01', by: 'Test team' },
    group: 'registration',
    title: 'Sample guide',
    keywords: ['sample'],
    summary: 'What the sample task is for.',
    when: { text: 'Each term.', announcement: { label: 'Announcement', url: 'https://example.com/news' } },
    appliesTo: 'All programs',
    portal: { name: 'Sample portal', url: 'https://portal.example.com/register', account: 'Student account' },
    steps: [{ text: 'Press “Sign in”.' }],
    ...overrides,
  };
}

// A skeleton as the content folder ships it: identity and links only, every text empty.
function skeleton(overrides: Partial<GuideFile> = {}): GuideFile {
  return {
    ...published(),
    status: 'draft',
    changeNote: '',
    lastChecked: null,
    title: '',
    keywords: [],
    summary: '',
    when: { text: '' },
    appliesTo: '',
    portal: { name: '', url: 'https://portal.example.com', account: '' },
    steps: [],
    ...overrides,
  };
}

describe('validateGuideFile', () => {
  it('accepts a complete published file', () => {
    expect(validateGuideFile(published())).toEqual([]);
  });

  it('accepts a draft whose text is still empty', () => {
    expect(validateGuideFile(skeleton())).toEqual([]);
  });

  it('checks the identity of every file, drafts too', () => {
    expect(validateGuideFile(skeleton({ id: 'Register Courses' }))).toEqual([
      'Register Courses.en: id must be lower-case words joined by hyphens, at most 64 characters',
    ]);
    expect(validateGuideFile(skeleton({ version: 0 }))).toEqual(['zz-sample.en: version must be a whole number from 1']);
    expect(validateGuideFile(skeleton({ group: 'fees' as GuideFile['group'] }))[0]).toMatch(/^zz-sample\.en: group must be one of /);
  });

  it('requires every field of guides plan §2 once published', () => {
    const problems = validateGuideFile(published({ title: ' ', summary: '', appliesTo: '', changeNote: '', keywords: [], steps: [] }));
    expect(problems).toEqual([
      'zz-sample.en: changeNote is required',
      'zz-sample.en: title is required',
      'zz-sample.en: summary is required',
      'zz-sample.en: appliesTo is required',
      'zz-sample.en: keywords needs at least one word, and no empty ones',
      'zz-sample.en: steps needs at least one step',
    ]);
  });

  it('requires a real last-checked date and a name once published', () => {
    expect(validateGuideFile(published({ lastChecked: null }))).toEqual([
      'zz-sample.en: lastChecked is required: the date and the name of whoever followed the guide on the portal',
    ]);
    expect(validateGuideFile(published({ lastChecked: { on: '2026-02-30', by: '' } }))).toEqual([
      'zz-sample.en: lastChecked.on must be a date written YYYY-MM-DD',
      'zz-sample.en: lastChecked.by is required',
    ]);
  });

  it('accepts only https links and OmniCourse paths, drafts too', () => {
    // A browser reads `\` as `/`, so `/\evil.example.com` is `//evil.example.com`: another site.
    for (const url of ['http://example.com', 'javascript:alert(1)', '//evil.example.com', '/\\evil.example.com', '/guides\\x', 'example.com']) {
      expect(validateGuideFile(skeleton({ related: [{ label: 'x', url }] }))).toEqual([
        'zz-sample.en: related[0].url must be an https address or an OmniCourse path starting with /',
      ]);
    }
    expect(validateGuideFile(published({ related: [{ label: 'Transcript', url: '/transcript' }] }))).toEqual([]);
    expect(validateGuideFile(skeleton({ portal: { name: '', url: '/guides', account: '' } }))).toEqual([
      'zz-sample.en: portal.url must be an https address',
    ]);
  });

  it('accepts only https links for the sources of notes and citations, drafts too', () => {
    for (const url of ['/guides', 'http://example.com/qc.pdf', '//evil.example.com', 'https:// example.com']) {
      const file = skeleton({
        notes: [{ text: '', source: { kind: 'regulation', document: '', clause: '', url } }],
        citations: [{ document: '', clause: '', url }],
      });
      expect(validateGuideFile(file)).toEqual([
        'zz-sample.en: notes[0].source.url must be an https address',
        'zz-sample.en: citations[0].url must be an https address',
      ]);
    }
  });

  it('refuses a typed credit number (AGENTS.md hard rule 1)', () => {
    for (const text of ['Register up to 25 credits.', 'Đăng ký 14–25 TC mỗi kỳ.', 'Tối đa 20 tín chỉ.']) {
      expect(validateGuideFile(published({ summary: text }))).toEqual([
        'zz-sample.en: summary types a credit number; cite the clause instead (AGENTS.md hard rule 1)',
      ]);
    }
    expect(validateGuideFile(published({ summary: 'You may register up to the credit cap for your program.' }))).toEqual([]);
  });

  it('refuses a typed date (guides plan §3 rule 4) but not a regulation number', () => {
    expect(validateGuideFile(published({ steps: [{ text: 'Pay before 15/11.' }] }))).toEqual([
      "zz-sample.en: steps[0].text types a date; link the school's announcement instead (guides plan §3 rule 4)",
    ]);
    expect(validateGuideFile(published({ when: { text: 'From 2026-11-15.' } }))).toEqual([
      "zz-sample.en: when.text types a date; link the school's announcement instead (guides plan §3 rule 4)",
    ]);
    expect(validateGuideFile(published({ summary: 'Theo Thông tư 08/2021/TT-BGDĐT.' }))).toEqual([]);
  });

  it('requires the parts of a note, a citation and a board entry once published', () => {
    const file = published({
      notes: [{ text: '', source: { kind: 'regulation', document: '', clause: 'Điều 7', url: 'https://example.com/qc.pdf' } }],
      citations: [{ document: 'Quy chế', clause: '', url: 'https://example.com/qc.pdf' }],
      portals: [{ name: 'Portal', url: 'https://portal.example.com', account: '', purpose: 'Registration' }],
    });
    expect(validateGuideFile(file)).toEqual([
      'zz-sample.en: notes[0].text is required',
      'zz-sample.en: notes[0].source.document is required',
      'zz-sample.en: citations[0].clause is required',
      'zz-sample.en: portals[0].account is required',
    ]);
  });
});

describe('validateGuideSet', () => {
  it('refuses two files with the same id and language', () => {
    expect(validateGuideSet([published(), published()])).toEqual(['zz-sample.en: two files have this id and language']);
  });

  it('requires both languages of a guide to agree on its group and portal', () => {
    const vi = published({ lang: 'vi' });
    expect(validateGuideSet([vi, published({ group: 'graduation' })])).toEqual([
      'zz-sample: the vi and en files must have the same group',
    ]);
    expect(validateGuideSet([vi, published({ portal: { ...vi.portal, url: 'https://other.example.com' } })])).toEqual([
      'zz-sample: the vi and en files must link the same portal.url',
    ]);
  });
});

describe('parseGuideSet', () => {
  it('types the set for loading only when every check passes, so a published file always has lastChecked', () => {
    expect(parseGuideSet([published()])).toEqual({ files: [published()] });
    expect(parseGuideSet([published({ lastChecked: null })])).toEqual({ problems: [expect.stringContaining('lastChecked is required')] });
  });
});

describe('portalsMissingFromBoard', () => {
  const board = published({
    id: 'accounts-and-portals',
    group: 'accounts-and-portals',
    portals: [{ name: 'Portal', url: 'https://portal.example.com', account: 'Student account', purpose: 'Registration' }],
  });

  it('accepts a guide whose portal host is on the published board', () => {
    expect(portalsMissingFromBoard([board, published()])).toEqual([]);
  });

  it('reports a guide whose portal is not on the board', () => {
    const elsewhere = published({ id: 'pay-tuition', portal: { name: 'Fees', url: 'https://fees.example.com/pay', account: 'Student account' } });
    expect(portalsMissingFromBoard([board, elsewhere])).toEqual(['pay-tuition.en: fees.example.com is not on the portal board']);
  });

  it('checks nothing while no board is published', () => {
    expect(portalsMissingFromBoard([published()])).toEqual([]);
  });
});
