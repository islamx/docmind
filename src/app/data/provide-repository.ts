import { Provider } from '@angular/core';
import { ChunkRepository } from './chunk-repository';
import { IndexedDbChunkRepository } from './indexeddb-chunk-repository';
import { MemoryChunkRepository } from './memory-chunk-repository';

/** Picks the implementation at runtime: IndexedDB when present, memory otherwise. */
export function provideChunkRepository(): Provider {
  return {
    provide: ChunkRepository,
    useClass: typeof indexedDB === 'undefined' ? MemoryChunkRepository : IndexedDbChunkRepository,
  };
}
