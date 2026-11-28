import type { z } from 'zod';

export interface AiCallContext {
  userId: string;
  feature: string;
}

export interface StructuredRequest<T> {
  context: AiCallContext;
  instructions: string;
  input: string;
  schema: z.ZodType<T>;
  signal?: AbortSignal;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatTool<A = unknown> {
  name: string;
  description: string;
  schema: z.ZodType<A>;
  handler: (args: A) => Promise<unknown>;
}

export interface ChatRequest {
  context: AiCallContext;
  instructions: string;
  messages: ChatMessage[];
  tools?: ChatTool<any>[];
  maxSteps?: number;
  signal?: AbortSignal;
}

export type ChatEvent =
  | { type: 'text'; delta: string }
  | { type: 'tool_call'; name: string; args: unknown }
  | { type: 'tool_result'; name: string; ok: boolean }
  | { type: 'done'; text: string };

export abstract class LlmService {
  abstract structured<T>(request: StructuredRequest<T>): Promise<T>;

  abstract chat(request: ChatRequest): AsyncIterable<ChatEvent>;
}
