import { describe, expect, it } from 'vitest';
import { afterSignIn, HOME_SIGNED_IN } from './redirect.js';

describe('afterSignIn', () => {
  it('opens the page the student asked for', () => {
    expect(afterSignIn('/settings')).toBe('/settings');
    expect(afterSignIn('/guides/zz-fresh?x=1#steps')).toBe('/guides/zz-fresh?x=1#steps');
  });

  it.each([undefined, null, '', 'settings', 'https://example.com', '//example.com', '/\\example.com', 'javascript:alert(1)'])(
    'goes to the default page for %j',
    (redirect) => {
      expect(afterSignIn(redirect)).toBe(HOME_SIGNED_IN);
    },
  );

  it('ignores a redirect given twice', () => {
    expect(afterSignIn(['/settings', '/transcript'])).toBe(HOME_SIGNED_IN);
  });
});
