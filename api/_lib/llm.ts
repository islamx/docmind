import { ChatMessage, ChatStreamEvent } from '../../src/app/rag/chat-contract';
import { encodeSse } from '../../src/app/rag/sse';

export interface LlmConfig {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly model: string;
}

/**
 * Any OpenAI-compatible provider works by changing env vars:
 *   Groq (default):  https://api.groq.com/openai/v1
 *   Gemini:          https://generativelanguage.googleapis.com/v1beta/openai
 *   OpenRouter:      https://openrouter.ai/api/v1
 */
export function readConfig(env: Record<string, string | undefined>): LlmConfig | null {
  const apiKey = env['LLM_API_KEY']?.trim();
  if (!apiKey) return null;
  return {
    apiKey,
    baseUrl: (env['LLM_BASE_URL'] ?? 'https://api.groq.com/openai/v1').replace(/\/+$/, ''),
    model: env['LLM_MODEL'] ?? 'llama-3.3-70b-versatile',
  };
}

/** Extracts the text delta from one OpenAI-style SSE frame body, or null. */
export function deltaFromFrame(data: string): string | null {
  try {
    const parsed = JSON.parse(data) as { choices?: { delta?: { content?: unknown } }[] };
    const content = parsed.choices?.[0]?.delta?.content;
    return typeof content === 'string' && content.length > 0 ? content : null;
  } catch {
    return null;
  }
}

/** Re-emits an OpenAI SSE stream as DocMind's minimal `{token}` events. Buffers partial frames. */
export async function* toTokenEvents(body: AsyncIterable<Uint8Array>): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  let buffer = '';

  for await (const chunk of body) {
    buffer += decoder.decode(chunk, { stream: true });
    const frames = buffer.split(/\r?\n\r?\n/);
    buffer = frames.pop() ?? '';
    for (const frame of frames) {
      for (const line of frame.split(/\r?\n/)) {
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') continue;
        const token = deltaFromFrame(data);
        if (token) yield encodeSse({ token });
      }
    }
  }
  yield encodeSse('[DONE]');
}

export function failureEvent(error: string): string {
  const event: ChatStreamEvent = { error };
  return encodeSse(event);
}

export function buildUpstreamRequest(
  config: LlmConfig,
  messages: readonly ChatMessage[],
  signal?: AbortSignal,
): [string, RequestInit] {
  return [
    `${config.baseUrl}/chat/completions`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({ model: config.model, messages, stream: true, temperature: 0.2, max_tokens: 700 }),
      signal,
    },
  ];
}
