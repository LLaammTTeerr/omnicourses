import { describe, expect, it } from 'vitest';
import { isPendingDeletion } from './user.entity.js';

describe('isPendingDeletion', () => {
  it('is true once a deletion is requested', () => {
    expect(isPendingDeletion({ deletionRequestedAt: new Date() })).toBe(true);
  });

  it('is false when none is requested or it was cancelled', () => {
    expect(isPendingDeletion({ deletionRequestedAt: null })).toBe(false);
  });
});
