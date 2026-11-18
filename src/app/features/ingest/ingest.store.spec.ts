import { TestBed } from '@angular/core/testing';
import { Subject, throwError } from 'rxjs';
import { AppError } from '../../core/errors/app-error';
import { SearchIndexService } from '../../core/search/search-index.service';
import { LibraryStore } from '../../core/state/library.store';
import { ChunkRepository, SourceMeta } from '../../data/chunk-repository';
import { MemoryChunkRepository } from '../../data/memory-chunk-repository';
import { IngestEvent, IngestionService } from './ingestion.service';
import { IngestStore } from './ingest.store';

const meta: SourceMeta = {
  id: 'o/r',
  owner: 'o',
  repo: 'r',
  path: '',
  fileCount: 2,
  chunkCount: 10,
  embeddedCount: 0,
  status: 'embedding',
  indexedAt: 1,
};
const ref = { owner: 'o', repo: 'r', path: '' };

describe('IngestStore', () => {
  let events$: Subject<IngestEvent>;
  let ingest: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    events$ = new Subject<IngestEvent>();
    ingest = vi.fn(() => events$);
    TestBed.configureTestingModule({
      providers: [
        { provide: IngestionService, useValue: { ingest } },
        { provide: ChunkRepository, useClass: MemoryChunkRepository },
        { provide: SearchIndexService, useValue: { invalidate: vi.fn() } },
      ],
    });
  });

  it('walks through phases and exposes progress', () => {
    const store = TestBed.inject(IngestStore);
    store.start(ref);
    expect(store.isPending()).toBe(true);
    expect(store.phase()).toBe('listing');

    events$.next({ phase: 'downloading', done: 5, total: 10 });
    expect(store.fraction()).toBe(0.5);

    events$.next({ phase: 'chunking', chunks: 10 });
    expect(store.fraction()).toBeNull();
  });

  it('allows chat as soon as the source is searchable and registers it in the library', () => {
    const store = TestBed.inject(IngestStore);
    const library = TestBed.inject(LibraryStore);
    store.start(ref);
    expect(store.canChat()).toBe(false);

    events$.next({ phase: 'searchable', meta });
    expect(store.canChat()).toBe(true);
    expect(store.isFinished()).toBe(false);
    expect(library.sources().map((s) => s.id)).toContain('o/r');
  });

  it('marks success when done', () => {
    const store = TestBed.inject(IngestStore);
    store.start(ref);
    events$.next({ phase: 'done', meta: { ...meta, status: 'ready' } });
    expect(store.isFinished()).toBe(true);
    expect(store.status()).toBe('success');
  });

  it('records a typed error code on failure', () => {
    ingest.mockReturnValue(throwError(() => new AppError('repo_not_found')));
    const store = TestBed.inject(IngestStore);
    store.start(ref);
    expect(store.isError()).toBe(true);
    expect(store.errorCode()).toBe('repo_not_found');
  });

  it('cancel() stops the stream and resets', () => {
    const store = TestBed.inject(IngestStore);
    store.start(ref);
    events$.next({ phase: 'downloading', done: 1, total: 3 });
    store.cancel();
    expect(store.phase()).toBe('idle');
    expect(store.status()).toBe('idle');
    expect(events$.observed).toBe(false);
  });
});

describe('LibraryStore', () => {
  it('loads, upserts newest first and removes', async () => {
    const repo = new MemoryChunkRepository();
    await repo.saveSource(meta, []);
    TestBed.configureTestingModule({
      providers: [
        { provide: ChunkRepository, useValue: repo },
        { provide: SearchIndexService, useValue: { invalidate: vi.fn() } },
      ],
    });
    const library = TestBed.inject(LibraryStore);
    await library.load();
    expect(library.sources()).toHaveLength(1);

    library.upsert({ ...meta, id: 'x/y' });
    expect(library.sources().map((s) => s.id)).toEqual(['x/y', 'o/r']);

    await library.remove('o/r');
    expect(library.sources().map((s) => s.id)).toEqual(['x/y']);
    expect(await repo.getSource('o/r')).toBeUndefined();
  });
});
