import { Injectable } from '@angular/core';
import { Chunk } from '../rag/models';
import { ChunkRepository, SourceMeta, VectorEntry } from './chunk-repository';

/** In-memory implementation: used in tests and as the fallback when IndexedDB is unavailable. */
@Injectable()
export class MemoryChunkRepository extends ChunkRepository {
  private readonly sources = new Map<string, SourceMeta>();
  private readonly chunks = new Map<string, Chunk[]>();
  private readonly vectors = new Map<string, Map<string, Float32Array>>();

  async listSources(): Promise<SourceMeta[]> {
    return [...this.sources.values()].sort((a, b) => b.indexedAt - a.indexedAt);
  }

  async getSource(id: string): Promise<SourceMeta | undefined> {
    return this.sources.get(id);
  }

  async saveSource(meta: SourceMeta, chunks: readonly Chunk[]): Promise<void> {
    this.sources.set(meta.id, meta);
    this.chunks.set(meta.id, [...chunks]);
    this.vectors.set(meta.id, new Map());
  }

  async updateMeta(meta: SourceMeta): Promise<void> {
    this.sources.set(meta.id, meta);
  }

  async saveVectors(sourceId: string, entries: readonly VectorEntry[]): Promise<void> {
    const store = this.vectors.get(sourceId) ?? new Map();
    for (const { id, vector } of entries) store.set(id, vector);
    this.vectors.set(sourceId, store);
  }

  async loadChunks(sourceId: string): Promise<Chunk[]> {
    return [...(this.chunks.get(sourceId) ?? [])];
  }

  async loadVectors(sourceId: string): Promise<Map<string, Float32Array>> {
    return new Map(this.vectors.get(sourceId) ?? []);
  }

  async deleteSource(id: string): Promise<void> {
    this.sources.delete(id);
    this.chunks.delete(id);
    this.vectors.delete(id);
  }
}
