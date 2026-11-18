import { Bm25Index } from './bm25';
import { reciprocalRankFusion } from './fusion';
import { Chunk, Confidence, ScoredChunk, SearchResult } from './models';
import { tokenize } from './tokenizer';
import { topK } from './vector';

export const CONFIDENCE_THRESHOLDS = { high: 0.5, medium: 0.3 } as const;

/**
 * Hybrid retriever: BM25 for exact terms and identifiers, cosine similarity for meaning,
 * merged with RRF. Vectors are optional, so the same class serves the "embeddings still
 * loading" and "embedding model failed" cases.
 */
export class HybridRetriever {
  private readonly byId = new Map<string, Chunk>();
  private readonly bm25: Bm25Index;

  constructor(
    chunks: readonly Chunk[],
    private readonly vectors: ReadonlyMap<string, Float32Array> = new Map(),
  ) {
    for (const chunk of chunks) this.byId.set(chunk.id, chunk);
    // Heading and path carry signal for docs, so they are indexed with the body.
    this.bm25 = new Bm25Index(
      chunks.map((c) => ({ id: c.id, tokens: tokenize(`${c.heading} ${c.path} ${c.text}`) })),
    );
  }

  get hasVectors(): boolean {
    return this.vectors.size > 0;
  }

  get chunkCount(): number {
    return this.byId.size;
  }

  search(query: string, queryVector: Float32Array | null, limit = 6): SearchResult {
    const pool = Math.max(limit * 4, 20);
    const lexical = this.bm25.search(tokenize(query), pool);
    const semantic = queryVector && this.hasVectors ? topK(queryVector, this.vectors, pool) : [];

    const fused = reciprocalRankFusion([lexical.map((h) => h.id), semantic.map((h) => h.id)]).slice(0, limit);
    const hits: ScoredChunk[] = fused.flatMap(({ id, score }) => {
      const chunk = this.byId.get(id);
      return chunk ? [{ chunk, score }] : [];
    });

    const topSimilarity = semantic.length ? semantic[0].score : null;
    return {
      hits,
      topSimilarity,
      usedVectors: semantic.length > 0,
      confidence: rateConfidence(hits.length, topSimilarity, lexical.length),
    };
  }
}

export function rateConfidence(hitCount: number, topSimilarity: number | null, lexicalHits: number): Confidence {
  if (hitCount === 0) return 'none';
  if (topSimilarity !== null) {
    if (topSimilarity >= CONFIDENCE_THRESHOLDS.high) return 'high';
    if (topSimilarity >= CONFIDENCE_THRESHOLDS.medium) return 'medium';
    return lexicalHits > 0 ? 'medium' : 'low';
  }
  // Lexical only: no calibrated score, so be conservative.
  return lexicalHits >= 3 ? 'medium' : 'low';
}
