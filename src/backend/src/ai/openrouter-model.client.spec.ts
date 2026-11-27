import OpenAI from 'openai';
import { Logger } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AI_REASONS, AiUnavailableError } from './ai-unavailable.error.js';
import { OpenRouterModelClient, toAiUnavailable, toSdkMessages, toStreamParams } from './openrouter-model.client.js';

const apiError = (status: number, body?: Record<string, unknown>) =>
  new OpenAI.APIError(status, body, 'provider said something with the prompt in it', new Headers());

describe('OpenRouterModelClient', () => {
  afterEach(() => vi.restoreAllMocks());

  it.each([
    [apiError(400), 'The AI provider failed', false],
    [apiError(401), 'AI is not configured', false],
    [apiError(403), 'AI is not configured', false],
    [apiError(402), 'AI credit is used up', false],
    [apiError(404), 'The AI provider failed', false],
    [apiError(429), 'The AI provider is busy, try again shortly', false],
    [apiError(500), 'The AI provider failed', true],
    [new OpenAI.APIConnectionTimeoutError(), 'The AI provider timed out', true],
    [new OpenAI.APIConnectionError({ message: 'connection refused with prompt' }), 'The AI provider failed', false],
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

  it('logs timeout, connection and unexpected errors by kind only', () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    toAiUnavailable(new OpenAI.APIConnectionTimeoutError());
    expect(warn).toHaveBeenLastCalledWith('OpenRouter error: timeout');
    toAiUnavailable(new OpenAI.APIConnectionError({ message: 'ECONNREFUSED prompt' }));
    expect(warn).toHaveBeenLastCalledWith('OpenRouter error: connection');
    toAiUnavailable(new TypeError('prompt text could be in here'));
    expect(warn).toHaveBeenLastCalledWith('OpenRouter error: TypeError');
    expect(JSON.stringify(warn.mock.calls)).not.toContain('prompt');
  });

  it('maps aborted requests to streamEndedEarly', () => {
    const controller = new AbortController();
    controller.abort();
    expect(toAiUnavailable(new Error('aborted'), controller.signal)).toEqual(new AiUnavailableError(AI_REASONS.streamEndedEarly));
    expect(toAiUnavailable(new OpenAI.APIUserAbortError())).toEqual(new AiUnavailableError(AI_REASONS.streamEndedEarly));
  });

  it('forwards AbortSignal to SDK complete and stream calls and maps abort errors to streamEndedEarly', async () => {
    const client = new OpenRouterModelClient('test-key', 5000);
    const sdk = (client as unknown as { sdk: OpenAI }).sdk;
    const controller = new AbortController();

    const createSpy = vi.spyOn(sdk.chat.completions, 'create').mockResolvedValueOnce({
      choices: [{ message: { content: '{"ok":true}' } }],
      usage: { prompt_tokens: 4, completion_tokens: 2 },
    } as never);

    const completed = await client.complete({
      model: 'test-model',
      messages: [{ role: 'user', content: 'hi' }],
      jsonSchema: { name: 'reply', schema: { type: 'object' } },
      signal: controller.signal,
    });
    expect(completed).toEqual({ content: '{"ok":true}', usage: { inputTokens: 4, outputTokens: 2 } });
    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({ model: 'test-model' }), { signal: controller.signal });

    const abortMock = vi.fn();
    const streamSpy = vi.spyOn(sdk.chat.completions, 'stream').mockReturnValueOnce({
      async *[Symbol.asyncIterator]() {
        yield { choices: [{ delta: { content: 'Hello' } }] };
      },
      abort: abortMock,
      finalChatCompletion: async () => ({
        choices: [{ message: { content: 'Hello', tool_calls: [] } }],
        usage: { prompt_tokens: 3, completion_tokens: 1 },
      }),
    } as never);

    const events = [];
    for await (const event of client.stream({ model: 'test-model', messages: [{ role: 'user', content: 'hi' }], tools: [], signal: controller.signal })) {
      events.push(event);
    }
    expect(events).toEqual([
      { type: 'text', delta: 'Hello' },
      { type: 'end', content: 'Hello', toolCalls: [], usage: { inputTokens: 3, outputTokens: 1 } },
    ]);
    expect(streamSpy).toHaveBeenCalledWith(expect.objectContaining({ model: 'test-model' }), { signal: controller.signal });

    controller.abort();
    createSpy.mockRejectedValueOnce(new Error('This operation was aborted'));
    await expect(
      client.complete({
        model: 'test-model',
        messages: [{ role: 'user', content: 'hi' }],
        jsonSchema: { name: 'reply', schema: { type: 'object' } },
        signal: controller.signal,
      }),
    ).rejects.toEqual(new AiUnavailableError(AI_REASONS.streamEndedEarly));

    streamSpy.mockReturnValueOnce({
      async *[Symbol.asyncIterator]() {
        yield* [];
        throw new Error('This operation was aborted');
      },
      abort: abortMock,
      finalChatCompletion: vi.fn(),
    } as never);
    await expect(async () => {
      for await (const _event of client.stream({ model: 'test-model', messages: [{ role: 'user', content: 'hi' }], tools: [], signal: controller.signal })) {
        void _event;
      }
    }).rejects.toEqual(new AiUnavailableError(AI_REASONS.streamEndedEarly));
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
