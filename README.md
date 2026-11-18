# DocMind

Ask any public GitHub repo or docs folder. Get answers with citations to the exact lines.

**Live demo: https://docmind-islamx.vercel.app**

Indexing and search run in your browser. Only answer generation calls a server, and the app works without it.

A proof of concept built to show production-grade Angular: a real RAG pipeline on free resources, not a todo list.

## What it does

1. Paste `owner/repo` or a GitHub folder URL.
2. DocMind downloads the files, splits them into passages, and builds a keyword index immediately and a semantic index in a Web Worker.
3. Ask a question. It retrieves the best passages, streams an answer, and links every claim to the source lines.

No LLM key? You still get the best passages, verbatim, with citations.

## Architecture

```
GitHub ─► chunk ─► IndexedDB ─► BM25 ─┐
                       └► embeddings ─┴► RRF ─► prompt ─► /api/chat ─► LLM
                          (Web Worker)                       └► extractive fallback
```

- `src/app/rag`: pure TypeScript pipeline, no Angular.
- `src/app/core`: DI tokens, interceptors, error handling, i18n, theme, embedder.
- `src/app/data`: persistence port with IndexedDB and in-memory adapters.
- `src/app/features`: lazy `ingest` and `chat` features with SignalStores.
- `api/`: one Vercel function, an OpenAI-compatible streaming proxy.

Details: [docs/architecture.md](docs/architecture.md).

## Angular concepts covered

| Area | Highlights |
|---|---|
| State | Signals, `computed`, `linkedSignal`, `resource`, NgRx SignalStore, custom store feature |
| DI | Abstract ports, `InjectionToken` factories, functional providers, `ErrorHandler` override |
| Streams | `mergeMap` concurrency, `switchMap` cancellation, retry backoff, SSE over HttpClient |
| Performance | Zoneless, OnPush, `@defer`, lazy routes, CDK virtual scroll, Web Worker |
| Routing | Resolvers, `RedirectCommand`, input binding, view transitions |
| UI | Typed reactive forms, EN/AR runtime i18n with RTL, accessibility, sanitized markdown |
| Quality | ~130 tests, strict TypeScript, CI, size budgets |

Each concept with file links: [docs/concepts](docs/concepts/README.md).

## Decisions

[Signals vs RxJS](docs/adr/0001-signals-and-rxjs.md) ·
[SignalStore](docs/adr/0002-ngrx-signalstore.md) ·
[Browser-side retrieval](docs/adr/0003-browser-side-retrieval.md) ·
[LLM proxy and fallback](docs/adr/0004-llm-proxy-and-fallback.md) ·
[Zoneless SPA](docs/adr/0005-zoneless-onpush-spa.md) ·
[Runtime i18n](docs/adr/0006-i18n.md)

## Run locally

Node 22 or newer.

```bash
npm install
npm start          # http://localhost:4200
npm run test:all   # unit tests (Angular + API)
npm run build
```

Without an API the app answers with extractive passages. To enable generated answers, run `vercel dev` with these variables:

| Variable | Default | Purpose |
|---|---|---|
| `LLM_API_KEY` | none | Provider key. Unset means extractive mode |
| `LLM_BASE_URL` | `https://api.groq.com/openai/v1` | Any OpenAI-compatible endpoint |
| `LLM_MODEL` | `llama-3.3-70b-versatile` | Model id |

Groq and Gemini both have free tiers. Gemini: `https://generativelanguage.googleapis.com/v1beta/openai`.

## Limits and roadmap

- English embedding model: Arabic questions over English docs have lower recall.
- Brute-force vector search, fine to about 50k passages.
- Public repos only. Fixed-window rate limit is per server instance.
- Next: Playwright end-to-end tests, re-ranking, incremental re-indexing, shared rate-limit store.

## License

MIT
