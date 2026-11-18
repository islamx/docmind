export interface Bm25Doc {
  readonly id: string;
  readonly tokens: readonly string[];
}

export interface Bm25Hit {
  readonly id: string;
  readonly score: number;
}

/** Okapi BM25. Small, dependency-free, rebuilt from chunks on load (milliseconds). */
export class Bm25Index {
  private readonly termFreqs = new Map<string, Map<string, number>>(); // term -> docId -> tf
  private readonly docLengths = new Map<string, number>();
  private readonly avgLength: number;

  constructor(
    docs: readonly Bm25Doc[],
    private readonly k1 = 1.5,
    private readonly b = 0.75,
  ) {
    let total = 0;
    for (const doc of docs) {
      this.docLengths.set(doc.id, doc.tokens.length);
      total += doc.tokens.length;
      for (const token of doc.tokens) {
        let postings = this.termFreqs.get(token);
        if (!postings) this.termFreqs.set(token, (postings = new Map()));
        postings.set(doc.id, (postings.get(doc.id) ?? 0) + 1);
      }
    }
    this.avgLength = docs.length ? total / docs.length : 0;
  }

  get size(): number {
    return this.docLengths.size;
  }

  search(queryTokens: readonly string[], limit: number): Bm25Hit[] {
    const n = this.docLengths.size;
    const scores = new Map<string, number>();

    for (const term of new Set(queryTokens)) {
      const postings = this.termFreqs.get(term);
      if (!postings) continue;
      const idf = Math.log(1 + (n - postings.size + 0.5) / (postings.size + 0.5));
      for (const [id, tf] of postings) {
        const len = this.docLengths.get(id) ?? 0;
        const norm = tf + this.k1 * (1 - this.b + (this.b * len) / (this.avgLength || 1));
        scores.set(id, (scores.get(id) ?? 0) + (idf * tf * (this.k1 + 1)) / norm);
      }
    }

    return [...scores]
      .map(([id, score]) => ({ id, score }))
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
      .slice(0, limit);
  }
}
