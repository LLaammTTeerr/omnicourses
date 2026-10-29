import type { Response } from 'express';
import { AiUnavailableError } from './ai-unavailable.error.js';
import type { ChatEvent } from './llm.service.js';

/**
 * Streams chat() to the browser as `text/event-stream` (ADR 0003). Use it from
 * a POST handler with `@Res() res: Response`. The browser reads it with
 * `fetch`, since EventSource cannot send the bearer header.
 *
 * A failure before the first event is thrown, so Nest answers 503
 * `ai_unavailable` as usual. After that the status is already 200, so a
 * failure becomes an `error` event and the stream ends.
 */
export async function streamChat(res: Response, events: AsyncIterable<ChatEvent>): Promise<void> {
  const iterator = events[Symbol.asyncIterator]();
  let closed = false;
  // Registered before the first event: in a tool turn that can take seconds,
  // and a tab closed meanwhile must stop the chat too. An async generator queues
  // return() behind the pending next(), so calling it early is safe. It stops the
  // model request; usage is still recorded (the gateway's finally).
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
