import { describe, expect, it } from 'vitest';
import { AiUnavailableError } from '../ai/ai-unavailable.error.js';
import { FakeLlmService } from '../ai/testing/fake-llm.service.js';
import { FIXED_REPLIES } from './advisor-prompt.js';
import { advisorFor, collect, summary, TEST_CANARY, TEST_USER_ID } from './testing/advisor-test-kit.js';

const ask = (content: string, language: 'vi' | 'en' = 'en') => ({ language, messages: [{ role: 'user' as const, content }] });

describe('AdvisorService', () => {
  it('refuses an off-topic question with a fixed reply and never calls the model', async () => {
    const llm = new FakeLlmService();
    const { advisor } = advisorFor({ llm });
    const run = summary(await collect(advisor.ask(TEST_USER_ID, ask('Write a Python function to reverse a linked list'))));
    expect(run).toMatchObject({ outcome: 'off_topic', text: FIXED_REPLIES.offTopic.en });
    expect(llm.chatCalls).toHaveLength(0);
  });

  it('asks for consent, without the model, when an own-record question comes without consent', async () => {
    const llm = new FakeLlmService();
    const { advisor } = advisorFor({ llm, consented: false });
    const run = summary(await collect(advisor.ask(TEST_USER_ID, ask('Lộ trình của mình có lỗi gì không?', 'vi'))));
    expect(run).toMatchObject({ outcome: 'needs_consent', text: FIXED_REPLIES.needsConsent.vi });
    expect(llm.chatCalls).toHaveLength(0);
  });

  it('gives the model the retrieved clauses as quoted reference data and passes a cited answer', async () => {
    const answer = 'An Advanced Program student may register at most 22 credits in a main term [[qd-1175-2021/d7/k2/b]].';
    const llm = new FakeLlmService().replyChat({ text: answer });
    const { advisor } = advisorFor({ llm });
    const events = await collect(advisor.ask(TEST_USER_ID, ask('How many credits can I take in a term?')));
    const request = llm.chatCalls[0];
    expect(request.context).toEqual({ userId: TEST_USER_ID, feature: 'advisor' });
    expect(request.instructions).toContain('<clause id="qd-1175-2021/d7/k2/b"');
    expect(request.instructions).toContain('untrusted reference text');
    expect(request.instructions).toContain(TEST_CANARY);
    expect(summary(events)).toMatchObject({ outcome: 'answered', text: answer, cited: ['qd-1175-2021/d7/k2/b'] });
    // Only the vetted answer is streamed, after the guard has read it.
    expect(events.filter((e) => e.type === 'text').map((e) => (e.type === 'text' ? e.delta : '')).join('')).toBe(answer);
  });

  it('replaces an answer that cites a clause it was not given', async () => {
    const llm = new FakeLlmService().replyChat({ text: 'According to [[qd-1175-2021/d99/k1]] you may take 40 credits.' });
    const { advisor } = advisorFor({ llm });
    const run = summary(await collect(advisor.ask(TEST_USER_ID, ask('How many credits can I take in a term?'))));
    expect(run.outcome).toBe('replaced');
    expect(run.reasons).toContain('unknown_citation');
    expect(run.text).toBe(FIXED_REPLIES.ungrounded.en);
    expect(run.text).not.toContain('40');
  });

  it('replaces an empty answer instead of showing nothing as answered', async () => {
    const llm = new FakeLlmService().replyChat({ tool: 'search_regulations', args: { query: 'credit cap' } });
    const { advisor } = advisorFor({ llm });
    const run = summary(await collect(advisor.ask(TEST_USER_ID, ask('How many credits can I take in a term?'))));
    expect(run.outcome).toBe('replaced');
    expect(run.reasons).toEqual(['ungrounded_answer']);
    expect(run.text).toBe(FIXED_REPLIES.ungrounded.en);
  });

  it('offers only the regulation search and the course catalogue without consent, and never reads the record', async () => {
    const llm = new FakeLlmService().replyChat({ text: 'I can only answer from the regulation.' });
    const { advisor, records } = advisorFor({ llm, consented: false });
    await collect(advisor.ask(TEST_USER_ID, ask('How many credits can I take in a term?')));
    expect(llm.chatCalls[0].tools?.map((t) => t.name)).toEqual(['search_regulations', 'get_course']);
    expect(llm.chatCalls[0].instructions).toContain('NOT consented');
    expect(records.calls).toEqual([]);
  });

  it('reads the signed-in student only, through tools that take no user id', async () => {
    const llm = new FakeLlmService().replyChat({ tool: 'get_my_audit', args: {} }, { text: 'The rule engine is not connected yet, so I cannot confirm it.' });
    const { advisor, records } = advisorFor({ llm });
    const events = await collect(advisor.ask(TEST_USER_ID, ask('Can I graduate in 2028 with my credits?')));
    expect(records.calls).toEqual([TEST_USER_ID]);
    expect(events).toContainEqual({ type: 'tool_call', name: 'get_my_audit' });
    const audit = llm.chatCalls[0].tools?.find((t) => t.name === 'get_my_audit');
    expect(audit?.schema.safeParse({ userId: '00000000-0000-4000-8000-000000000002' }).success).toBe(false);
  });

  it('cleans invisible characters from messages before the model sees them', async () => {
    const llm = new FakeLlmService().replyChat({ text: 'See [[qd-1175-2021/d14/k1/a]].' });
    const { advisor } = advisorFor({ llm });
    await collect(advisor.ask(TEST_USER_ID, ask('học​ lại môn bắt buộc', 'vi')));
    expect(llm.chatCalls[0].messages).toEqual([{ role: 'user', content: 'học lại môn bắt buộc' }]);
  });

  it('lets a gateway failure through, so the route answers 503 ai_unavailable', async () => {
    const llm = new FakeLlmService().failWith('The AI provider timed out');
    const { advisor } = advisorFor({ llm });
    await expect(collect(advisor.ask(TEST_USER_ID, ask('How many credits can I take in a term?')))).rejects.toThrow(AiUnavailableError);
  });
});
