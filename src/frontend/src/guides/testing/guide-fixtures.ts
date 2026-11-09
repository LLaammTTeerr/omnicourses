import type { GuideListText, GuideText } from '../api.js';

// Synthetic guide texts for tests. Override only what a test is about.

export function listText(overrides: Partial<GuideListText> = {}): GuideListText {
  return {
    title: 'Hướng dẫn thử',
    keywords: [],
    portal: { name: 'Cổng thử', url: 'https://example.com/portal', account: 'Tài khoản thử' },
    version: 1,
    lastCheckedOn: '2026-11-01',
    outOfDate: false,
    ...overrides,
  };
}

export function guideText(overrides: Partial<GuideText> = {}): GuideText {
  return {
    ...listText(),
    changeNote: 'Bản thử.',
    lastCheckedBy: 'Test team',
    summary: 'Hướng dẫn giả lập để kiểm thử.',
    when: { text: 'Khi chạy kiểm thử.' },
    appliesTo: 'Tài khoản kiểm thử',
    prepare: [],
    steps: [{ text: 'Mở cổng thử.' }],
    notes: [],
    citations: [],
    ifPortalDown: null,
    related: [],
    portals: [],
    ...overrides,
  };
}
