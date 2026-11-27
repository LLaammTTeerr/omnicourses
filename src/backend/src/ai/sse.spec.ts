import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { AiUnavailableError } from './ai-unavailable.error.js';
import type { ChatEvent } from './llm.service.js';
import { streamChat } from './sse.js';

function fakeResponse() {
  const response = Object.assign(new EventEmitter(), {
    written: [] as string[],
    status: vi.fn(() => response),
    set: vi.fn(() => response),
    flushHeaders: vi.fn(),
    write: vi.fn((chunk: string) => response.written.push(chunk)),
    end: vi.fn(),
  });
  return response;
}

async function* events(list: ChatEvent[], failAfter?: Error): AsyncIterable<ChatEvent> {
  for (const event of list) yield event;
  if (failAfter) throw failAfter;
}

describe('streamChat', () => {
  it('writes each event as a server-sent event, disables proxy buffering, and ends', async () => {
    const response = fakeResponse();
    await streamChat(response as never, events([{ type: 'text', delta: 'Hi' }, { type: 'done', text: 'Hi' }]));
    expect(response.set).toHaveBeenCalledWith({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    expect(response.written).toEqual(['event: text\ndata: {"type":"text","delta":"Hi"}\n\n', 'event: done\ndata: {"type":"done","text":"Hi"}\n\n']);
    expect(response.end).toHaveBeenCalled();
  });

  it('throws a failure before the first event, so Nest can still answer 503', async () => {
    const response = fakeResponse();
    await expect(streamChat(response as never, events([], new AiUnavailableError('AI is not configured')))).rejects.toBeInstanceOf(AiUnavailableError);
    expect(response.status).not.toHaveBeenCalled();
  });

  it('turns a failure after the first event into an error event', async () => {
    const response = fakeResponse();
    await streamChat(response as never, events([{ type: 'text', delta: 'Up to' }], new AiUnavailableError('The AI provider timed out')));
    expect(response.written.at(-1)).toBe('event: error\ndata: {"code":"ai_unavailable","message":"The AI provider timed out"}\n\n');
    expect(response.end).toHaveBeenCalled();
  });

  it('stops the chat when the browser disconnects', async () => {
    const response = fakeResponse();
    let stopped = false;
    async function* endless(): AsyncIterable<ChatEvent> {
      try {
        for (;;) {
          yield { type: 'text', delta: '.' };
          response.emit('close');
        }
      } finally {
        stopped = true;
      }
    }
    await streamChat(response as never, endless());
    expect(stopped).toBe(true);
    expect(response.written).toHaveLength(1);
  });

  it('stops the chat when the browser leaves before the first event (during the first model turn)', async () => {
    const response = fakeResponse();
    let release!: () => void;
    const firstTurn = new Promise<void>((resolve) => (release = resolve));
    let yielded = 0;
    let stopped = false;
    async function* slowStart(): AsyncIterable<ChatEvent> {
      try {
        await firstTurn;
        for (let i = 0; i < 3; i++) {
          yielded++;
          yield { type: 'text', delta: '.' };
        }
      } finally {
        stopped = true;
      }
    }
    const streaming = streamChat(response as never, slowStart());
    await Promise.resolve();
    response.emit('close');
    release();
    await streaming;
    expect(stopped).toBe(true);
    expect(yielded).toBe(1);
    expect(response.written).toEqual([]);
  });

  it('aborts the factory AbortSignal immediately when the client disconnects before the first token', async () => {
    const response = fakeResponse();
    let capturedSignal: AbortSignal | undefined;
    const streaming = streamChat(response as never, (signal) => {
      capturedSignal = signal;
      return {
        [Symbol.asyncIterator]() {
          return {
            next: () =>
              new Promise<IteratorResult<ChatEvent>>((_, reject) => {
                signal.addEventListener('abort', () => reject(new AiUnavailableError('The model stream ended early')), { once: true });
              }),
          };
        },
      };
    });

    expect(capturedSignal?.aborted).toBe(false);
    response.emit('close');
    expect(capturedSignal?.aborted).toBe(true);
    await expect(streaming).resolves.toBeUndefined();
    expect(response.status).not.toHaveBeenCalled();
    expect(response.written).toEqual([]);
    expect(response.end).toHaveBeenCalled();
  });

  it('does not leave an unhandled rejection when stopping the chat fails', async () => {
    const response = fakeResponse();
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on('unhandledRejection', onUnhandled);
    try {
      async function* failingStop(): AsyncIterable<ChatEvent> {
        try {
          for (;;) {
            yield { type: 'text', delta: '.' };
            response.emit('close');
          }
        } finally {
          throw new Error('usage insert failed');
        }
      }
      await streamChat(response as never, failingStop());
      await new Promise((resolve) => setImmediate(resolve));
      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });
});
