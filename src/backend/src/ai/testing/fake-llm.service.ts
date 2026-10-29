import { AiUnavailableError } from '../ai-unavailable.error.js';
import type { ChatEvent, ChatRequest, StructuredRequest } from '../llm.service.js';
import { LlmService } from '../llm.service.js';

export type FakeChatStep = { text: string } | { tool: string; args: unknown };

/**
 * Scripted LlmService for unit tests of AI features; CI never calls a real
 * model (ADR 0003). Replies are still parsed with the caller's schema, and
 * scripted tool calls run the caller's real handlers.
 *
 *   const llm = new FakeLlmService().replyStructured({ targetGraduationTerm: '2028-summer', … });
 *   const llm = new FakeLlmService().replyChat({ tool: 'search_regulations', args: { q: 'credit cap' } }, { text: 'Up to 25 credits.' });
 *   const llm = new FakeLlmService().failWith('The AI provider timed out');
 */
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

  /** One script per chat() call; text steps stream word by word. */
  replyChat(...steps: FakeChatStep[]): this {
    this.chatScripts.push(steps);
    return this;
  }

  failWith(reason = 'AI is unavailable'): this {
    this.failure = reason;
    return this;
  }

  async structured<T>(request: StructuredRequest<T>): Promise<T> {
    this.structuredCalls.push(request as StructuredRequest<unknown>);
    if (this.failure) throw new AiUnavailableError(this.failure);
    if (!this.structuredReplies.length) throw new Error('FakeLlmService: no scripted structured reply left');
    // Like the real gateway: a reply that misses the schema is a 503, not a ZodError.
    const parsed = request.schema.safeParse(this.structuredReplies.shift());
    if (!parsed.success) throw new AiUnavailableError('The model returned an unusable reply');
    return parsed.data;
  }

  async *chat(request: ChatRequest): AsyncIterable<ChatEvent> {
    this.chatCalls.push(request);
    if (this.failure) throw new AiUnavailableError(this.failure);
    const script = this.chatScripts.shift();
    if (!script) throw new Error('FakeLlmService: no scripted chat reply left');
    let text = '';
    for (const step of script) {
      if ('tool' in step) {
        const tool = request.tools?.find((t) => t.name === step.tool);
        if (!tool) throw new Error(`FakeLlmService: the request has no tool ${step.tool}`);
        const args = tool.schema.parse(step.args);
        yield { type: 'tool_call', name: step.tool, args };
        const ok = await tool.handler(args).then(
          () => true,
          () => false,
        );
        yield { type: 'tool_result', name: step.tool, ok };
      } else {
        for (const word of step.text.split(/(?<= )/)) yield { type: 'text', delta: word };
        text = step.text;
      }
    }
    yield { type: 'done', text };
  }
}
