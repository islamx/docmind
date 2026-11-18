import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { Subject, catchError, EMPTY, finalize, pipe, switchMap, takeUntil, tap } from 'rxjs';
import { toAppError } from '../../core/errors/app-error';
import { LibraryStore } from '../../core/state/library.store';
import { setError, setIdle, setPending, setSuccess, withRequestStatus } from '../../core/state/with-request-status';
import { SourceMeta } from '../../data/chunk-repository';
import { RepoRef } from '../../rag/github';
import { IngestEvent, IngestionService } from './ingestion.service';

export type IngestPhase = IngestEvent['phase'] | 'idle';

interface IngestState {
  readonly phase: IngestPhase;
  readonly done: number;
  readonly total: number;
  readonly chunks: number;
  readonly meta: SourceMeta | null;
}

const INITIAL: IngestState = { phase: 'idle', done: 0, total: 0, chunks: 0, meta: null };

export const IngestStore = signalStore(
  { providedIn: 'root' },
  withState<IngestState>(INITIAL),
  withRequestStatus(),
  withComputed(({ phase, done, total, meta }) => ({
    /** Chat can start as soon as passages are persisted, before embeddings finish. */
    canChat: computed(() => meta() !== null),
    isFinished: computed(() => phase() === 'done'),
    /** 0..1 within the current phase, or null when the phase has no countable progress. */
    fraction: computed(() => (total() > 0 && (phase() === 'downloading' || phase() === 'embedding') ? done() / total() : null)),
  })),
  withMethods((store, ingestion = inject(IngestionService), library = inject(LibraryStore)) => {
    const cancel$ = new Subject<void>();

    const apply = (event: IngestEvent): void => {
      switch (event.phase) {
        case 'listing':
          patchState(store, { ...INITIAL, phase: 'listing' });
          break;
        case 'downloading':
        case 'embedding':
          patchState(store, { phase: event.phase, done: event.done, total: event.total });
          break;
        case 'chunking':
          patchState(store, { phase: 'chunking', chunks: event.chunks });
          break;
        case 'searchable':
          library.upsert(event.meta);
          patchState(store, { phase: 'embedding', meta: event.meta, done: 0, total: event.meta.chunkCount });
          break;
        case 'done':
          library.upsert(event.meta);
          patchState(store, { phase: 'done', meta: event.meta }, setSuccess());
          break;
      }
    };

    return {
      start: rxMethod<RepoRef>(
        pipe(
          tap(() => patchState(store, { ...INITIAL, phase: 'listing' }, setPending())),
          // A new import cancels the one in flight.
          switchMap((ref) =>
            ingestion.ingest(ref).pipe(
              tap(apply),
              takeUntil(cancel$),
              catchError((error: unknown) => {
                patchState(store, { phase: 'idle' }, setError(toAppError(error).code));
                return EMPTY;
              }),
              finalize(() => {
                if (store.status() === 'pending') patchState(store, setIdle());
              }),
            ),
          ),
        ),
      ),
      cancel(): void {
        cancel$.next();
        patchState(store, INITIAL, setIdle());
      },
      reset(): void {
        patchState(store, INITIAL, setIdle());
      },
    };
  }),
);
