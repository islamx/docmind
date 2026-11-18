import { Injectable } from '@angular/core';
import { AppError } from '../core/errors/app-error';
import { Chunk } from '../rag/models';
import { ChunkRepository, SourceMeta, VectorEntry } from './chunk-repository';

const DB_NAME = 'docmind';
const DB_VERSION = 1;

interface ChunkRow {
  key: string;
  sourceId: string;
  chunk: Chunk;
}
interface VectorRow {
  key: string;
  sourceId: string;
  chunkId: string;
  vector: Float32Array;
}

const rowKey = (sourceId: string, id: string) => `${sourceId}::${id}`;

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function finished(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** Thin promise wrapper over IndexedDB. Three stores: sources, chunks, vectors. */
@Injectable()
export class IndexedDbChunkRepository extends ChunkRepository {
  private dbPromise?: Promise<IDBDatabase>;

  private db(): Promise<IDBDatabase> {
    this.dbPromise ??= new Promise((resolve, reject) => {
      const open = indexedDB.open(DB_NAME, DB_VERSION);
      open.onupgradeneeded = () => {
        const db = open.result;
        db.createObjectStore('sources', { keyPath: 'id' });
        db.createObjectStore('chunks', { keyPath: 'key' }).createIndex('bySource', 'sourceId');
        db.createObjectStore('vectors', { keyPath: 'key' }).createIndex('bySource', 'sourceId');
      };
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(new AppError('storage', undefined, { cause: open.error }));
    });
    return this.dbPromise;
  }

  async listSources(): Promise<SourceMeta[]> {
    const db = await this.db();
    const all = await request<SourceMeta[]>(db.transaction('sources').objectStore('sources').getAll());
    return all.sort((a, b) => b.indexedAt - a.indexedAt);
  }

  async getSource(id: string): Promise<SourceMeta | undefined> {
    const db = await this.db();
    return request<SourceMeta | undefined>(db.transaction('sources').objectStore('sources').get(id));
  }

  async saveSource(meta: SourceMeta, chunks: readonly Chunk[]): Promise<void> {
    await this.deleteSource(meta.id);
    const db = await this.db();
    const tx = db.transaction(['sources', 'chunks'], 'readwrite');
    tx.objectStore('sources').put(meta);
    const store = tx.objectStore('chunks');
    for (const chunk of chunks)
      store.put({ key: rowKey(meta.id, chunk.id), sourceId: meta.id, chunk } satisfies ChunkRow);
    await finished(tx);
  }

  async updateMeta(meta: SourceMeta): Promise<void> {
    const db = await this.db();
    const tx = db.transaction('sources', 'readwrite');
    tx.objectStore('sources').put(meta);
    await finished(tx);
  }

  async saveVectors(sourceId: string, entries: readonly VectorEntry[]): Promise<void> {
    const db = await this.db();
    const tx = db.transaction('vectors', 'readwrite');
    const store = tx.objectStore('vectors');
    for (const { id, vector } of entries) {
      store.put({ key: rowKey(sourceId, id), sourceId, chunkId: id, vector } satisfies VectorRow);
    }
    await finished(tx);
  }

  async loadChunks(sourceId: string): Promise<Chunk[]> {
    const db = await this.db();
    const rows = await request<ChunkRow[]>(
      db.transaction('chunks').objectStore('chunks').index('bySource').getAll(sourceId),
    );
    return rows.map((r) => r.chunk).sort((a, b) => a.path.localeCompare(b.path) || a.startLine - b.startLine);
  }

  async loadVectors(sourceId: string): Promise<Map<string, Float32Array>> {
    const db = await this.db();
    const rows = await request<VectorRow[]>(
      db.transaction('vectors').objectStore('vectors').index('bySource').getAll(sourceId),
    );
    return new Map(rows.map((r) => [r.chunkId, r.vector]));
  }

  async deleteSource(id: string): Promise<void> {
    const db = await this.db();
    const tx = db.transaction(['sources', 'chunks', 'vectors'], 'readwrite');
    tx.objectStore('sources').delete(id);
    for (const name of ['chunks', 'vectors'] as const) {
      const store = tx.objectStore(name);
      const keys = store.index('bySource').getAllKeys(id);
      keys.onsuccess = () => keys.result.forEach((k) => store.delete(k));
    }
    await finished(tx);
  }
}
