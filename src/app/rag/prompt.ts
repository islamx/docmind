import { ChatMessage } from './chat-contract';
import { Citation } from './models';

export const SYSTEM_PROMPT = [
  'You answer questions about a software documentation or code repository.',
  'Use ONLY the numbered context passages. Cite the passages you used with [n] markers, e.g. "Use computed() [2]".',
  'If the context does not contain the answer, say so plainly and do not guess.',
  'Reply in the same language as the question. Keep code identifiers in English. Be concise.',
].join(' ');

export interface HistoryTurn {
  readonly role: 'user' | 'assistant';
  readonly content: string;
}

const MAX_CONTEXT_CHARS = 9000;
const MAX_HISTORY_TURNS = 4;

export function buildContext(citations: readonly Citation[], maxChars = MAX_CONTEXT_CHARS): string {
  const parts: string[] = [];
  let used = 0;
  for (const { n, chunk } of citations) {
    const where = `${chunk.path}:${chunk.startLine}-${chunk.endLine}`;
    const header = `[${n}] ${where}${chunk.heading ? ` (${chunk.heading})` : ''}`;
    const block = `${header}\n${chunk.text}`;
    if (used + block.length > maxChars && parts.length > 0) break;
    parts.push(block);
    used += block.length;
  }
  return parts.join('\n\n---\n\n');
}

export function buildMessages(
  question: string,
  citations: readonly Citation[],
  history: readonly HistoryTurn[] = [],
): ChatMessage[] {
  const recent = history.slice(-MAX_HISTORY_TURNS);
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    ...recent.map((t) => ({ role: t.role, content: t.content })),
    { role: 'user', content: `Context:\n${buildContext(citations)}\n\nQuestion: ${question}` },
  ];
}
