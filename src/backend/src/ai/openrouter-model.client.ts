import { Logger } from '@nestjs/common';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam, ChatCompletionStreamParams, ChatCompletionTool } from 'openai/resources/chat/completions';
import { failureKind } from '../common/failure-kind.js';
import { AI_REASONS, AiUnavailableError } from './ai-unavailable.error.js';
import { type CompleteRequest, ModelClient, ModelMessage, ModelStreamEvent, ModelTool, ModelUsage, StreamRequest } from './model-client.js';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1';
const SDK_RETRIES_PER_REQUEST = 1;
const logger = new Logger('OpenRouterModelClient');

export function toSdkMessages(messages: ModelMessage[]): ChatCompletionMessageParam[] {
  return messages.map((message): ChatCompletionMessageParam => {
    if (message.role === 'tool') return { role: 'tool', tool_call_id: message.toolCallId, content: message.content };
    if (message.role === 'assistant' && message.toolCalls?.length) {
      return {
        role: 'assistant',
        content: message.content || null,
        tool_calls: message.toolCalls.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: c.arguments } })),
      };
    }
    return { role: message.role, content: message.content };
  });
}

function toSdkTools(tools: ModelTool[]): ChatCompletionTool[] {
  return tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }));
}

export function toStreamParams(request: StreamRequest): ChatCompletionStreamParams {
  return {
    model: request.model,
    messages: toSdkMessages(request.messages),
    ...(request.tools.length ? { tools: toSdkTools(request.tools), ...(request.toolChoice ? { tool_choice: request.toolChoice } : {}) } : {}),
    stream_options: { include_usage: true },
  };
}

function toUsage(usage: OpenAI.CompletionUsage | undefined | null): ModelUsage {
  return { inputTokens: usage?.prompt_tokens ?? 0, outputTokens: usage?.completion_tokens ?? 0 };
}

export function toAiUnavailable(error: unknown, signal?: AbortSignal): AiUnavailableError {
  if (error instanceof AiUnavailableError) return error;
  if (signal?.aborted || error instanceof OpenAI.APIUserAbortError) {
    return new AiUnavailableError(AI_REASONS.streamEndedEarly);
  }
  if (error instanceof OpenAI.APIConnectionTimeoutError) {
    logger.warn('OpenRouter error: timeout');
    return new AiUnavailableError(AI_REASONS.timedOut);
  }
  if (error instanceof OpenAI.APIConnectionError) {
    logger.warn('OpenRouter error: connection');
    return new AiUnavailableError(AI_REASONS.providerFailed);
  }
  if (error instanceof OpenAI.APIError) {
    logger.warn(`OpenRouter error: status=${error.status ?? '-'} code=${error.code ?? '-'} type=${error.type ?? '-'}`);
    if (error.status === 401 || error.status === 403) return new AiUnavailableError(AI_REASONS.notConfigured, { billed: false });
    if (error.status === 402) return new AiUnavailableError(AI_REASONS.creditUsedUp, { billed: false });
    if (error.status === 429) return new AiUnavailableError(AI_REASONS.busy, { billed: false });
    if (error.status === 400 || error.status === 404) return new AiUnavailableError(AI_REASONS.providerFailed, { billed: false });
    return new AiUnavailableError(AI_REASONS.providerFailed);
  }
  logger.warn(`OpenRouter error: ${failureKind(error)}`);
  return new AiUnavailableError(AI_REASONS.providerFailed);
}

export class OpenRouterModelClient extends ModelClient {
  private readonly sdk: OpenAI;

  constructor(apiKey: string, timeoutMs: number) {
    super();
    this.sdk = new OpenAI({ apiKey, baseURL: OPENROUTER_URL, timeout: timeoutMs, maxRetries: SDK_RETRIES_PER_REQUEST, defaultHeaders: { 'X-Title': 'OmniCourse' } });
  }

  async complete(request: CompleteRequest): Promise<{ content: string; usage: ModelUsage }> {
    try {
      const completion = await this.sdk.chat.completions.create(
        {
          model: request.model,
          messages: toSdkMessages(request.messages),
          response_format: { type: 'json_schema', json_schema: { name: request.jsonSchema.name, schema: request.jsonSchema.schema, strict: true } },
        },
        { signal: request.signal },
      );
      return { content: completion.choices[0]?.message.content ?? '', usage: toUsage(completion.usage) };
    } catch (error) {
      throw toAiUnavailable(error, request.signal);
    }
  }

  async *stream(request: StreamRequest): AsyncIterable<ModelStreamEvent> {
    try {
      const stream = this.sdk.chat.completions.stream(toStreamParams(request), { signal: request.signal });
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
      const completion = await stream.finalChatCompletion();
      const message = completion.choices[0]?.message;
      const toolCalls = (message?.tool_calls ?? [])
        .filter((c) => c.type === 'function')
        .map((c) => ({ id: c.id, name: c.function.name, arguments: c.function.arguments }));
      yield { type: 'end', content: message?.content ?? '', toolCalls, usage: toUsage(completion.usage) };
    } catch (error) {
      throw toAiUnavailable(error, request.signal);
    }
  }
}
