// The gateway's internal port to a model provider. GatewayLlmService holds the
// logic (tool loop, parsing, cap, usage) and talks only to this, so it is tested
// with a scripted client; OpenRouterModelClient is the one real adapter.

export interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface ModelToolCall {
  id: string;
  name: string;
  /** Raw JSON text from the model; may be invalid. */
  arguments: string;
}

export type ModelMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string; toolCalls?: ModelToolCall[] }
  | { role: 'tool'; toolCallId: string; content: string };

export interface ModelTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export type ModelStreamEvent =
  | { type: 'text'; delta: string }
  | { type: 'end'; content: string; toolCalls: ModelToolCall[]; usage: ModelUsage };

export abstract class ModelClient {
  /**
   * Throws AiUnavailableError('AI is not configured') when no request can be
   * sent at all (no key). The gateway calls it before reserving a call, so a
   * call that never reaches the model does not count toward the cap.
   */
  abstract assertConfigured(): void;

  /** One completion constrained to a JSON Schema. Throws AiUnavailableError. */
  abstract complete(request: {
    model: string;
    messages: ModelMessage[];
    jsonSchema: { name: string; schema: Record<string, unknown> };
  }): Promise<{ content: string; usage: ModelUsage }>;

  /** One streamed model turn, ending with exactly one `end` event. Throws AiUnavailableError. */
  abstract stream(request: { model: string; messages: ModelMessage[]; tools: ModelTool[] }): AsyncIterable<ModelStreamEvent>;
}
