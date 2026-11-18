import { Chunk } from '../rag/models';

export type IndexStatus = 'embedding' | 'ready' | 'partial';

export interface SourceMeta {
  /** `owner/repo` or `owner/repo:folder`. */
  readonly id: string;
  readonly owner: string;
  readonly repo: string;
  readonly path: string;
  readonly fileCount: number;
  readonly chunkCount: number;
  readonly embeddedCount: number;
  /** `partial` means embeddings failed, so only keyword search is available. */
  readonly status: IndexStatus;
  readonly indexedAt: number;
}

export interface VectorEntry {
  readonly id: string;
  readonly vector: Float32Array;
}

/**
 * Persistence port. Features depend on this abstraction, never on IndexedDB,
 * so tests use the in-memory implementation and the app degrades when IndexedDB is blocked.
 */
export abstract class ChunkRepository {
  abstract listSources(): Promise<SourceMeta[]>;
  abstract getSource(id: string): Promise<SourceMeta | undefined>;
  /** Replaces any previous index for this source. */
  abstract saveSource(meta: SourceMeta, chunks: readonly Chunk[]): Promise<void>;
  abstract updateMeta(meta: SourceMeta): Promise<void>;
  abstract saveVectors(sourceId: string, entries: readonly VectorEntry[]): Promise<void>;
  abstract loadChunks(sourceId: string): Promise<Chunk[]>;
  abstract loadVectors(sourceId: string): Promise<Map<string, Float32Array>>;
  abstract deleteSource(id: string): Promise<void>;
}
