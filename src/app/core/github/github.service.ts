import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { EMPTY, Observable, catchError, from, map, mergeMap } from 'rxjs';
import { RepoFile, RepoRef, selectFiles } from '../../rag/github';
import { SourceDoc } from '../../rag/models';
import { APP_SETTINGS } from '../config/app-settings';
import { AppError } from '../errors/app-error';

interface TreeResponse {
  readonly tree: readonly { readonly path: string; readonly type: string; readonly size?: number }[];
}

/**
 * Reads public repositories without a token: one tree call, then raw file downloads.
 * Raw downloads are not subject to the REST API rate limit, which keeps big repos usable.
 */
@Injectable({ providedIn: 'root' })
export class GithubService {
  private readonly http = inject(HttpClient);
  private readonly settings = inject(APP_SETTINGS);

  listFiles(ref: RepoRef): Observable<RepoFile[]> {
    const url = `${this.settings.github.apiBase}/repos/${ref.owner}/${ref.repo}/git/trees/HEAD?recursive=1`;
    return this.http.get<TreeResponse>(url).pipe(
      map((response) => {
        const blobs = response.tree
          .filter((node) => node.type === 'blob')
          .map((node) => ({ path: node.path, size: node.size ?? 0 }));
        const files = selectFiles(blobs, ref, this.settings.fileFilter);
        if (files.length === 0) throw new AppError('repo_empty');
        return files;
      }),
    );
  }

  /**
   * Downloads with bounded concurrency (`mergeMap`'s second argument). A file that fails is
   * skipped instead of aborting the whole import: one 404 must not lose 299 good files.
   */
  download(ref: RepoRef, files: readonly RepoFile[]): Observable<SourceDoc> {
    const { rawBase, downloadConcurrency } = this.settings.github;
    return from(files).pipe(
      mergeMap(
        (file) =>
          this.http
            .get(`${rawBase}/${ref.owner}/${ref.repo}/HEAD/${encodeURI(file.path)}`, { responseType: 'text' })
            .pipe(
              map((text): SourceDoc => ({ path: file.path, text })),
              catchError(() => EMPTY),
            ),
        downloadConcurrency,
      ),
    );
  }
}
