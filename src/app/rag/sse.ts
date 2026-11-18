import { ChatStreamEvent } from './chat-contract';

export interface SseParseResult {
  readonly events: ChatStreamEvent[];
  readonly done: boolean;
  /** Incomplete trailing data to feed back in with the next network chunk. */
  readonly rest: string;
}

/**
 * Incremental Server-Sent-Events parser. Network chunks can split an event anywhere,
 * so the caller feeds `rest` back in with the next chunk.
 */
export function parseSse(buffer: string, incoming: string): SseParseResult {
  const text = buffer + incoming;
  const frames = text.split(/\r?\n\r?\n/);
  const rest = frames.pop() ?? '';
  const events: ChatStreamEvent[] = [];
  let done = false;

  for (const frame of frames) {
    const data = frame
      .split(/\r?\n/)
      .filter((l) => l.startsWith('data:'))
      .map((l) => l.slice(5).trimStart())
      .join('\n');
    if (!data) continue;
    if (data === '[DONE]') {
      done = true;
      continue;
    }
    try {
      const parsed: unknown = JSON.parse(data);
      if (isStreamEvent(parsed)) events.push(parsed);
    } catch {
      // Malformed frame: skip it. A half-written frame never gets here, it stays in `rest`.
    }
  }
  return { events, done, rest };
}

function isStreamEvent(value: unknown): value is ChatStreamEvent {
  if (typeof value !== 'object' || value === null) return false;
  return 'token' in value ? typeof value.token === 'string' : 'error' in value && typeof value.error === 'string';
}

export function encodeSse(event: ChatStreamEvent | '[DONE]'): string {
  return `data: ${event === '[DONE]' ? event : JSON.stringify(event)}\n\n`;
}
