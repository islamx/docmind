import { Injectable, inject } from '@angular/core';
import { ChunkRepository } from '../../data/chunk-repository';
import { Chunk, SearchResult } from '../../rag/models';
import { HybridRetriever } from '../../rag/retriever';
import { Embedder } from '../embedding/embedder';

interface LoadedIndex {
  readonly chunks: Chunk[];
  readonly retriever: HybridRetriever;
}

/**
 * Bridges persistence and the pure retriever. Builds an index per source once and caches
 * the promise, so concurrent callers share one load.
 */
@Injectable({ providedIn: 'root' })
export class SearchIndexService {
  private readonly repository = inject(ChunkRepository);
  private readonly embedder = inject(Embedder);
  private readonly cache = new Map<string, Promise<LoadedIndex>>();

  chunks(sourceId: string): Promise<Chunk[]> {
    return this.index(sourceId).then((i) => i.chunks);
  }

  /** Drop the cached index, e.g. after embeddings finished and vectors are now available. */
  invalidate(sourceId: string): void {
    this.cache.delete(sourceId);
  }

  async search(sourceId: string, query: string, limit: number): Promise<SearchResult> {
    const { retriever } = await this.index(sourceId);
    return retriever.search(query, await this.embedQuery(retriever, query), limit);
  }

  private async embedQuery(retriever: HybridRetriever, query: string): Promise<Float32Array | null> {
    if (!retriever.hasVectors) return null;
    try {
      const [vector] = await this.embedder.embed([query]);
      return vector ?? null;
    } catch {
      return null; // keyword-only is a valid degraded mode
    }
  }

  private index(sourceId: string): Promise<LoadedIndex> {
    let entry = this.cache.get(sourceId);
    if (!entry) {
      entry = this.build(sourceId);
      this.cache.set(sourceId, entry);
      entry.catch(() => this.cache.delete(sourceId));
    }
    return entry;
  }

  private async build(sourceId: string): Promise<LoadedIndex> {
    const [chunks, vectors] = await Promise.all([
      this.repository.loadChunks(sourceId),
      this.repository.loadVectors(sourceId),
    ]);
    return { chunks, retriever: new HybridRetriever(chunks, vectors) };
  }
}
