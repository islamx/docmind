import { ChatMessage, ChatRequest, LIMITS } from '../../src/app/rag/chat-contract';

export type Validation = { ok: true; value: ChatRequest } | { ok: false; error: string };

const ROLES = new Set(['system', 'user', 'assistant']);

/** Never trust the client: shape, roles and total size are all checked before any upstream call. */
export function validateChatRequest(body: unknown): Validation {
  if (typeof body !== 'object' || body === null || !('messages' in body) || !Array.isArray(body.messages)) {
    return { ok: false, error: 'messages must be an array' };
  }
  const messages: ChatMessage[] = [];
  let total = 0;

  if (body.messages.length === 0 || body.messages.length > LIMITS.maxMessages) {
    return { ok: false, error: `messages must contain 1 to ${LIMITS.maxMessages} items` };
  }
  for (const item of body.messages as unknown[]) {
    if (typeof item !== 'object' || item === null) return { ok: false, error: 'invalid message' };
    const { role, content } = item as Record<string, unknown>;
    if (typeof role !== 'string' || !ROLES.has(role) || typeof content !== 'string') {
      return { ok: false, error: 'invalid message' };
    }
    total += content.length;
    messages.push({ role: role as ChatMessage['role'], content });
  }
  if (total > LIMITS.maxTotalChars) return { ok: false, error: 'request too large' };
  if (messages[messages.length - 1].role !== 'user') return { ok: false, error: 'last message must be from the user' };
  return { ok: true, value: { messages } };
}
