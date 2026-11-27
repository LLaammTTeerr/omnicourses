export interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface ModelToolCall {
  id: string;
  name: string;
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

export interface CompleteRequest {
  model: string;
  messages: ModelMessage[];
  jsonSchema: { name: string; schema: Record<string, unknown> };
  signal?: AbortSignal;
}

export interface StreamRequest {
  model: string;
  messages: ModelMessage[];
  tools: ModelTool[];
  toolChoice?: 'auto' | 'none';
  signal?: AbortSignal;
}

export abstract class ModelClient {
  abstract complete(request: CompleteRequest): Promise<{ content: string; usage: ModelUsage }>;

  abstract stream(request: StreamRequest): AsyncIterable<ModelStreamEvent>;
}
