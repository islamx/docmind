/** Shared by the Angular client and the Vercel function. Types only. */

export interface ChatMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

export interface ChatRequest {
  readonly messages: readonly ChatMessage[];
}

/** One SSE `data:` payload. */
export type ChatStreamEvent = { readonly token: string } | { readonly error: string };

export const LIMITS = {
  maxMessages: 12,
  maxTotalChars: 24_000,
} as const;
