import { Inject, Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { AI_CONFIG, type AiConfig } from './ai-config.js';
import { AiCostGuard } from './ai-cost-guard.service.js';
import { AI_REASONS, AiUnavailableError } from './ai-unavailable.error.js';
import type { ChatEvent, ChatMessage, ChatRequest, ChatTool, StructuredRequest } from './llm.service.js';
import { LlmService } from './llm.service.js';
import { logErrorName } from './log-error-name.js';
import { ModelClient, ModelMessage, ModelStreamEvent, ModelToolCall, ModelUsage } from './model-client.js';

const DEFAULT_MAX_STEPS = 5;
export const DEFAULT_MAX_TOOL_CALLS = 8;
/** Tool results added to one chat's prompt, in characters; past it the chat ends like a tool limit. */
export const MAX_TOOL_RESULT_CHARS = 200_000;

/**
 * What the gateway needs of the cost guard; the live test passes one that never caps.
 * `finish` and `release` must never throw: the gateway does not catch them.
 */
export type CostGuard = Pick<AiCostGuard, 'reserve' | 'finish' | 'release'>;

/** The JSON Schema sent to the model; `$schema` is dropped because some providers reject it. */
function toModelSchema(schema: z.ZodType): Record<string, unknown> {
  const { $schema: _ignored, ...rest } = z.toJSONSchema(schema) as Record<string, unknown>;
  return rest;
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

type ToolResult = { ok: boolean; content: string };
type ParsedToolCall = { args: unknown; key?: string; run: () => Promise<ToolResult> };

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
    key: `${tool.name}\u0000${JSON.stringify(parsed.data ?? null)}`,
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
    @Inject(ModelClient) private readonly client: ModelClient | null,
    @Inject(AiCostGuard) private readonly guard: CostGuard,
    @Inject(AI_CONFIG) private readonly config: Pick<AiConfig, 'structuredModel' | 'chatModel'>,
  ) {
    super();
  }

  async structured<T>(request: StructuredRequest<T>): Promise<T> {
    const { client, model } = this.preflight(this.config.structuredModel);
    const messages: ModelMessage[] = [
      { role: 'system', content: request.instructions },
      { role: 'user', content: request.input },
    ];
    const jsonSchema = { name: 'reply', schema: toModelSchema(request.schema) };
    const usage: ModelUsage = { inputTokens: 0, outputTokens: 0 };
    const started = Date.now();
    let succeeded = false;
    let billedTurns = 0;
    let usageId: string | undefined;
    try {
      usageId = await this.guard.reserve(request.context, model);
      // response_format is only a preference on some providers, so a reply can still
      // miss the schema: one retry, then give up.
      for (let attempt = 1; attempt <= 2; attempt++) {
        const reply = await client.complete({ model, messages, jsonSchema });
        billedTurns++;
        addUsage(usage, reply.usage);
        const value = parseReply(reply.content, request.schema);
        if (value !== undefined) {
          succeeded = true;
          return value;
        }
      }
      throw new AiUnavailableError(AI_REASONS.unusableReply);
    } catch (error) {
      const failure = this.unavailable(error);
      usageId = await this.releaseIfUnbilled(usageId, failure, billedTurns);
      throw failure;
    } finally {
      await this.finish(usageId, usage, started, succeeded);
    }
  }

  async *chat(request: ChatRequest): AsyncIterable<ChatEvent> {
    const { client, model } = this.preflight(this.config.chatModel);
    const tools = request.tools ?? [];
    const modelTools = tools.map((t) => ({ name: t.name, description: t.description, parameters: toModelSchema(t.schema) }));
    const maxSteps = request.maxSteps ?? DEFAULT_MAX_STEPS;
    const maxToolCalls = request.maxToolCalls ?? DEFAULT_MAX_TOOL_CALLS;
    // Within one chat an identical call reuses the first result: the handler runs once.
    const results = new Map<string, Promise<ToolResult>>();
    let toolCalls = 0;
    let toolChars = 0;
    const messages: ModelMessage[] = [{ role: 'system', content: request.instructions }, ...clientMessages(request.messages)];
    const usage: ModelUsage = { inputTokens: 0, outputTokens: 0 };
    const started = Date.now();
    let succeeded = false;
    let billedTurns = 0;
    let usageId: string | undefined;
    try {
      usageId = await this.guard.reserve(request.context, model);
      for (let step = 1; step <= maxSteps; step++) {
        const last = step === maxSteps;
        let end: Extract<ModelStreamEvent, { type: 'end' }> | undefined;
        for await (const event of client.stream({ model, messages, tools: modelTools, toolChoice: last ? 'none' : 'auto' })) {
          if (event.type === 'text') yield event;
          else end = event;
        }
        if (!end) throw new AiUnavailableError(AI_REASONS.streamEndedEarly);
        billedTurns++;
        addUsage(usage, end.usage);
        if (end.toolCalls.length === 0 || last) {
          // A provider may ignore tool_choice none and answer with tool calls
          // only; a blank answer is no answer.
          if (!end.content.trim()) throw new AiUnavailableError(AI_REASONS.unusableReply);
          succeeded = true;
          yield { type: 'done', text: end.content };
          return;
        }
        // A loop (the same call 200 times a turn) would run handlers and grow the prompt without
        // bound under one counted call: every call counts, unknown or invalid ones too, and a turn
        // that would pass the cap runs none of them.
        toolCalls += end.toolCalls.length;
        if (toolCalls > maxToolCalls) throw new AiUnavailableError(AI_REASONS.toolLimit);
        messages.push({ role: 'assistant', content: end.content, toolCalls: end.toolCalls });
        for (const call of end.toolCalls) {
          const parsed = parseToolCall(tools, call);
          yield { type: 'tool_call', name: call.name, args: parsed.args };
          let result: Promise<ToolResult>;
          if (parsed.key === undefined) result = parsed.run();
          else {
            result = results.get(parsed.key) ?? parsed.run();
            results.set(parsed.key, result);
          }
          const { ok, content } = await result;
          toolChars += content.length;
          if (toolChars > MAX_TOOL_RESULT_CHARS) throw new AiUnavailableError(AI_REASONS.toolLimit);
          yield { type: 'tool_result', name: call.name, ok };
          messages.push({ role: 'tool', toolCallId: call.id, content });
        }
      }
    } catch (error) {
      const failure = this.unavailable(error);
      usageId = await this.releaseIfUnbilled(usageId, failure, billedTurns);
      throw failure;
    } finally {
      // Also runs when the client disconnects and the caller stops iterating.
      await this.finish(usageId, usage, started, succeeded);
    }
  }

  /**
   * The model to call, checked before reserve(): a call that cannot reach a
   * model (no key, no model configured) does not count toward the cap.
   */
  private preflight(model: string | null): { client: ModelClient; model: string } {
    if (!this.client || !model) throw new AiUnavailableError(AI_REASONS.notConfigured);
    return { client: this.client, model };
  }

  private unavailable(error: unknown): AiUnavailableError {
    if (error instanceof AiUnavailableError) return error;
    logErrorName(this.logger, 'Unexpected AI gateway error', error);
    return new AiUnavailableError();
  }

  /**
   * Releases the reserved call when the provider refused it without billing
   * and no earlier turn was billed. Returns the row id still to finish, or
   * undefined once released. A disconnect never gets here, so it still counts.
   */
  private async releaseIfUnbilled(usageId: string | undefined, failure: AiUnavailableError, billedTurns: number): Promise<string | undefined> {
    if (usageId === undefined || failure.billed || billedTurns > 0) return usageId;
    await this.guard.release(usageId);
    return undefined;
  }

  private async finish(usageId: string | undefined, usage: ModelUsage, started: number, succeeded: boolean): Promise<void> {
    if (usageId !== undefined) await this.guard.finish(usageId, { ...usage, latencyMs: Date.now() - started, succeeded });
  }
}
