import OpenAI from 'openai';
import { Logger } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AiUnavailableError } from './ai-unavailable.error.js';
import { OpenRouterModelClient, toAiUnavailable, toSdkMessages, toStreamParams } from './openrouter-model.client.js';

const apiError = (status: number, body?: Record<string, unknown>) =>
  new OpenAI.APIError(status, body, 'provider said something with the prompt in it', new Headers());

describe('OpenRouterModelClient', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('answers "AI is not configured" without a key instead of crashing', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', '');
    const client = new OpenRouterModelClient();
    await expect(client.complete({ model: 'm', messages: [], jsonSchema: { name: 'reply', schema: {} } })).rejects.toThrow(
      new AiUnavailableError('AI is not configured'),
    );
  });

  it.each([
    [apiError(401), 'AI is not configured', false],
    [apiError(403), 'AI is not configured', false],
    [apiError(402), 'AI credit is used up', false],
    [apiError(429), 'The AI provider is busy, try again shortly', false],
    [apiError(500), 'The AI provider failed', true],
    [new OpenAI.APIConnectionTimeoutError(), 'The AI provider timed out', true],
    [new Error('anything'), 'The AI provider failed', true],
  ])('maps %s to a safe reason that drops the provider message, and says whether it may be billed', (error, reason, billed) => {
    const mapped = toAiUnavailable(error);
    expect(mapped.reason).toBe(reason);
    expect(mapped.billed).toBe(billed);
    expect(JSON.stringify(mapped.getResponse())).not.toContain('prompt');
  });

  it('logs status, code and type of a provider error, never its message', () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    toAiUnavailable(apiError(400, { code: 'model_not_found', type: 'invalid_request_error', message: 'the prompt was: graduate by 2028' }));
    expect(warn).toHaveBeenCalledWith('OpenRouter error: status=400 code=model_not_found type=invalid_request_error');
    toAiUnavailable(apiError(500));
    expect(warn).toHaveBeenLastCalledWith('OpenRouter error: status=500 code=- type=-');
    expect(JSON.stringify(warn.mock.calls)).not.toContain('prompt');
  });

  it('logs a timeout and an unexpected error by kind only', () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    toAiUnavailable(new OpenAI.APIConnectionTimeoutError());
    expect(warn).toHaveBeenLastCalledWith('OpenRouter error: timeout');
    toAiUnavailable(new TypeError('prompt text could be in here'));
    expect(warn).toHaveBeenLastCalledWith('OpenRouter error: TypeError');
    expect(JSON.stringify(warn.mock.calls)).not.toContain('prompt');
  });

  it('keeps sending the tools with tool_choice none when the gateway forces an answer', () => {
    const tools = [{ name: 'search', description: 'Find', parameters: { type: 'object' } }];
    const params = toStreamParams({ model: 'm', messages: [], tools, toolChoice: 'none' });
    expect(params.tools).toEqual([{ type: 'function', function: { name: 'search', description: 'Find', parameters: { type: 'object' } } }]);
    expect(params.tool_choice).toBe('none');
    expect(toStreamParams({ model: 'm', messages: [], tools, toolChoice: 'auto' }).tool_choice).toBe('auto');
  });

  it('sends neither tools nor tool_choice when there are no tools, since some providers reject an empty list', () => {
    const params = toStreamParams({ model: 'm', messages: [], tools: [], toolChoice: 'none' });
    expect(params).not.toHaveProperty('tools');
    expect(params).not.toHaveProperty('tool_choice');
    expect(params.stream_options).toEqual({ include_usage: true });
  });

  it('rebuilds the SDK client when the key or the timeout changes', () => {
    vi.stubEnv('OPENROUTER_API_KEY', 'key-1');
    vi.stubEnv('AI_TIMEOUT_MS', '1000');
    const client = new OpenRouterModelClient();
    const first = client['sdk']();
    expect(client['sdk']()).toBe(first);
    vi.stubEnv('AI_TIMEOUT_MS', '2000');
    const second = client['sdk']();
    expect(second).not.toBe(first);
    expect(second.timeout).toBe(2000);
    vi.stubEnv('OPENROUTER_API_KEY', 'key-2');
    expect(client['sdk']()).not.toBe(second);
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
