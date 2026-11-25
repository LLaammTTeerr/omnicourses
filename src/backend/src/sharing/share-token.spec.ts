import { describe, expect, it } from 'vitest';
import { isShareToken, newShareToken } from './share-token.js';

describe('share token', () => {
  // UC-09 §7: at least as strong as a session token, 32 random bytes (ADR 0002).
  it('holds 32 random bytes in base64url', () => {
    const token = newShareToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(token, 'base64url')).toHaveLength(32);
    expect(isShareToken(token)).toBe(true);
  });

  it('is new each time', () => {
    const tokens = new Set(Array.from({ length: 200 }, newShareToken));
    expect(tokens.size).toBe(200);
  });

  it('refuses anything that is not a whole token', () => {
    const token = newShareToken();
    for (const value of ['', 'abc', token.slice(1), `${token}A`, `${token.slice(0, 42)}=`, `${token.slice(0, 42)}/`, `${token}\n`, 'x'.repeat(5000), undefined, null, 42, [token]]) {
      expect(isShareToken(value), String(value).slice(0, 50)).toBe(false);
    }
  });
});
