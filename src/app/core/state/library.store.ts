import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withHooks, withMethods, withState } from '@ngrx/signals';
import { ChunkRepository, SourceMeta } from '../../data/chunk-repository';
import { SearchIndexService } from '../search/search-index.service';

interface LibraryState {
  readonly sources: readonly SourceMeta[];
  readonly loaded: boolean;
}

/** The user's indexed sources. Root-scoped: shared by the home and chat pages. */
export const LibraryStore = signalStore(
  { providedIn: 'root' },
  withState<LibraryState>({ sources: [], loaded: false }),
  withComputed(({ sources }) => ({
    isEmpty: computed(() => sources().length === 0),
  })),
  withMethods((store, repository = inject(ChunkRepository), searchIndex = inject(SearchIndexService)) => ({
    async load(): Promise<void> {
      try {
        patchState(store, { sources: await repository.listSources(), loaded: true });
      } catch {
        patchState(store, { sources: [], loaded: true });
      }
    },
    /** Insert or replace one source, newest first. */
    upsert(meta: SourceMeta): void {
      patchState(store, (s) => ({
        sources: [meta, ...s.sources.filter((x) => x.id !== meta.id)],
      }));
    },
    async remove(id: string): Promise<void> {
      await repository.deleteSource(id);
      searchIndex.invalidate(id);
      patchState(store, (s) => ({ sources: s.sources.filter((x) => x.id !== id) }));
    },
  })),
  withHooks({
    onInit(store) {
      void store.load();
    },
  }),
);
