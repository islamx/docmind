/** Domain types. No framework imports allowed in this folder. */

export interface SourceDoc {
  readonly path: string;
  readonly text: string;
}

export interface Chunk {
  /** Stable id: `<path>#<startLine>`. */
  readonly id: string;
  readonly path: string;
  /** Heading breadcrumb, e.g. "Signals > Computed". Empty for code. */
  readonly heading: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly text: string;
}

export interface ScoredChunk {
  readonly chunk: Chunk;
  readonly score: number;
}

export type Confidence = 'high' | 'medium' | 'low' | 'none';

export interface SearchResult {
  readonly hits: readonly ScoredChunk[];
  /** Best cosine similarity when vectors were used, otherwise null. */
  readonly topSimilarity: number | null;
  readonly confidence: Confidence;
  readonly usedVectors: boolean;
}

export interface Citation {
  /** 1-based number shown to the user and used in `[n]` markers. */
  readonly n: number;
  readonly chunk: Chunk;
}
