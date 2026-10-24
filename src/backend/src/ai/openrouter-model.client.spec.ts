import OpenAI from 'openai';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AiUnavailableError } from './ai-unavailable.error.js';
import { OpenRouterModelClient, toAiUnavailable, toSdkMessages } from './openrouter-model.client.js';

const apiError = (status: number) => new OpenAI.APIError(status, undefined, 'provider said something with the prompt in it', new Headers());

describe('OpenRouterModelClient', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('answers "AI is not configured" without a key instead of crashing', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', '');
    const client = new OpenRouterModelClient();
    await expect(client.complete({ model: 'm', messages: [], jsonSchema: { name: 'reply', schema: {} } })).rejects.toThrow(
      new AiUnavailableError('AI is not configured'),
    );
  });

  it.each([
    [apiError(401), 'AI is not configured'],
    [apiError(402), 'AI credit is used up'],
    [apiError(429), 'The AI provider is busy, try again shortly'],
    [apiError(500), 'The AI provider failed'],
    [new OpenAI.APIConnectionTimeoutError(), 'The AI provider timed out'],
    [new Error('anything'), 'The AI provider failed'],
  ])('maps %s to a safe reason that drops the provider message', (error, reason) => {
    const mapped = toAiUnavailable(error);
    expect(mapped.reason).toBe(reason);
    expect(JSON.stringify(mapped.getResponse())).not.toContain('prompt');
  });

  it('converts tool calls and tool results to the OpenAI wire format', () => {
    expect(
      toSdkMessages([
        { role: 'system', content: 'sys' },
        { role: 'assistant', content: '', toolCalls: [{ id: 'c1', name: 'search', arguments: '{"q":"x"}' }] },
        { role: 'tool', toolCallId: 'c1', content: '{"hit":1}' },
      ]),
    ).toEqual([
      { role: 'system', content: 'sys' },
      { role: 'assistant', content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'search', arguments: '{"q":"x"}' } }] },
      { role: 'tool', tool_call_id: 'c1', content: '{"hit":1}' },
    ]);
  });
});
