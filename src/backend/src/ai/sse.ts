import type { Response } from 'express';
import { AiUnavailableError } from './ai-unavailable.error.js';
import type { ChatEvent } from './llm.service.js';

export async function streamChat(res: Response, events: AsyncIterable<ChatEvent>): Promise<void> {
  const iterator = events[Symbol.asyncIterator]();
  let closed = false;
  res.on('close', () => {
    closed = true;
    iterator.return?.()?.catch(() => undefined);
  });

  const first = await iterator.next();
  if (closed) {
    res.end();
    return;
  }

  res.status(200).set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.flushHeaders();
  const send = (event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  try {
    for (let result = first; !result.done && !closed; result = await iterator.next()) send(result.value.type, result.value);
  } catch (error) {
    const message = error instanceof AiUnavailableError ? error.reason : 'AI is unavailable';
    if (!closed) send('error', { code: 'ai_unavailable', message });
  } finally {
    res.end();
  }
}
