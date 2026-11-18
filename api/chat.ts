import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleChat } from './_lib/controller';
import { createRateLimiter } from './_lib/rate-limit';

// Module scope survives between invocations of a warm instance, so the limiter keeps its counts.
const limiter = createRateLimiter({ limit: 20, windowMs: 60_000 });

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const forwarded = req.headers['x-forwarded-for'];
  const clientKey = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0].trim() || 'unknown';

  const abort = new AbortController();
  res.on('close', () => abort.abort()); // client left: stop paying for tokens

  const result = await handleChat(
    { method: req.method ?? 'GET', clientKey, body: req.body, signal: abort.signal },
    { env: process.env, limiter, fetchImpl: fetch },
  );

  if ('json' in result) {
    for (const [name, value] of Object.entries(result.headers ?? {})) res.setHeader(name, value);
    res.status(result.status).json(result.json);
    return;
  }

  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    'x-accel-buffering': 'no',
  });
  try {
    for await (const frame of result.stream) res.write(frame);
  } finally {
    res.end();
  }
}
