# RxJS where it earns its place

Streams over time, cancellation, concurrency. Not for plain state.

| Need | Operator / API | File |
|---|---|---|
| Bounded parallel downloads | `mergeMap(fn, concurrency)` | [github.service.ts](../../src/app/core/github/github.service.ts) |
| Skip one failed file, keep the import | `catchError(() => EMPTY)` | same |
| Ordered pipeline phases | `concat`, `defer`, `switchMap` | [ingestion.service.ts](../../src/app/features/ingest/ingestion.service.ts) |
| Async generator as a stream | `from(asyncIterable)` | same |
| Cancel on new request | `rxMethod` + `switchMap` | [ingest.store.ts](../../src/app/features/ingest/ingest.store.ts), [chat.store.ts](../../src/app/features/chat/chat.store.ts) |
| User-triggered stop | `takeUntil(cancel$)` + `finalize` | [chat.store.ts](../../src/app/features/chat/chat.store.ts) |
| Retry with backoff | `retry({ count, delay })` | [interceptors.ts](../../src/app/core/http/interceptors.ts) |

## Streaming tokens over HttpClient

[`ChatApi`](../../src/app/features/chat/chat-api.service.ts) uses `withFetch()` and `reportProgress`. The growing body arrives as `partialText`, which feeds an [incremental SSE parser](../../src/app/rag/sse.ts) that handles frames split across network chunks. Unsubscribing aborts the request. Because it is plain HttpClient, interceptors and `HttpTestingController` still work.

## Interceptors

Functional, composed in [app.config.ts](../../src/app/app.config.ts):

1. `githubErrorInterceptor` maps 403 with exhausted rate limit, 404 and network failure to typed `AppError`s.
2. `retryInterceptor` retries only idempotent GETs, only on network or 5xx.

Order matters: the first interceptor wraps the rest, so errors are mapped after retries ran.
