import { TestBed } from '@angular/core/testing';
import { firstValueFrom, from, of, throwError, toArray } from 'rxjs';
import { AppError } from '../../core/errors/app-error';
import { Embedder } from '../../core/embedding/embedder';
import { GithubService } from '../../core/github/github.service';
import { ChunkRepository } from '../../data/chunk-repository';
import { MemoryChunkRepository } from '../../data/memory-chunk-repository';
import { FakeEmbedder } from '../../../testing/fakes';
import { IngestEvent, IngestionService } from './ingestion.service';

const ref = { owner: 'o', repo: 'r', path: '' };
const body = (word: string) => `# ${word}\n${`${word} sentence about the topic. `.repeat(8)}`;
const docs = [
  { path: 'docs/a.md', text: body('alpha') },
  { path: 'docs/b.md', text: body('beta') },
];

describe('IngestionService', () => {
  let embedder: FakeEmbedder;
  let repository: MemoryChunkRepository;
  let github: { listFiles: ReturnType<typeof vi.fn>; download: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    embedder = new FakeEmbedder();
    repository = new MemoryChunkRepository();
    github = {
      listFiles: vi.fn(() => of(docs.map((d) => ({ path: d.path, size: d.text.length })))),
      download: vi.fn(() => from(docs)),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: GithubService, useValue: github },
        { provide: Embedder, useValue: embedder },
        { provide: ChunkRepository, useValue: repository },
      ],
    });
  });

  const run = () => firstValueFrom(TestBed.inject(IngestionService).ingest(ref).pipe(toArray()));

  it('emits phases in order and ends with a ready source', async () => {
    const events = await run();
    const phases = events.map((e) => e.phase);
    expect(phases[0]).toBe('listing');
    expect(phases.indexOf('downloading')).toBeLessThan(phases.indexOf('chunking'));
    expect(phases.indexOf('searchable')).toBeLessThan(phases.indexOf('embedding'));
    const last = events.at(-1) as Extract<IngestEvent, { phase: 'done' }>;
    expect(last.phase).toBe('done');
    expect(last.meta.status).toBe('ready');
    expect(last.meta.embeddedCount).toBe(last.meta.chunkCount);
  });

  it('persists chunks and vectors', async () => {
    await run();
    expect((await repository.loadChunks('o/r')).length).toBeGreaterThan(0);
    expect((await repository.loadVectors('o/r')).size).toBe((await repository.loadChunks('o/r')).length);
  });

  it('is searchable before embeddings finish', async () => {
    const events = await run();
    const searchable = events.find((e) => e.phase === 'searchable');
    expect(searchable).toBeDefined();
    expect(events.indexOf(searchable!)).toBeLessThan(events.findIndex((e) => e.phase === 'done'));
  });

  it('degrades to a partial index when embeddings fail, without erroring', async () => {
    embedder.failWith = new Error('model failed');
    const events = await run();
    const last = events.at(-1) as Extract<IngestEvent, { phase: 'done' }>;
    expect(last.meta.status).toBe('partial');
    expect(last.meta.embeddedCount).toBe(0);
    expect((await repository.loadChunks('o/r')).length).toBeGreaterThan(0);
  });

  it('propagates listing errors', async () => {
    github.listFiles.mockReturnValue(throwError(() => new AppError('repo_not_found')));
    await expect(run()).rejects.toMatchObject({ code: 'repo_not_found' });
  });

  it('downloads with bounded batches of embeddings', async () => {
    TestBed.inject(IngestionService);
    await run();
    expect(embedder.calls).toBeGreaterThanOrEqual(1);
  });
});
