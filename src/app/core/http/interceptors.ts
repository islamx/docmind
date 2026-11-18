import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, retry, throwError, timer } from 'rxjs';
import { APP_SETTINGS } from '../config/app-settings';
import { AppError } from '../errors/app-error';

/** Network failures (status 0) and 5xx are worth retrying; 4xx never are. */
export function isTransient(error: unknown): boolean {
  return error instanceof HttpErrorResponse && (error.status === 0 || error.status >= 500);
}

/**
 * Retries idempotent GETs with exponential backoff. Writes are never retried:
 * replaying a POST is not safe in general.
 */
export const retryInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.method !== 'GET') return next(req);
  return next(req).pipe(
    retry({
      count: 2,
      delay: (error, attempt) => (isTransient(error) ? timer(250 * 2 ** (attempt - 1)) : throwError(() => error)),
    }),
  );
};

/** Maps GitHub's HTTP failures to domain errors the UI can explain. */
export const githubErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const { apiBase, rawBase } = inject(APP_SETTINGS).github;
  if (!req.url.startsWith(apiBase) && !req.url.startsWith(rawBase)) return next(req);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) return throwError(() => error);
      const exhausted = error.headers?.get('x-ratelimit-remaining') === '0';
      if (error.status === 429 || (error.status === 403 && exhausted)) {
        return throwError(() => new AppError('github_rate_limit', undefined, { cause: error }));
      }
      if (error.status === 404) return throwError(() => new AppError('repo_not_found', undefined, { cause: error }));
      if (error.status === 0) return throwError(() => new AppError('network', undefined, { cause: error }));
      return throwError(() => error);
    }),
  );
};
