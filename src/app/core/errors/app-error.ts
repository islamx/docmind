export type AppErrorCode =
  'github_rate_limit' | 'repo_not_found' | 'repo_empty' | 'network' | 'embedding_unavailable' | 'storage' | 'unknown';

/** Domain error with a stable code the UI can translate. */
export class AppError extends Error {
  constructor(
    readonly code: AppErrorCode,
    message?: string,
    options?: ErrorOptions,
  ) {
    super(message ?? code, options);
    this.name = 'AppError';
  }
}

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  const message = error instanceof Error ? error.message : String(error);
  return new AppError('unknown', message, { cause: error });
}
