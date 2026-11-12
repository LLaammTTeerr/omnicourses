import { describe, expect, it } from 'vitest';
import { AiUnavailableError } from '../ai/ai-unavailable.error.js';
import { type ChatEvent, LlmService, type StructuredRequest } from '../ai/llm.service.js';
import { FakeLlmService } from '../ai/testing/fake-llm.service.js';
import { ADVISOR_BADGE, FIXED_REPLIES, PROMPT_VERSION, REDACTION_NOTICE } from './advisor-prompt.js';
import { advisorFor, ask, modelTextOutsideExplanation, reply, summary, TEST_CANARY, TEST_USER_ID } from './testing/advisor-test-kit.js';

const q = (content: string) => [{ role: 'user' as const, content }];
const CAP = 'How many credits can I take in a term?';
const EXPLAIN = 'This passage sets the credit limits per term for each type of programme.';

describe('AdvisorService', () => {
  it('refuses an off-topic question with a fixed reply and the badge, and never calls the model', async () => {
    const llm = new FakeLlmService();
    const { advisor } = advisorFor({ llm });
    const answer = await ask(advisor, 'en', q('Write a Python function to reverse a linked list'));
    expect(answer).toEqual({
      outcome: 'off_topic',
      segments: [{ kind: 'notice', text: FIXED_REPLIES.offTopic.en, citation: null }],
      badge: ADVISOR_BADGE.en,
      reasons: [],
      promptVersion: PROMPT_VERSION,
    });
    expect(llm.chatCalls).toHaveLength(0);
  });

  it('asks for consent, without the model, when an own-record question comes without consent', async () => {
    const llm = new FakeLlmService();
    const { advisor } = advisorFor({ llm, consented: false });
    const run = summary(await ask(advisor, 'vi', q('Lộ trình của mình có lỗi gì không?')));
    expect(run).toMatchObject({ outcome: 'needs_consent', notices: [FIXED_REPLIES.needsConsent.vi] });
    expect(llm.chatCalls).toHaveLength(0);
  });

  it('gives the model the retrieved clauses as quoted reference data, and shows the passages it picks word for word', async () => {
    const llm = new FakeLlmService().replyChat(reply({ passageIds: ['qd-1175-2021/d7/k2/b'], explanation: EXPLAIN }));
    const { advisor } = advisorFor({ llm });
    const answer = await ask(advisor, 'en', q(CAP));
    const request = llm.chatCalls[0];
    expect(request.context).toEqual({ userId: TEST_USER_ID, feature: 'advisor' });
    expect(request.instructions).toContain('<clause id="qd-1175-2021/d7/k2/b"');
    expect(request.instructions).toContain('untrusted reference text');
    expect(request.instructions).toContain(TEST_CANARY);
    expect(summary(answer)).toMatchObject({ outcome: 'answered', reasons: [], passages: ['qd-1175-2021/d7/k2/b'], explanation: EXPLAIN });
    expect(answer.segments.map((s) => s.kind)).toEqual(['passage', 'explanation']);
    expect(answer.badge).toBe(ADVISOR_BADGE.en);
    expect(modelTextOutsideExplanation(answer, 'en')).toEqual([]);
  });

  it('drops a passage id it was not given, and the explanation of that answer, but shows the rest', async () => {
    const llm = new FakeLlmService().replyChat(reply({ passageIds: ['qd-1175-2021/d99/k1', 'qd-1175-2021/d7/k2/b'], explanation: EXPLAIN }));
    const { advisor } = advisorFor({ llm });
    const run = summary(await ask(advisor, 'en', q(CAP)));
    expect(run).toMatchObject({ outcome: 'partial', reasons: ['unknown_passage'], passages: ['qd-1175-2021/d7/k2/b'], explanation: null });
    expect(run.notices).toEqual([FIXED_REPLIES.explanationWithheld.en]);
  });

  it('shows the could-not-check reply and the retrieved passages when the final message is not the JSON answer', async () => {
    const llm = new FakeLlmService().replyChat({ text: 'An Advanced Program student may register at most 22 credits [[qd-1175-2021/d7/k2/b]].' });
    const { advisor } = advisorFor({ llm });
    const answer = await ask(advisor, 'en', q(CAP));
    const run = summary(answer);
    expect(run).toMatchObject({ outcome: 'replaced', reasons: ['unparseable'], explanation: null, notices: [FIXED_REPLIES.ungrounded.en] });
    expect(run.passages.length).toBeGreaterThan(0);
    expect(run.text).not.toContain('Advanced Program');
    expect(modelTextOutsideExplanation(answer, 'en')).toEqual([]);
  });

  it('shows the could-not-check reply for an empty answer', async () => {
    const llm = new FakeLlmService().replyChat({ tool: 'search_regulations', args: { query: 'credit cap' } });
    const { advisor } = advisorFor({ llm });
    expect(summary(await ask(advisor, 'en', q(CAP)))).toMatchObject({ outcome: 'replaced', reasons: ['unparseable'] });
  });

  it('shows the fixed text of a refusal the model picks, never words of its own', async () => {
    const llm = new FakeLlmService().replyChat(reply({ refusal: 'cannot_act' }));
    const { advisor } = advisorFor({ llm });
    const run = summary(await ask(advisor, 'en', q('Register me for CSC10002 next term, how many credits can I take?')));
    expect(run).toMatchObject({ outcome: 'answered', notices: [FIXED_REPLIES.cannotAct.en], passages: [], explanation: null });
  });

  it('offers only the regulation search and the course catalogue without consent, and never reads the record', async () => {
    const llm = new FakeLlmService().replyChat(reply({ refusal: 'no_source' }));
    const { advisor, records } = advisorFor({ llm, consented: false });
    await ask(advisor, 'en', q(CAP));
    expect(llm.chatCalls[0].tools?.map((t) => t.name)).toEqual(['search_regulations', 'get_course']);
    expect(llm.chatCalls[0].instructions).toContain('NOT consented');
    expect(records.calls).toEqual([]);
  });

  it('reads the signed-in student only, and shows the record and the engine’s state in the server’s words', async () => {
    const llm = new FakeLlmService().replyChat({ tool: 'get_my_audit', args: {} }, reply({ engineFacts: ['record:MTH00003:2024-1', 'audit:unavailable'], explanation: null }));
    const { advisor, records } = advisorFor({ llm });
    const answer = await ask(advisor, 'en', q('Can I graduate in 2028 with my credits?'));
    expect(records.calls).toEqual([TEST_USER_ID]);
    expect(summary(answer).facts).toEqual([
      'Your transcript: MTH00003, 3 credits, term 1 of 2024–2025, graded, grade 4.5.',
      "The rule engine's degree audit is not connected to the advisor yet, so OmniCourse cannot confirm this for you. The academic affairs office can.",
    ]);
    const audit = llm.chatCalls[0].tools?.find((t) => t.name === 'get_my_audit');
    expect(audit?.schema.safeParse({ userId: '00000000-0000-4000-8000-000000000002' }).success).toBe(false);
  });

  it('cleans invisible characters from messages before the model sees them', async () => {
    const llm = new FakeLlmService().replyChat(reply({ passageIds: ['qd-1175-2021/d14/k1/a'] }));
    const { advisor } = advisorFor({ llm });
    await ask(advisor, 'vi', q('học​ lại môn bắt buộc'));
    expect(llm.chatCalls[0].messages).toEqual([{ role: 'user', content: 'học lại môn bắt buộc' }]);
  });

  it('lets a gateway failure through, so the route answers 503 ai_unavailable', async () => {
    const llm = new FakeLlmService().failWith('The AI provider timed out');
    const { advisor } = advisorFor({ llm });
    await expect(ask(advisor, 'en', q(CAP))).rejects.toThrow(AiUnavailableError);
  });

  it('stops reading the model once the request is aborted, and shows nothing it wrote', async () => {
    const llm = new FakeLlmService().replyChat({ tool: 'search_regulations', args: { query: 'credit cap' } }, reply({ passageIds: ['qd-1175-2021/d7/k2/b'] }));
    const { advisor } = advisorFor({ llm });
    const aborted = new AbortController();
    aborted.abort();
    const answer = await advisor.ask(TEST_USER_ID, { language: 'en', messages: q(CAP) }, aborted.signal);
    expect(answer.outcome).toBe('replaced');
  });

  it('ends the model request at its next event once the tab is closed, and shows nothing it wrote', async () => {
    const aborted = new AbortController();
    const pulled: string[] = [];
    let finished = false;
    class SlowModel extends LlmService {
      async structured<T>(_r: StructuredRequest<T>): Promise<T> {
        throw new AiUnavailableError('unused');
      }
      async *chat(): AsyncIterable<ChatEvent> {
        try {
          for (const delta of ['{"refusal": null, ', '"passageIds": [], ', '"engineFacts": [], ', '"explanation": null}']) {
            pulled.push(delta);
            if (pulled.length === 2) aborted.abort();
            yield { type: 'text', delta };
          }
          yield { type: 'done', text: pulled.join('') };
        } finally {
          finished = true;
        }
      }
    }
    const { advisor } = advisorFor({ llm: new SlowModel() });
    const answer = await advisor.ask(TEST_USER_ID, { language: 'en', messages: q(CAP) }, aborted.signal);
    expect(pulled).toHaveLength(2);
    expect(finished).toBe(true);
    expect(answer.outcome).toBe('replaced');
  });

  // Hard rule 3 (ADR 0015): what the student types is redacted before the provider sees it, in the
  // question and in the history, and the answer starts with a notice not to share such data.
  it('never sends a typed password, student ID, email or phone to the provider, and says so', async () => {
    const llm = new FakeLlmService().replyChat(reply({ passageIds: ['qd-1175-2021/d7/k2/b'] }));
    const { advisor } = advisorFor({ llm });
    const messages = [
      { role: 'user' as const, content: 'My email is synthetic.student@example.com' },
      { role: 'assistant' as const, content: 'Noted.' },
      { role: 'user' as const, content: `My MSSV is 21127001 and portal password is Synth3tic!Pass. ${CAP} Phone 0900000000.` },
    ];
    const answer = await ask(advisor, 'en', messages);
    const sent = JSON.stringify(llm.chatCalls[0].messages);
    for (const secret of ['synthetic.student@example.com', '21127001', 'Synth3tic!Pass', '0900000000']) expect(sent).not.toContain(secret);
    expect(answer.segments[0]).toEqual({ kind: 'notice', text: REDACTION_NOTICE.en, citation: null });
    expect(answer.outcome).toBe('answered');
  });

  it('adds no notice when nothing was redacted', async () => {
    const llm = new FakeLlmService().replyChat(reply({ passageIds: ['qd-1175-2021/d7/k2/b'] }));
    const { advisor } = advisorFor({ llm });
    expect(summary(await ask(advisor, 'en', q(CAP))).notices).toEqual([]);
  });

  it('sends only the student’s own turns without consent, so no earlier answer about their record leaves the server', async () => {
    const messages = [
      { role: 'user' as const, content: 'What happens if I fail a compulsory course? Check my record.' },
      { role: 'assistant' as const, content: 'Your record shows MTH00003 with a grade of 4.5 [[qd-1175-2021/d14/k1/b]].' },
      { role: 'user' as const, content: 'And how does improving a grade work?' },
    ];
    for (const consented of [false, true]) {
      const llm = new FakeLlmService().replyChat(reply({ refusal: 'no_source' }));
      const { advisor } = advisorFor({ llm, consented });
      await ask(advisor, 'en', messages);
      const sent = llm.chatCalls[0].messages;
      expect(sent.map((m) => m.role)).toEqual(consented ? ['user', 'assistant', 'user'] : ['user', 'user']);
      expect(JSON.stringify(sent).includes('MTH00003')).toBe(consented);
    }
  });
});
