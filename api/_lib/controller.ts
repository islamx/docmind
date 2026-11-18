import { buildUpstreamRequest, failureEvent, LlmConfig, readConfig, toTokenEvents } from './llm';
import { RateLimiter } from './rate-limit';
import { validateChatRequest } from './validate';

export interface ChatInput {
  readonly method: string;
  readonly clientKey: string;
  readonly body: unknown;
  readonly signal?: AbortSignal;
}

export interface ChatDeps {
  readonly env: Record<string, string | undefined>;
  readonly limiter: RateLimiter;
  readonly fetchImpl: typeof fetch;
}

export type ChatOutput =
  | { readonly status: number; readonly json: Record<string, unknown>; readonly headers?: Record<string, string> }
  | { readonly status: 200; readonly stream: AsyncIterable<string> };

/**
 * All the logic of `/api/chat`, free of Vercel types so it can be unit tested.
 * The function file only adapts req/res to and from this.
 */
export async function handleChat(input: ChatInput, deps: ChatDeps): Promise<ChatOutput> {
  if (input.method !== 'POST')
    return { status: 405, json: { error: 'method_not_allowed' }, headers: { allow: 'POST' } };

  const config: LlmConfig | null = readConfig(deps.env);
  if (!config) return { status: 503, json: { error: 'llm_unavailable' } };

  const limit = deps.limiter.check(input.clientKey);
  if (!limit.allowed) {
    return { status: 429, json: { error: 'rate_limited' }, headers: { 'retry-after': String(limit.retryAfterSec) } };
  }

  const validation = validateChatRequest(input.body);
  if (!validation.ok) return { status: 400, json: { error: validation.error } };

  let upstream: Response;
  try {
    upstream = await deps.fetchImpl(...buildUpstreamRequest(config, validation.value.messages, input.signal));
  } catch {
    return { status: 502, json: { error: 'upstream_unreachable' } };
  }

  if (upstream.status === 429) return { status: 429, json: { error: 'rate_limited' } };
  if (!upstream.ok || !upstream.body) return { status: 502, json: { error: 'upstream_error' } };

  return { status: 200, stream: withErrorEvent(toTokenEvents(upstream.body as unknown as AsyncIterable<Uint8Array>)) };
}

/** A failure mid-stream cannot change the HTTP status any more, so it becomes an SSE error event. */
async function* withErrorEvent(source: AsyncGenerator<string>): AsyncGenerator<string> {
  try {
    yield* source;
  } catch {
    yield failureEvent('upstream_error');
  }
}
