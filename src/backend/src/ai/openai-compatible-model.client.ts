import { Logger } from '@nestjs/common';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam, ChatCompletionStreamParams, ChatCompletionTool } from 'openai/resources/chat/completions';
import { AI_REASONS, AiUnavailableError } from './ai-unavailable.error.js';
import { logErrorName } from './log-error-name.js';
import type { AiConfig } from './ai-config.js';
import { ModelClient, ModelMessage, ModelStreamEvent, ModelTool, ModelUsage, StreamRequest } from './model-client.js';

const logger = new Logger('OpenAiCompatibleModelClient');

export function toSdkMessages(messages: ModelMessage[]): ChatCompletionMessageParam[] {
  return messages.map((m): ChatCompletionMessageParam => {
    if (m.role === 'tool') return { role: 'tool', tool_call_id: m.toolCallId, content: m.content };
    if (m.role === 'assistant' && m.toolCalls?.length) {
      return {
        role: 'assistant',
        // null, not '': some providers (Anthropic) reject an empty text block.
        content: m.content || null,
        tool_calls: m.toolCalls.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: c.arguments } })),
      };
    }
    return { role: m.role, content: m.content };
  });
}

function toSdkTools(tools: ModelTool[]): ChatCompletionTool[] {
  return tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }));
}

export function toStreamParams(request: StreamRequest, maxOutputTokens = 8192): ChatCompletionStreamParams {
  return {
    model: request.model,
    // Anthropic's compatibility layer needs an explicit cap; OpenRouter accepts it.
    max_tokens: maxOutputTokens,
    messages: toSdkMessages(request.messages),
    // Some providers reject an empty tools array, and tool_choice without tools.
    ...(request.tools.length ? { tools: toSdkTools(request.tools), ...(request.toolChoice ? { tool_choice: request.toolChoice } : {}) } : {}),
    stream_options: { include_usage: true },
  };
}

function toUsage(usage: OpenAI.CompletionUsage | undefined | null): ModelUsage {
  return { inputTokens: usage?.prompt_tokens ?? 0, outputTokens: usage?.completion_tokens ?? 0 };
}

// Status and cause only. The SDK error can carry the request, which holds the
// student's text, so its message never reaches a log or a response (AGENTS.md
// hard rule 3). The log line lets an operator tell a wrong model slug or a
// context-length 400 from an outage.
export function toAiUnavailable(error: unknown): AiUnavailableError {
  if (error instanceof AiUnavailableError) return error;
  if (error instanceof OpenAI.APIConnectionTimeoutError) {
    logger.warn('Model provider error: timeout');
    return new AiUnavailableError(AI_REASONS.timedOut);
  }
  if (error instanceof OpenAI.APIError) {
    logger.warn(`Model provider error: status=${error.status ?? '-'} code=${error.code ?? '-'} type=${error.type ?? '-'}`);
    // Refused before any work, so not billed: the call must not count.
    if (error.status === 401 || error.status === 403) return new AiUnavailableError(AI_REASONS.notConfigured, { billed: false });
    if (error.status === 402) return new AiUnavailableError(AI_REASONS.creditUsedUp, { billed: false });
    if (error.status === 429) return new AiUnavailableError(AI_REASONS.busy, { billed: false });
    return new AiUnavailableError(AI_REASONS.providerFailed);
  }
  logErrorName(logger, 'Model provider error', error);
  return new AiUnavailableError(AI_REASONS.providerFailed);
}

export type ClientSettings = Pick<AiConfig, 'provider' | 'baseUrl' | 'timeoutMs' | 'maxOutputTokens'>;

/** The SDK options for a provider. `baseUrl` is one of the allowlisted AI_BASE_URLS (config/env.ts). */
export function sdkOptions(apiKey: string, settings: ClientSettings): ConstructorParameters<typeof OpenAI>[0] {
  return {
    apiKey,
    baseURL: settings.baseUrl,
    timeout: settings.timeoutMs,
    maxRetries: 1,
    // OpenRouter's app attribution header; other providers get no extra header.
    ...(settings.provider === 'openrouter' ? { defaultHeaders: { 'X-Title': 'OmniCourse' } } : {}),
  };
}

// An OpenAI-compatible provider through the OpenAI SDK (ADR 0003 and its note of
// 2026-11-09): OpenRouter, or Anthropic's compatibility layer. The no-training
// guarantee is an account setting of the provider, not a request field.
export class OpenAiCompatibleModelClient extends ModelClient {
  private readonly sdk: OpenAI;
  private readonly maxOutputTokens: number;

  constructor(apiKey: string, settings: ClientSettings) {
    super();
    this.sdk = new OpenAI(sdkOptions(apiKey, settings));
    this.maxOutputTokens = settings.maxOutputTokens;
  }

  async complete(request: Parameters<ModelClient['complete']>[0]): Promise<{ content: string; usage: ModelUsage }> {
    try {
      const completion = await this.sdk.chat.completions.create({
        model: request.model,
        max_tokens: this.maxOutputTokens,
        messages: toSdkMessages(request.messages),
        response_format: { type: 'json_schema', json_schema: { name: request.jsonSchema.name, schema: request.jsonSchema.schema, strict: true } },
      });
      return { content: completion.choices[0]?.message.content ?? '', usage: toUsage(completion.usage) };
    } catch (error) {
      throw toAiUnavailable(error);
    }
  }

  async *stream(request: StreamRequest): AsyncIterable<ModelStreamEvent> {
    try {
      const stream = this.sdk.chat.completions.stream(toStreamParams(request, this.maxOutputTokens));
      let finished = false;
      try {
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) yield { type: 'text', delta };
        }
        finished = true;
      } finally {
        if (!finished) stream.abort();
      }
      // The SDK assembles the streamed tool-call fragments.
      const completion = await stream.finalChatCompletion();
      const message = completion.choices[0]?.message;
      const toolCalls = (message?.tool_calls ?? [])
        .filter((c) => c.type === 'function')
        .map((c) => ({ id: c.id, name: c.function.name, arguments: c.function.arguments }));
      yield { type: 'end', content: message?.content ?? '', toolCalls, usage: toUsage(completion.usage) };
    } catch (error) {
      throw toAiUnavailable(error);
    }
  }
}
