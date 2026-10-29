import type { z } from 'zod';

// The AI gateway's public contract (ADR 0003). Feature modules inject LlmService
// and write their own prompts, schemas and tools; the gateway is transport only.

/** Who is calling, for the per-user daily cap and the usage row. */
export interface AiCallContext {
  userId: string;
  /** Short feature name stored on the usage row, e.g. 'goal-box', 'advisor'. */
  feature: string;
}

export interface StructuredRequest<T> {
  context: AiCallContext;
  /** System prompt. */
  instructions: string;
  /** The student's text. */
  input: string;
  /**
   * The reply's shape. Use `.nullable()`, not `.optional()`: strict JSON Schema
   * mode requires every property. The reply is always parsed with this schema.
   */
  schema: z.ZodType<T>;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatTool<A = unknown> {
  name: string;
  description: string;
  /** Arguments the model must send; parsed before the handler runs. */
  schema: z.ZodType<A>;
  /** Returns any JSON-serialisable value; a throw is reported to the model as a tool error. */
  handler: (args: A) => Promise<unknown>;
}

export interface ChatRequest {
  context: AiCallContext;
  instructions: string;
  messages: ChatMessage[];
  tools?: ChatTool<any>[];
  /** Model turns including the final answer; on the last turn the model may not call a tool. Default 5. */
  maxSteps?: number;
}

// `text` deltas stream from every model turn, including a short preamble before
// a tool call ("Let me check…"); `done.text` is the final turn's text only.
// tool_call args can hold the student's record: send them to the browser if useful, never log them.
export type ChatEvent =
  | { type: 'text'; delta: string }
  | { type: 'tool_call'; name: string; args: unknown }
  | { type: 'tool_result'; name: string; ok: boolean }
  | { type: 'done'; text: string };

export abstract class LlmService {
  /** Throws AiUnavailableError (HTTP 503 `ai_unavailable`) on any failure. */
  abstract structured<T>(request: StructuredRequest<T>): Promise<T>;

  /**
   * Streams the answer. Throws AiUnavailableError from the iterator: before the
   * first event the caller can still answer 503; after it, `streamChat` turns
   * the throw into an `error` event.
   */
  abstract chat(request: ChatRequest): AsyncIterable<ChatEvent>;
}
