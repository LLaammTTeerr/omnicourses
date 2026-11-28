import { AI_REASONS, AiUnavailableError } from '../ai-unavailable.error.js';
import type { ChatEvent, ChatRequest, StructuredRequest } from '../llm.service.js';
import { LlmService } from '../llm.service.js';

type FakeChatStep = { text: string } | { tool: string; args: unknown };

export class FakeLlmService extends LlmService {
  readonly structuredCalls: StructuredRequest<unknown>[] = [];
  readonly chatCalls: ChatRequest[] = [];
  private readonly structuredReplies: unknown[] = [];
  private readonly chatScripts: FakeChatStep[][] = [];
  private failure?: string;

  replyStructured(...values: unknown[]): this {
    this.structuredReplies.push(...values);
    return this;
  }

  replyChat(...steps: FakeChatStep[]): this {
    this.chatScripts.push(steps);
    return this;
  }

  failWith(reason: string = AI_REASONS.unavailable): this {
    this.failure = reason;
    return this;
  }

  async structured<T>(request: StructuredRequest<T>): Promise<T> {
    this.structuredCalls.push(request as StructuredRequest<unknown>);
    if (request.signal?.aborted) throw new AiUnavailableError(AI_REASONS.streamEndedEarly);
    if (this.failure) throw new AiUnavailableError(this.failure);
    if (!this.structuredReplies.length) throw new Error('FakeLlmService: no scripted structured reply left');
    const parsed = request.schema.safeParse(this.structuredReplies.shift());
    if (!parsed.success) throw new AiUnavailableError(AI_REASONS.unusableReply);
    return parsed.data;
  }

  async *chat(request: ChatRequest): AsyncIterable<ChatEvent> {
    this.chatCalls.push(request);
    if (request.signal?.aborted) throw new AiUnavailableError(AI_REASONS.streamEndedEarly);
    if (this.failure) throw new AiUnavailableError(this.failure);
    const script = this.chatScripts.shift();
    if (!script) throw new Error('FakeLlmService: no scripted chat reply left');
    let text = '';
    for (const step of script) {
      if (request.signal?.aborted) throw new AiUnavailableError(AI_REASONS.streamEndedEarly);
      if ('tool' in step) {
        const tool = request.tools?.find((t) => t.name === step.tool);
        if (!tool) throw new Error(`FakeLlmService: the request has no tool ${step.tool}`);
        const args = tool.schema.parse(step.args);
        yield { type: 'tool_call', name: step.tool, args };
        const ok = await tool.handler(args).then(
          () => true,
          () => false,
        );
        if (request.signal?.aborted) throw new AiUnavailableError(AI_REASONS.streamEndedEarly);
        yield { type: 'tool_result', name: step.tool, ok };
      } else {
        for (const word of step.text.split(/(?<= )/)) {
          if (request.signal?.aborted) throw new AiUnavailableError(AI_REASONS.streamEndedEarly);
          yield { type: 'text', delta: word };
        }
        text = step.text;
      }
    }
    yield { type: 'done', text };
  }
}
