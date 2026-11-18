# Testing

`npm run test:all` runs everything. About 130 tests, no network, no model download.

| Layer | What is tested | How |
|---|---|---|
| Domain (`rag/`) | Chunking, BM25, RRF, prompt, citations, SSE parsing, repo URL parsing | Plain unit tests, no Angular |
| Services | Ingestion pipeline phases, degradation when embedding fails | Fakes injected via DI ([fakes.ts](../../src/testing/fakes.ts)) |
| HTTP | Retry only on GET and 5xx, GitHub error mapping, streaming parser | `HttpTestingController`, including `DownloadProgress` events |
| Persistence | Same contract on both repositories | `describe.each` + `fake-indexeddb` |
| Stores | Streaming, stop, supersede, fallback, mid-stream failure | Fake `ChatApi` and `SearchIndexService` |
| Components | Behaviour through the DOM: keys, a11y states, sanitization | `TestBed`, no implementation details |
| API function | Validation, rate limit, provider mapping, key never leaks | [api.spec.ts](../../api/_lib/api.spec.ts), run by plain Vitest in Node |

## Principles

- Pure logic is extracted so it can be tested without TestBed.
- Fakes over mocks: `FakeEmbedder` produces deterministic vectors, so retrieval tests are real.
- Failure paths get their own tests: missing key, rate limit, upstream drop, embedding failure.
- Tests found two real bugs during development: a stale `computed` over form state, and `inject()` after `await` in the resolver. Both are fixed and covered.

## Not covered

Browser end-to-end (Playwright) and the real embedding model are verified manually, not in CI. Listed in the [roadmap](../../README.md#roadmap).
