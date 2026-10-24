import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { AiUnavailableError } from './ai-unavailable.error.js';
import type { ChatEvent } from './llm.service.js';
import { streamChat } from './sse.js';

function fakeResponse() {
  const res = Object.assign(new EventEmitter(), {
    written: [] as string[],
    status: vi.fn(() => res),
    set: vi.fn(() => res),
    flushHeaders: vi.fn(),
    write: vi.fn((chunk: string) => res.written.push(chunk)),
    end: vi.fn(),
  });
  return res;
}

async function* events(list: ChatEvent[], failAfter?: Error): AsyncIterable<ChatEvent> {
  for (const event of list) yield event;
  if (failAfter) throw failAfter;
}

describe('streamChat', () => {
  it('writes each event as a server-sent event and ends', async () => {
    const res = fakeResponse();
    await streamChat(res as never, events([{ type: 'text', delta: 'Hi' }, { type: 'done', text: 'Hi' }]));
    expect(res.set).toHaveBeenCalledWith(expect.objectContaining({ 'Content-Type': 'text/event-stream' }));
    expect(res.written).toEqual(['event: text\ndata: {"type":"text","delta":"Hi"}\n\n', 'event: done\ndata: {"type":"done","text":"Hi"}\n\n']);
    expect(res.end).toHaveBeenCalled();
  });

  it('throws a failure before the first event, so Nest can still answer 503', async () => {
    const res = fakeResponse();
    await expect(streamChat(res as never, events([], new AiUnavailableError('AI is not configured')))).rejects.toBeInstanceOf(AiUnavailableError);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('turns a failure after the first event into an error event', async () => {
    const res = fakeResponse();
    await streamChat(res as never, events([{ type: 'text', delta: 'Up to' }], new AiUnavailableError('The AI provider timed out')));
    expect(res.written.at(-1)).toBe('event: error\ndata: {"code":"ai_unavailable","message":"The AI provider timed out"}\n\n');
    expect(res.end).toHaveBeenCalled();
  });

  it('stops the chat when the browser disconnects', async () => {
    const res = fakeResponse();
    let stopped = false;
    async function* endless(): AsyncIterable<ChatEvent> {
      try {
        for (;;) {
          yield { type: 'text', delta: '.' };
          res.emit('close');
        }
      } finally {
        stopped = true;
      }
    }
    await streamChat(res as never, endless());
    expect(stopped).toBe(true);
    expect(res.written).toHaveLength(1);
  });
});
