import { signal } from '@angular/core';
import { Embedder, EmbedderStatus } from '../app/core/embedding/embedder';
import { Chunk } from '../app/rag/models';
import { normalize } from '../app/rag/vector';

/** Deterministic bag-of-words embedder: similar text gives similar vectors. No model needed. */
export class FakeEmbedder extends Embedder {
  readonly status = signal<EmbedderStatus>('ready').asReadonly();
  readonly progress = signal(1).asReadonly();
  calls = 0;
  failWith: Error | null = null;

  async embed(texts: readonly string[]): Promise<Float32Array[]> {
    this.calls++;
    if (this.failWith) throw this.failWith;
    return texts.map((text) => {
      const v = new Float32Array(32);
      for (const word of text.toLowerCase().match(/[a-z]+/g) ?? []) {
        let h = 0;
        for (const ch of word) h = (h * 31 + ch.charCodeAt(0)) % 32;
        v[h] += 1;
      }
      return normalize(v);
    });
  }
}

export const makeChunk = (id: string, text: string, heading = ''): Chunk => ({
  id,
  path: `docs/${id}.md`,
  heading,
  startLine: 1,
  endLine: 4,
  text,
});
