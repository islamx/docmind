import { Citation } from './models';

const MAX_PASSAGES = 3;
const MAX_PASSAGE_CHARS = 600;

/**
 * Fallback answer used when no LLM is reachable. Shows the best passages verbatim,
 * each tagged with its citation number. Honest by construction: it cannot hallucinate.
 */
export function buildExtractiveAnswer(citations: readonly Citation[]): string {
  if (citations.length === 0) return '';
  return citations
    .slice(0, MAX_PASSAGES)
    .map(({ n, chunk }) => {
      const body = chunk.text.replace(/^#{1,6}\s.*\n+/, ''); // the title is shown separately
      const text = body.length > MAX_PASSAGE_CHARS ? `${body.slice(0, MAX_PASSAGE_CHARS).trimEnd()}…` : body;
      const title = chunk.heading || chunk.path;
      return `**${title}** [${n}]\n\n${text}`;
    })
    .join('\n\n---\n\n');
}

/** Cheap, deterministic follow-ups from the headings of what was retrieved. */
export function suggestFollowUps(citations: readonly Citation[], max = 3): string[] {
  const seen = new Set<string>();
  for (const { chunk } of citations) {
    const topic = chunk.heading.split(' > ').pop()?.trim();
    if (topic && topic.length < 60) seen.add(topic);
    if (seen.size >= max) break;
  }
  return [...seen].map((t) => `Tell me more about "${t}"`);
}
