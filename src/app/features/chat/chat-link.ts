import { Params } from '@angular/router';
import { SourceMeta } from '../../data/chunk-repository';

export interface ChatLink {
  readonly commands: readonly string[];
  readonly queryParams: Params;
}

/** `/chat/:owner/:repo?path=folder`. Source ids contain `/` and `:`, so we build URL parts explicitly. */
export function chatLink(source: Pick<SourceMeta, 'owner' | 'repo' | 'path'>): ChatLink {
  return {
    commands: ['/chat', source.owner, source.repo],
    queryParams: source.path ? { path: source.path } : {},
  };
}
