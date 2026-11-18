# Architecture

DocMind is a client-heavy RAG app. Indexing and retrieval run in the browser; only text generation touches a server.

```
 GitHub repo ──► GithubService (HttpClient + interceptors)
                      │ files
                      ▼
               chunkDocument()  ──► IndexedDB (chunks)         ← searchable immediately (BM25)
                      │
                      ▼
          Embedder (Web Worker, Transformers.js) ──► IndexedDB (vectors)

 question ──► HybridRetriever  (BM25 + cosine, fused with RRF)
                      │ top-k chunks = citations
                      ▼
              ChatApi ──SSE──► /api/chat (Vercel function) ──► any OpenAI-compatible LLM
                      │ fails / no key
                      ▼
              extractive answer (top passages, still cited)
```

## Layers

| Layer | Path | Rule |
|---|---|---|
| Domain | `src/app/rag` | Pure TypeScript. No Angular imports. Unit-tested in isolation. |
| Core | `src/app/core` | App-wide services, DI tokens, interceptors, error handling. |
| Data | `src/app/data` | Persistence behind an abstract `ChunkRepository`. |
| Features | `src/app/features/*` | Lazy-loaded routes. Own their state (SignalStore) and UI. |
| Shared | `src/app/shared` | Dumb, reusable pieces: pipes, directives, UI components. |
| Server | `api/` | One Vercel function plus pure helpers. |

Dependency direction: `features → core/data/rag`, `shared → rag`. `rag` depends on nothing.

## Graceful degradation

Every external dependency has a fallback, so the app never dead-ends:

| Missing | Behaviour |
|---|---|
| Embedding model fails to load | Retrieval falls back to BM25 only |
| LLM key not configured / rate limited | Answer is extractive: best passages with citations |
| IndexedDB unavailable | In-memory repository, no persistence |
| GitHub rate limit | Clear error with retry guidance |

## Concepts

See [concepts/](concepts/README.md) for where each Angular concept is used and why.
