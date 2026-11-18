import { handleChat, ChatDeps } from './controller';
import { deltaFromFrame, readConfig, toTokenEvents } from './llm';
import { createRateLimiter } from './rate-limit';
import { validateChatRequest } from './validate';

const user = (content: string) => ({ role: 'user', content });

describe('validateChatRequest', () => {
  it('accepts a well-formed request', () => {
    expect(validateChatRequest({ messages: [{ role: 'system', content: 's' }, user('hi')] }).ok).toBe(true);
  });
  it.each<[unknown, string]>([
    [null, 'not an object'],
    [{}, 'no messages'],
    [{ messages: [] }, 'empty'],
    [{ messages: [{ role: 'admin', content: 'x' }] }, 'bad role'],
    [{ messages: [{ role: 'user', content: 5 }] }, 'bad content'],
    [{ messages: [{ role: 'assistant', content: 'x' }] }, 'last not user'],
    [{ messages: Array.from({ length: 13 }, () => user('x')) }, 'too many'],
    [{ messages: [user('x'.repeat(25_000))] }, 'too large'],
  ])('rejects %j (%s)', (body) => {
    expect(validateChatRequest(body).ok).toBe(false);
  });
});

describe('rate limiter', () => {
  it('allows up to the limit, then blocks until the window resets', () => {
    let now = 0;
    const limiter = createRateLimiter({ limit: 2, windowMs: 1000, now: () => now });
    expect(limiter.check('a').allowed).toBe(true);
    expect(limiter.check('a').allowed).toBe(true);
    const blocked = limiter.check('a');
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThanOrEqual(1);
    expect(limiter.check('b').allowed).toBe(true); // keys are independent
    now = 1001;
    expect(limiter.check('a').allowed).toBe(true);
  });
});

describe('llm helpers', () => {
  it('reads config only when a key exists and applies defaults', () => {
    expect(readConfig({})).toBeNull();
    expect(readConfig({ LLM_API_KEY: '  ' })).toBeNull();
    expect(readConfig({ LLM_API_KEY: 'k' })).toMatchObject({ baseUrl: 'https://api.groq.com/openai/v1' });
    expect(readConfig({ LLM_API_KEY: 'k', LLM_BASE_URL: 'https://x.dev/v1/', LLM_MODEL: 'm' })).toEqual({
      apiKey: 'k',
      baseUrl: 'https://x.dev/v1',
      model: 'm',
    });
  });

  it('extracts deltas and ignores empty or malformed frames', () => {
    expect(deltaFromFrame('{"choices":[{"delta":{"content":"Hi"}}]}')).toBe('Hi');
    expect(deltaFromFrame('{"choices":[{"delta":{}}]}')).toBeNull();
    expect(deltaFromFrame('not json')).toBeNull();
  });

  it('re-emits tokens across split network chunks and ends with DONE', async () => {
    const enc = new TextEncoder();
    const frame = (t: string) => `data: {"choices":[{"delta":{"content":"${t}"}}]}\n\n`;
    const whole = frame('Hel') + frame('lo') + 'data: [DONE]\n\n';
    async function* chunks() {
      yield enc.encode(whole.slice(0, 20)); // splits inside the first frame
      yield enc.encode(whole.slice(20));
    }
    const out: string[] = [];
    for await (const f of toTokenEvents(chunks())) out.push(f);
    expect(out).toEqual(['data: {"token":"Hel"}\n\n', 'data: {"token":"lo"}\n\n', 'data: [DONE]\n\n']);
  });
});

describe('handleChat', () => {
  const sse = (body: string) =>
    new Response(new ReadableStream({ start: (c) => (c.enqueue(new TextEncoder().encode(body)), c.close()) }), {
      status: 200,
    });

  const make = (overrides: Partial<ChatDeps> = {}) => {
    const fetchImpl = vi.fn(async () => sse('data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n'));
    const deps: ChatDeps = {
      env: { LLM_API_KEY: 'secret' },
      limiter: createRateLimiter({ limit: 5, windowMs: 1000 }),
      fetchImpl: fetchImpl as unknown as typeof fetch,
      ...overrides,
    };
    return { deps, fetchImpl };
  };
  const input = { method: 'POST', clientKey: 'ip', body: { messages: [user('hi')] } };

  it('streams tokens from the provider and never leaks the key to the client', async () => {
    const { deps, fetchImpl } = make();
    const result = await handleChat(input, deps);
    expect(result.status).toBe(200);
    const frames: string[] = [];
    for await (const f of (result as { stream: AsyncIterable<string> }).stream) frames.push(f);
    expect(frames.join('')).toContain('"token":"ok"');
    expect(JSON.stringify(frames)).not.toContain('secret');
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('/chat/completions');
    expect((init.headers as Record<string, string>)['authorization']).toBe('Bearer secret');
  });

  it('503 when no key is configured, without calling upstream', async () => {
    const { deps, fetchImpl } = make({ env: {} });
    expect(await handleChat(input, deps)).toMatchObject({ status: 503, json: { error: 'llm_unavailable' } });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('405 for non-POST, 400 for invalid body', async () => {
    const { deps } = make();
    expect(await handleChat({ ...input, method: 'GET' }, deps)).toMatchObject({ status: 405 });
    expect(await handleChat({ ...input, body: { messages: 'x' } }, deps)).toMatchObject({ status: 400 });
  });

  it('429 with Retry-After when the client exceeds the limit', async () => {
    const { deps } = make({ limiter: createRateLimiter({ limit: 1, windowMs: 1000 }) });
    await handleChat(input, deps);
    const second = await handleChat(input, deps);
    expect(second).toMatchObject({ status: 429 });
    expect((second as { headers: Record<string, string> }).headers['retry-after']).toBeDefined();
  });

  it('maps upstream failures to 429 / 502', async () => {
    expect(
      await handleChat(
        input,
        make({ fetchImpl: (async () => new Response('', { status: 429 })) as typeof fetch }).deps,
      ),
    ).toMatchObject({ status: 429 });
    expect(
      await handleChat(
        input,
        make({ fetchImpl: (async () => new Response('', { status: 500 })) as typeof fetch }).deps,
      ),
    ).toMatchObject({ status: 502 });
    expect(
      await handleChat(
        input,
        make({
          fetchImpl: (async () => {
            throw new Error('down');
          }) as typeof fetch,
        }).deps,
      ),
    ).toMatchObject({ status: 502, json: { error: 'upstream_unreachable' } });
  });
});
