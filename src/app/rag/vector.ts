/** Dot product. Equals cosine similarity because the embedder returns unit vectors. */
export function dot(a: Float32Array, b: Float32Array): number {
  const n = Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < n; i++) sum += a[i] * b[i];
  return sum;
}

export function normalize(v: Float32Array): Float32Array {
  let norm = 0;
  for (const x of v) norm += x * x;
  norm = Math.sqrt(norm) || 1;
  return v.map((x) => x / norm);
}

export interface VectorHit {
  readonly id: string;
  readonly score: number;
}

/** Brute-force top-k. Fine up to ~50k chunks; an ANN index would be the next step. */
export function topK(query: Float32Array, vectors: ReadonlyMap<string, Float32Array>, k: number): VectorHit[] {
  const hits: VectorHit[] = [];
  for (const [id, vector] of vectors) hits.push({ id, score: dot(query, vector) });
  return hits.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, k);
}
