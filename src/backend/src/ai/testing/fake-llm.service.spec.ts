import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { AiUnavailableError } from '../ai-unavailable.error.js';
import type { ChatEvent } from '../llm.service.js';
import { FakeLlmService } from './fake-llm.service.js';

const context = { userId: 'u1', feature: 'test' };

describe('FakeLlmService', () => {
  it('returns scripted structured replies through the caller schema', async () => {
    const llm = new FakeLlmService().replyStructured({ creditsPerTerm: 18 }, { creditsPerTerm: 'x' });
    const schema = z.object({ creditsPerTerm: z.number() });
    await expect(llm.structured({ context, instructions: '', input: '', schema })).resolves.toEqual({ creditsPerTerm: 18 });
    await expect(llm.structured({ context, instructions: '', input: '', schema })).rejects.toThrow(new AiUnavailableError('The model returned an unusable reply'));
    expect(llm.structuredCalls).toHaveLength(2);
  });

  it('runs the caller tool handler for scripted tool steps', async () => {
    const handler = vi.fn(async () => ({ clause: 'Article 10' }));
    const llm = new FakeLlmService().replyChat({ tool: 'search', args: { query: 'cap' } }, { text: 'Up to 25.' });
    const events: ChatEvent[] = [];
    for await (const event of llm.chat({ context, instructions: '', messages: [], tools: [{ name: 'search', description: '', schema: z.object({ query: z.string() }), handler }] })) {
      events.push(event);
    }
    expect(handler).toHaveBeenCalledWith({ query: 'cap' });
    expect(events[0]).toEqual({ type: 'tool_call', name: 'search', args: { query: 'cap' } });
    expect(events.at(-1)).toEqual({ type: 'done', text: 'Up to 25.' });
  });

  it('reports a call to an unknown tool or with rejected arguments as a failed tool result, without running the handler', async () => {
    const handler = vi.fn(async () => ({}));
    const tools = [{ name: 'search', description: '', schema: z.strictObject({ query: z.string() }), handler }];
    const llm = new FakeLlmService().replyChat({ tool: 'search', args: { query: 'x', userId: 'someone-else' } }, { tool: 'delete_everything', args: {} }, { text: 'ok' });
    const events: ChatEvent[] = [];
    for await (const event of llm.chat({ context, instructions: '', messages: [], tools })) events.push(event);
    expect(handler).not.toHaveBeenCalled();
    expect(events.filter((e) => e.type === 'tool_result')).toEqual([
      { type: 'tool_result', name: 'search', ok: false },
      { type: 'tool_result', name: 'delete_everything', ok: false },
    ]);
  });

  it('fails like the real gateway', async () => {
    const llm = new FakeLlmService().failWith('The AI provider timed out');
    await expect(llm.structured({ context, instructions: '', input: '', schema: z.object({}) })).rejects.toThrow(new AiUnavailableError('The AI provider timed out'));
  });
});
