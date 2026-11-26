import { Inject, Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { failureKind } from '../common/failure-kind.js';
import { Clock } from '../config/clock.js';
import { AI_CONFIG, type AiConfig } from '../config/env.js';
import { AiCostGuard } from './ai-cost-guard.service.js';
import { AI_REASONS, AiUnavailableError } from './ai-unavailable.error.js';
import { type AiCallContext, type ChatEvent, type ChatMessage, type ChatRequest, type ChatTool, LlmService, type StructuredRequest } from './llm.service.js';
import { ModelClient, ModelMessage, ModelStreamEvent, ModelTool, ModelToolCall, ModelUsage } from './model-client.js';

const DEFAULT_MAX_STEPS = 5;
const MAX_SCHEMA_ATTEMPTS = 2;

interface Meter {
  usage: ModelUsage;
  billedTurns: number;
  succeeded: boolean;
}

interface Conversation {
  client: ModelClient;
  model: string;
  tools: ChatTool<any>[];
  modelTools: ModelTool[];
  messages: ModelMessage[];
  maxSteps: number;
}

type ModelEnd = Extract<ModelStreamEvent, { type: 'end' }>;

export type CostGuard = Pick<AiCostGuard, 'reserve' | 'finish' | 'release'>;

function toModelSchema(schema: z.ZodType): Record<string, unknown> {
  const { $schema: _ignored, ...rest } = z.toJSONSchema(schema) as Record<string, unknown>;
  return rest;
}

function bill(meter: Meter, more: ModelUsage): void {
  meter.billedTurns++;
  meter.usage.inputTokens += more.inputTokens;
  meter.usage.outputTokens += more.outputTokens;
}

async function* withoutEvents<T>(run: () => Promise<T>): AsyncGenerator<never, T> {
  return await run();
}

function parseReply<T>(content: string, schema: z.ZodType<T>): T | undefined {
  try {
    const parsed = schema.safeParse(JSON.parse(content));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

function clientMessages(messages: ChatMessage[]): ModelMessage[] {
  return messages
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map((m) => ({ role: m.role, content: m.content }));
}

type ParsedToolCall = { args: unknown; run: () => Promise<{ ok: boolean; content: string }> };

const toolError = (error: string) => ({ ok: false, content: JSON.stringify({ error }) });

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

async function completeMatching<T>(complete: () => ReturnType<ModelClient['complete']>, schema: z.ZodType<T>, meter: Meter): Promise<T> {
  for (let attempt = 1; attempt <= MAX_SCHEMA_ATTEMPTS; attempt++) {
    const reply = await complete();
    bill(meter, reply.usage);
    const value = parseReply(reply.content, schema);
    if (value !== undefined) {
      meter.succeeded = true;
      return value;
    }
  }
  throw new AiUnavailableError(AI_REASONS.unusableReply);
}

async function* converse(conversation: Conversation, meter: Meter): AsyncGenerator<ChatEvent, void> {
  for (let step = 1; step <= conversation.maxSteps; step++) {
    const last = step === conversation.maxSteps;
    const end = yield* streamTurn(conversation, last ? 'none' : 'auto');
    bill(meter, end.usage);
    if (end.toolCalls.length === 0 || last) {
      if (!end.content.trim()) throw new AiUnavailableError(AI_REASONS.unusableReply);
      meter.succeeded = true;
      yield { type: 'done', text: end.content };
      return;
    }
    conversation.messages.push({ role: 'assistant', content: end.content, toolCalls: end.toolCalls });
    yield* runToolCalls(conversation, end.toolCalls);
  }
}

async function* streamTurn({ client, model, messages, modelTools }: Conversation, toolChoice: 'auto' | 'none'): AsyncGenerator<ChatEvent, ModelEnd> {
  let end: ModelEnd | undefined;
  for await (const event of client.stream({ model, messages, tools: modelTools, toolChoice })) {
    if (event.type === 'text') yield event;
    else end = event;
  }
  if (!end) throw new AiUnavailableError(AI_REASONS.streamEndedEarly);
  return end;
}

async function* runToolCalls({ tools, messages }: Conversation, calls: ModelToolCall[]): AsyncGenerator<ChatEvent, void> {
  for (const call of calls) {
    const parsed = parseToolCall(tools, call);
    yield { type: 'tool_call', name: call.name, args: parsed.args };
    const result = await parsed.run();
    yield { type: 'tool_result', name: call.name, ok: result.ok };
    messages.push({ role: 'tool', toolCallId: call.id, content: result.content });
  }
}

@Injectable()
export class GatewayLlmService extends LlmService {
  private readonly logger = new Logger(GatewayLlmService.name);

  constructor(
    @Inject(ModelClient) private readonly client: ModelClient | null,
    @Inject(AiCostGuard) private readonly guard: CostGuard,
    @Inject(AI_CONFIG) private readonly config: Pick<AiConfig, 'structuredModel' | 'chatModel'>,
    private readonly clock: Clock,
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
    const complete = () => client.complete({ model, messages, jsonSchema });
    const call = this.metered(request.context, model, (meter) => withoutEvents(() => completeMatching(complete, request.schema, meter)));
    return (await call.next()).value as T;
  }

  async *chat(request: ChatRequest): AsyncIterable<ChatEvent> {
    const { client, model } = this.preflight(this.config.chatModel);
    const tools = request.tools ?? [];
    const conversation: Conversation = {
      client,
      model,
      tools,
      modelTools: tools.map((t) => ({ name: t.name, description: t.description, parameters: toModelSchema(t.schema) })),
      messages: [{ role: 'system', content: request.instructions }, ...clientMessages(request.messages)],
      maxSteps: request.maxSteps ?? DEFAULT_MAX_STEPS,
    };
    yield* this.metered(request.context, model, (meter) => converse(conversation, meter));
  }

  private async *metered<R>(context: AiCallContext, model: string, run: (meter: Meter) => AsyncGenerator<ChatEvent, R>): AsyncGenerator<ChatEvent, R> {
    const meter: Meter = { usage: { inputTokens: 0, outputTokens: 0 }, billedTurns: 0, succeeded: false };
    const started = this.clock.now().getTime();
    let usageId: string | undefined;
    try {
      usageId = await this.guard.reserve(context, model);
      return yield* run(meter);
    } catch (error) {
      const failure = this.unavailable(error);
      usageId = await this.releaseIfUnbilled(usageId, failure, meter.billedTurns);
      throw failure;
    } finally {
      await this.finish(usageId, meter, started);
    }
  }

  private preflight(model: string | null): { client: ModelClient; model: string } {
    if (!this.client || !model) throw new AiUnavailableError(AI_REASONS.notConfigured);
    return { client: this.client, model };
  }

  private unavailable(error: unknown): AiUnavailableError {
    if (error instanceof AiUnavailableError) return error;
    this.logger.warn(`Unexpected AI gateway error: ${failureKind(error)}`);
    return new AiUnavailableError();
  }

  private async releaseIfUnbilled(usageId: string | undefined, failure: AiUnavailableError, billedTurns: number): Promise<string | undefined> {
    if (usageId === undefined || failure.billed || billedTurns > 0) return usageId;
    await this.guard.release(usageId);
    return undefined;
  }

  private async finish(usageId: string | undefined, meter: Meter, started: number): Promise<void> {
    if (usageId !== undefined) await this.guard.finish(usageId, { ...meter.usage, latencyMs: this.clock.now().getTime() - started, succeeded: meter.succeeded });
  }
}
