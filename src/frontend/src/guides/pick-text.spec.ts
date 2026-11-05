import { describe, expect, it } from 'vitest';
import { pickText } from './pick-text.js';

describe('pickText (UC-10 A8)', () => {
  it('picks the screen language when the guide has it', () => {
    expect(pickText({ vi: 'vi text', en: 'en text' }, 'en')).toEqual({ text: 'en text', lang: 'en', fallback: false });
  });

  it('falls back to the one language the guide has', () => {
    expect(pickText({ vi: 'vi text' }, 'en')).toEqual({ text: 'vi text', lang: 'vi', fallback: true });
    expect(pickText({ en: 'en text' }, 'vi')).toEqual({ text: 'en text', lang: 'en', fallback: true });
  });

  it('gives nothing for a guide with no text', () => {
    expect(pickText({}, 'vi')).toBeNull();
  });
});
