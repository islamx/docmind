import { Injectable, inject } from '@angular/core';
import { Observable, concat, defer, from, map, of, switchMap, tap } from 'rxjs';
import { APP_SETTINGS } from '../../core/config/app-settings';
import { Embedder } from '../../core/embedding/embedder';
import { GithubService } from '../../core/github/github.service';
import { SearchIndexService } from '../../core/search/search-index.service';
import { ChunkRepository, SourceMeta } from '../../data/chunk-repository';
import { chunkDocument } from '../../rag/chunker';
import { RepoRef, sourceId } from '../../rag/github';
import { Chunk, SourceDoc } from '../../rag/models';

export type IngestEvent =
  | { readonly phase: 'listing' }
  | { readonly phase: 'downloading'; readonly done: number; readonly total: number }
  | { readonly phase: 'chunking'; readonly chunks: number }
  | { readonly phase: 'searchable'; readonly meta: SourceMeta }
  | { readonly phase: 'embedding'; readonly done: number; readonly total: number }
  | { readonly phase: 'done'; readonly meta: SourceMeta };

/**
 * The indexing pipeline as one cancellable stream:
 *   list -> download (bounded concurrency) -> chunk -> persist -> embed in batches.
 * The source becomes searchable (keyword) right after persisting, long before embeddings end.
 * Unsubscribing cancels whichever stage is running.
 */
@Injectable({ providedIn: 'root' })
export class IngestionService {
  private readonly github = inject(GithubService);
  private readonly repository = inject(ChunkRepository);
  private readonly embedder = inject(Embedder);
  private readonly searchIndex = inject(SearchIndexService);
  private readonly settings = inject(APP_SETTINGS);

  ingest(ref: RepoRef): Observable<IngestEvent> {
    // `defer` gives every subscription its own `docs` buffer.
    return defer(() => {
      const docs: SourceDoc[] = [];
      return concat(
        of<IngestEvent>({ phase: 'listing' }),
        this.github.listFiles(ref).pipe(
          switchMap((files) =>
            concat(
              of<IngestEvent>({ phase: 'downloading', done: 0, total: files.length }),
              this.github.download(ref, files).pipe(
                tap((doc) => docs.push(doc)),
                map((_, i): IngestEvent => ({ phase: 'downloading', done: i + 1, total: files.length })),
              ),
              defer(() => from(this.indexDocs(ref, docs, files.length))),
            ),
          ),
        ),
      );
    });
  }

  private async *indexDocs(ref: RepoRef, docs: readonly SourceDoc[], fileCount: number): AsyncGenerator<IngestEvent> {
    const chunks = docs.flatMap((doc) => chunkDocument(doc));
    yield { phase: 'chunking', chunks: chunks.length };

    const id = sourceId(ref);
    const base: SourceMeta = {
      id,
      owner: ref.owner,
      repo: ref.repo,
      path: ref.path,
      fileCount,
      chunkCount: chunks.length,
      embeddedCount: 0,
      status: 'embedding',
      indexedAt: Date.now(),
    };
    await this.repository.saveSource(base, chunks);
    this.searchIndex.invalidate(id);
    yield { phase: 'searchable', meta: base };

    const embeddedCount = yield* this.embedAll(id, chunks);
    const status = embeddedCount === chunks.length && chunks.length > 0 ? 'ready' : 'partial';
    const meta: SourceMeta = { ...base, embeddedCount, status };
    await this.repository.updateMeta(meta);
    this.searchIndex.invalidate(id);
    yield { phase: 'done', meta };
  }

  /** Embeds in batches and persists each batch, so a refresh mid-way keeps the progress. */
  private async *embedAll(id: string, chunks: readonly Chunk[]): AsyncGenerator<IngestEvent, number> {
    const { batchSize } = this.settings.embedding;
    let done = 0;
    try {
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        const vectors = await this.embedder.embed(batch.map((c) => `${c.heading}\n${c.text}`));
        await this.repository.saveVectors(
          id,
          batch.map((c, j) => ({ id: c.id, vector: vectors[j] })),
        );
        done += batch.length;
        yield { phase: 'embedding', done, total: chunks.length };
      }
    } catch {
      // Embedding is an enhancement. Keep what we have; the caller marks the source partial.
    }
    return done;
  }
}
