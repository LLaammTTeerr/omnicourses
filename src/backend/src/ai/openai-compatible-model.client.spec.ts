import OpenAI from 'openai';
import { Logger } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sdkOptions, toAiUnavailable, toSdkMessages, toStreamParams } from './openai-compatible-model.client.js';

const apiError = (status: number, body?: Record<string, unknown>) =>
  new OpenAI.APIError(status, body, 'provider said something with the prompt in it', new Headers());

describe('OpenAiCompatibleModelClient', () => {
  afterEach(() => vi.restoreAllMocks());

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
    expect(warn).toHaveBeenCalledWith('Model provider error: status=400 code=model_not_found type=invalid_request_error');
    toAiUnavailable(apiError(500));
    expect(warn).toHaveBeenLastCalledWith('Model provider error: status=500 code=- type=-');
    expect(JSON.stringify(warn.mock.calls)).not.toContain('prompt');
  });

  it('logs a timeout and an unexpected error by kind only', () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    toAiUnavailable(new OpenAI.APIConnectionTimeoutError());
    expect(warn).toHaveBeenLastCalledWith('Model provider error: timeout');
    toAiUnavailable(new TypeError('prompt text could be in here'));
    expect(warn).toHaveBeenLastCalledWith('Model provider error: TypeError');
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

  it('sends an explicit output cap, which Anthropic requires', () => {
    expect(toStreamParams({ model: 'm', messages: [], tools: [] }, 2048).max_tokens).toBe(2048);
  });

  it('points the SDK at the configured provider and sends the OpenRouter header only to OpenRouter', () => {
    const settings = { timeoutMs: 1000, maxOutputTokens: 100 };
    expect(sdkOptions('k', { ...settings, provider: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1' })).toMatchObject({
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: { 'X-Title': 'OmniCourse' },
    });
    const anthropic = sdkOptions('k', { ...settings, provider: 'anthropic', baseUrl: 'https://api.anthropic.com/v1/' });
    expect(anthropic).toMatchObject({ baseURL: 'https://api.anthropic.com/v1/', timeout: 1000, maxRetries: 1 });
    expect(anthropic).not.toHaveProperty('defaultHeaders');
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
