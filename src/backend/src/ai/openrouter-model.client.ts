import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import { aiConfig } from './ai-config.js';
import { AiUnavailableError } from './ai-unavailable.error.js';
import { ModelClient, ModelMessage, ModelStreamEvent, ModelTool, ModelUsage } from './model-client.js';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1';

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

function toUsage(usage: OpenAI.CompletionUsage | undefined | null): ModelUsage {
  return { inputTokens: usage?.prompt_tokens ?? 0, outputTokens: usage?.completion_tokens ?? 0 };
}

// Status and cause only. The SDK error can carry the request, which holds the
// student's text, so it never reaches a log or a response (AGENTS.md hard rule 3).
export function toAiUnavailable(error: unknown): AiUnavailableError {
  if (error instanceof AiUnavailableError) return error;
  if (error instanceof OpenAI.APIConnectionTimeoutError) return new AiUnavailableError('The AI provider timed out');
  if (error instanceof OpenAI.APIError) {
    if (error.status === 401 || error.status === 403) return new AiUnavailableError('AI is not configured');
    if (error.status === 402) return new AiUnavailableError('AI credit is used up');
    if (error.status === 429) return new AiUnavailableError('The AI provider is busy, try again shortly');
  }
  return new AiUnavailableError('The AI provider failed');
}

// OpenRouter through the OpenAI SDK (ADR 0003). The no-training guarantee is the
// OpenRouter account's privacy setting, not a request field.
@Injectable()
export class OpenRouterModelClient extends ModelClient {
  private client?: { key: string; sdk: OpenAI };

  // Built on first use: the SDK throws without a key, and a missing key must
  // mean 503 at call time, not a crash at startup.
  private sdk(): OpenAI {
    const { apiKey, timeoutMs } = aiConfig();
    if (!apiKey) throw new AiUnavailableError('AI is not configured');
    if (this.client?.key !== apiKey) {
      this.client = {
        key: apiKey,
        sdk: new OpenAI({ apiKey, baseURL: OPENROUTER_URL, timeout: timeoutMs, maxRetries: 1, defaultHeaders: { 'X-Title': 'OmniCourse' } }),
      };
    }
    return this.client.sdk;
  }

  assertConfigured(): void {
    if (!aiConfig().apiKey) throw new AiUnavailableError('AI is not configured');
  }

  async complete(request: Parameters<ModelClient['complete']>[0]): Promise<{ content: string; usage: ModelUsage }> {
    try {
      const completion = await this.sdk().chat.completions.create({
        model: request.model,
        messages: toSdkMessages(request.messages),
        response_format: { type: 'json_schema', json_schema: { name: request.jsonSchema.name, schema: request.jsonSchema.schema, strict: true } },
      });
      return { content: completion.choices[0]?.message.content ?? '', usage: toUsage(completion.usage) };
    } catch (error) {
      throw toAiUnavailable(error);
    }
  }

  async *stream(request: Parameters<ModelClient['stream']>[0]): AsyncIterable<ModelStreamEvent> {
    try {
      const stream = this.sdk().chat.completions.stream({
        model: request.model,
        messages: toSdkMessages(request.messages),
        // Some providers reject an empty tools array.
        ...(request.tools.length ? { tools: toSdkTools(request.tools) } : {}),
        stream_options: { include_usage: true },
      });
      let finished = false;
      try {
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) yield { type: 'text', delta };
        }
        finished = true;
      } finally {
        // Stops the HTTP request when the caller stops early (client disconnected).
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
