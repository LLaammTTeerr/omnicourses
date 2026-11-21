// Search that ignores Vietnamese diacritics, case and spacing, so "hoc may" finds "Học máy" (as the prototypes
// search). One fold for every search box: the explorer, the planner's tray, the guides and the group colours.

/** Text as search compares it: no diacritics, đ as d, lower case, single spaces. */
export function fold(text: string): string {
  return text
    .normalize('NFD')
    .toLowerCase()
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();
}

/** True when every word of the query appears in one of the texts; an empty query matches everything. */
export function matchesEveryWord(query: string, ...texts: (string | null)[]): boolean {
  const haystack = fold(texts.filter(Boolean).join(' '));
  return fold(query).split(' ').filter(Boolean).every((word) => haystack.includes(word));
}
