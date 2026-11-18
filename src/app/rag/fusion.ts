/**
 * Reciprocal Rank Fusion. Merges ranked lists whose scores are not comparable
 * (BM25 vs cosine) using only rank positions: score = sum of 1 / (k + rank).
 */
export function reciprocalRankFusion(
  rankings: readonly (readonly string[])[],
  k = 60,
): { id: string; score: number }[] {
  const scores = new Map<string, number>();
  for (const ranking of rankings) {
    ranking.forEach((id, index) => scores.set(id, (scores.get(id) ?? 0) + 1 / (k + index + 1)));
  }
  return [...scores]
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}
