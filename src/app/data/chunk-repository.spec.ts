import { IDBFactory } from 'fake-indexeddb';
import { ChunkRepository, SourceMeta } from './chunk-repository';
import { IndexedDbChunkRepository } from './indexeddb-chunk-repository';
import { MemoryChunkRepository } from './memory-chunk-repository';
import { makeChunk } from '../../testing/fakes';

const meta = (id: string, indexedAt = 1): SourceMeta => ({
  id,
  owner: 'o',
  repo: 'r',
  path: '',
  fileCount: 1,
  chunkCount: 2,
  embeddedCount: 0,
  status: 'embedding',
  indexedAt,
});

/** One contract, run against every implementation: they must be interchangeable. */
const implementations: [string, () => ChunkRepository][] = [
  ['MemoryChunkRepository', () => new MemoryChunkRepository()],
  ['IndexedDbChunkRepository', () => new IndexedDbChunkRepository()],
];

describe.each(implementations)('%s', (_name, create) => {
  let repo: ChunkRepository;
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory(); // fresh database per test
    repo = create();
  });

  it('saves a source and loads its chunks', async () => {
    await repo.saveSource(meta('a/b'), [makeChunk('c1', 'one text'), makeChunk('c2', 'two text')]);
    expect(await repo.getSource('a/b')).toMatchObject({ id: 'a/b' });
    expect((await repo.loadChunks('a/b')).map((c) => c.id)).toEqual(['c1', 'c2']);
  });

  it('keeps chunks of different sources apart', async () => {
    await repo.saveSource(meta('s1'), [makeChunk('c1', 'one')]);
    await repo.saveSource(meta('s2'), [makeChunk('c1', 'other')]);
    expect((await repo.loadChunks('s1'))[0].text).toBe('one');
    expect((await repo.loadChunks('s2'))[0].text).toBe('other');
  });

  it('stores and returns vectors', async () => {
    await repo.saveSource(meta('s'), [makeChunk('c1', 'x')]);
    await repo.saveVectors('s', [{ id: 'c1', vector: new Float32Array([0.5, 0.25]) }]);
    const vectors = await repo.loadVectors('s');
    expect([...(vectors.get('c1') ?? [])]).toEqual([0.5, 0.25]);
  });

  it('re-saving a source replaces chunks and vectors', async () => {
    await repo.saveSource(meta('s'), [makeChunk('old', 'x')]);
    await repo.saveVectors('s', [{ id: 'old', vector: new Float32Array([1]) }]);
    await repo.saveSource(meta('s'), [makeChunk('new', 'y')]);
    expect((await repo.loadChunks('s')).map((c) => c.id)).toEqual(['new']);
    expect((await repo.loadVectors('s')).size).toBe(0);
  });

  it('lists newest first and deletes everything for a source', async () => {
    await repo.saveSource(meta('old', 1), [makeChunk('c', 'x')]);
    await repo.saveSource(meta('new', 2), [makeChunk('c', 'x')]);
    expect((await repo.listSources()).map((s) => s.id)).toEqual(['new', 'old']);

    await repo.deleteSource('old');
    expect(await repo.getSource('old')).toBeUndefined();
    expect(await repo.loadChunks('old')).toEqual([]);
  });

  it('updates metadata in place', async () => {
    await repo.saveSource(meta('s'), []);
    await repo.updateMeta({ ...meta('s'), status: 'ready', embeddedCount: 2 });
    expect((await repo.getSource('s'))?.status).toBe('ready');
  });
});
