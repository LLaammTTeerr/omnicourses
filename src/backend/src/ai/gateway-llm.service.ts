import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { AiCostGuard } from './ai-cost-guard.service.js';
import { aiConfig } from './ai-config.js';
import { AiUnavailableError } from './ai-unavailable.error.js';
import type { ChatEvent, ChatMessage, ChatRequest, ChatTool, StructuredRequest } from './llm.service.js';
import { LlmService } from './llm.service.js';
import { ModelClient, ModelMessage, ModelStreamEvent, ModelToolCall, ModelUsage } from './model-client.js';

const DEFAULT_MAX_STEPS = 5;

/** The JSON Schema sent to the model; `$schema` is dropped because some providers reject it. */
export function toModelSchema(schema: z.ZodType): Record<string, unknown> {
  const { $schema: _ignored, ...rest } = z.toJSONSchema(schema) as Record<string, unknown>;
  return rest;
}

function requireModel(model: string | null): string {
  if (!model) throw new AiUnavailableError('AI is not configured');
  return model;
}

function addUsage(total: ModelUsage, more: ModelUsage): void {
  total.inputTokens += more.inputTokens;
  total.outputTokens += more.outputTokens;
}

// Model output is untrusted input: always parsed, never cast.
function parseReply<T>(content: string, schema: z.ZodType<T>): T | undefined {
  try {
    const parsed = schema.safeParse(JSON.parse(content));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

// Messages come from the browser: the role is only checked at compile time, so a
// client could send a system or tool message. Only user and assistant text passes.
function clientMessages(messages: ChatMessage[]): ModelMessage[] {
  return messages
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map((m) => ({ role: m.role, content: m.content }));
}

type ParsedToolCall = { args: unknown; run: () => Promise<{ ok: boolean; content: string }> };

const toolError = (error: string) => ({ ok: false, content: JSON.stringify({ error }) });

// Split from running, so tool_call reaches the browser before a slow tool runs.
// A bad call is reported back to the model as a tool result, so it can correct
// itself, instead of failing the whole chat.
function parseToolCall(tools: ChatTool<any>[], call: ModelToolCall): ParsedToolCall {
  const failed = (args: unknown, error: string): ParsedToolCall => ({ args, run: async () => toolError(error) });
  const tool = tools.find((t) => t.name === call.name);
  if (!tool) return failed(undefined, `Unknown tool ${call.name}`);
  let raw: unknown;
  try {
    raw = JSON.parse(call.arguments || '{}');
  } catch {
    return failed(undefined, 'Arguments are not valid JSON');
  }
  const parsed = tool.schema.safeParse(raw);
  if (!parsed.success) return failed(raw, `Invalid arguments: ${z.prettifyError(parsed.error)}`);
  return {
    args: parsed.data,
    run: async () => {
      try {
        return { ok: true, content: JSON.stringify((await tool.handler(parsed.data)) ?? null) };
      } catch {
        return toolError('The tool failed');
      }
    },
  };
}

@Injectable()
export class GatewayLlmService extends LlmService {
  private readonly logger = new Logger(GatewayLlmService.name);

  constructor(
    private readonly model: ModelClient,
    private readonly guard: AiCostGuard,
  ) {
    super();
  }

  async structured<T>(request: StructuredRequest<T>): Promise<T> {
    const model = requireModel(aiConfig().structuredModel);
    this.model.assertConfigured();
    const messages: ModelMessage[] = [
      { role: 'system', content: request.instructions },
      { role: 'user', content: request.input },
    ];
    const jsonSchema = { name: 'reply', schema: toModelSchema(request.schema) };
    const usage: ModelUsage = { inputTokens: 0, outputTokens: 0 };
    const started = Date.now();
    let succeeded = false;
    let usageId: string | undefined;
    try {
      // Reserved just before the first model request, so the call counts even
      // if it never finishes (ai-cost-guard.service.ts).
      usageId = await this.guard.reserve(request.context, model);
      // response_format is only a preference on OpenRouter, so a reply can still
      // miss the schema: one retry, then give up.
      for (let attempt = 1; attempt <= 2; attempt++) {
        const reply = await this.model.complete({ model, messages, jsonSchema });
        addUsage(usage, reply.usage);
        const value = parseReply(reply.content, request.schema);
        if (value !== undefined) {
          succeeded = true;
          return value;
        }
      }
      throw new AiUnavailableError('The model returned an unusable reply');
    } catch (error) {
      const failure = this.unavailable(error);
      usageId = await this.releaseIfUnbilled(usageId, failure, usage);
      throw failure;
    } finally {
      await this.finish(usageId, usage, started, succeeded);
    }
  }

  async *chat(request: ChatRequest): AsyncIterable<ChatEvent> {
    const model = requireModel(aiConfig().chatModel);
    this.model.assertConfigured();
    const tools = request.tools ?? [];
    const modelTools = tools.map((t) => ({ name: t.name, description: t.description, parameters: toModelSchema(t.schema) }));
    const maxSteps = request.maxSteps ?? DEFAULT_MAX_STEPS;
    const messages: ModelMessage[] = [{ role: 'system', content: request.instructions }, ...clientMessages(request.messages)];
    const usage: ModelUsage = { inputTokens: 0, outputTokens: 0 };
    const started = Date.now();
    let succeeded = false;
    let usageId: string | undefined;
    try {
      usageId = await this.guard.reserve(request.context, model);
      for (let step = 1; step <= maxSteps; step++) {
        // On the last turn the model has to answer: the tools stay defined, since
        // the history holds tool calls, but tool choice is none.
        const last = step === maxSteps;
        let end: Extract<ModelStreamEvent, { type: 'end' }> | undefined;
        for await (const event of this.model.stream({ model, messages, tools: modelTools, toolChoice: last ? 'none' : 'auto' })) {
          if (event.type === 'text') yield event;
          else end = event;
        }
        if (!end) throw new AiUnavailableError('The model stream ended early');
        addUsage(usage, end.usage);
        if (end.toolCalls.length === 0 || last) {
          succeeded = true;
          yield { type: 'done', text: end.content };
          return;
        }
        messages.push({ role: 'assistant', content: end.content, toolCalls: end.toolCalls });
        for (const call of end.toolCalls) {
          const parsed = parseToolCall(tools, call);
          yield { type: 'tool_call', name: call.name, args: parsed.args };
          const result = await parsed.run();
          yield { type: 'tool_result', name: call.name, ok: result.ok };
          messages.push({ role: 'tool', toolCallId: call.id, content: result.content });
        }
      }
    } catch (error) {
      const failure = this.unavailable(error);
      usageId = await this.releaseIfUnbilled(usageId, failure, usage);
      throw failure;
    } finally {
      // Also runs when the client disconnects and the caller stops iterating.
      // The row was reserved up front, so a stopped call still counts.
      await this.finish(usageId, usage, started, succeeded);
    }
  }

  private unavailable(error: unknown): AiUnavailableError {
    // Provider errors arrive here already converted, and logged by the client.
    if (error instanceof AiUnavailableError) return error;
    // Name only: the error object may carry the prompt (AGENTS.md hard rule 3).
    this.logger.warn(`Unexpected AI gateway error: ${error instanceof Error ? error.name : typeof error}`);
    return new AiUnavailableError();
  }

  /**
   * Releases the reserved call when the provider refused it without billing
   * and no earlier turn was metered. Returns the row id still to finish, or
   * undefined once released. A disconnect never gets here, so it still counts.
   */
  private async releaseIfUnbilled(usageId: string | undefined, failure: AiUnavailableError, usage: ModelUsage): Promise<string | undefined> {
    if (usageId === undefined || failure.billed || usage.inputTokens > 0 || usage.outputTokens > 0) return usageId;
    await this.guard.release(usageId);
    return undefined;
  }

  private async finish(usageId: string | undefined, usage: ModelUsage, started: number, succeeded: boolean): Promise<void> {
    if (usageId === undefined) return;
    // AiCostGuard.finish never throws; this catch keeps that true for any guard,
    // since a throw here would replace the reply or the AiUnavailableError.
    try {
      await this.guard.finish(usageId, { ...usage, latencyMs: Date.now() - started, succeeded });
    } catch (error) {
      this.logger.warn(`Could not record AI usage: ${error instanceof Error ? error.name : typeof error}`);
    }
  }
}
