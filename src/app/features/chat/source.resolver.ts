import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, RedirectCommand, ResolveFn, Router } from '@angular/router';
import { ChunkRepository, SourceMeta } from '../../data/chunk-repository';
import { sourceId } from '../../rag/github';

/**
 * Resolves the source for `/chat/:owner/:repo?path=`. If it was never indexed (or was removed),
 * redirect home instead of rendering a broken page. The result is bound to the component's
 * `source` input via `withComponentInputBinding()`.
 */
export const sourceResolver: ResolveFn<SourceMeta | RedirectCommand> = async (route: ActivatedRouteSnapshot) => {
  const owner = route.paramMap.get('owner') ?? '';
  const repo = route.paramMap.get('repo') ?? '';
  const path = route.queryParamMap.get('path') ?? '';
  // Inject before the first await: after it, the injection context is gone.
  const repository = inject(ChunkRepository);
  const home = inject(Router).parseUrl('/');
  const meta = await repository.getSource(sourceId({ owner, repo, path }));
  return meta ?? new RedirectCommand(home);
};
