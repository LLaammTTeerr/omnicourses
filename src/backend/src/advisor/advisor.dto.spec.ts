import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { ADVISOR_LIMITS, type AskDto, checkConversation } from './advisor.dto.js';

const dto = (...messages: { role: 'user' | 'assistant'; content: string }[]): AskDto => ({ language: 'en', messages }) as AskDto;

describe('checkConversation (ADR 0016 limits)', () => {
  it('measures a question after NFKC: one U+FDFA becomes 18 characters', () => {
    const question = `${'ﷺ'.repeat(1900)} How many credits?`;
    expect(question.length).toBeLessThanOrEqual(ADVISOR_LIMITS.userMessageLength);
    expect(() => checkConversation(dto({ role: 'user', content: question }))).toThrow(BadRequestException);
  });

  it('refuses a message of invisible characters only', () => {
    expect(() => checkConversation(dto({ role: 'user', content: '​​​' }))).toThrow('no visible text');
    expect(() => checkConversation(dto({ role: 'assistant', content: '⁦⁩' }, { role: 'user', content: 'How many credits?' }))).toThrow('no visible text');
  });

  it('accepts a question at the limit', () => {
    expect(() => checkConversation(dto({ role: 'user', content: 'a'.repeat(ADVISOR_LIMITS.userMessageLength) }))).not.toThrow();
  });
});
