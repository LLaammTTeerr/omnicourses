import type { Response } from 'express';
import { AiUnavailableError } from './ai-unavailable.error.js';
import type { ChatEvent } from './llm.service.js';

export async function streamChat(
  response: Response,
  eventsOrFactory: AsyncIterable<ChatEvent> | ((signal: AbortSignal) => AsyncIterable<ChatEvent>),
): Promise<void> {
  const controller = new AbortController();
  const events = typeof eventsOrFactory === 'function' ? eventsOrFactory(controller.signal) : eventsOrFactory;
  const iterator = events[Symbol.asyncIterator]();
  let closed = false;
  response.on('close', () => {
    closed = true;
    controller.abort();
    iterator.return?.()?.catch(() => undefined);
  });

  let first: IteratorResult<ChatEvent>;
  try {
    first = await iterator.next();
  } catch (error) {
    if (closed) {
      response.end();
      return;
    }
    throw error;
  }
  if (closed) {
    response.end();
    return;
  }

  response.status(200).set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  response.flushHeaders();
  const send = (event: string, data: unknown) => response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  try {
    for (let result = first; !result.done && !closed; result = await iterator.next()) send(result.value.type, result.value);
  } catch (error) {
    const message = error instanceof AiUnavailableError ? error.reason : 'AI is unavailable';
    if (!closed) send('error', { code: 'ai_unavailable', message });
  } finally {
    response.end();
  }
}
