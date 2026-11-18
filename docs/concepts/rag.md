# RAG pipeline

Pure TypeScript in [`src/app/rag`](../../src/app/rag). No Angular imports, so it is portable and fast to test. Decision record: [ADR 3](../adr/0003-browser-side-retrieval.md).

```
files → chunkDocument → tokenize → BM25 index ─┐
              │                                 ├─ RRF ─→ top-k → prompt → LLM
              └→ embed (worker) → cosine top-k ─┘                    └→ extractive fallback
```

| Step | File | Note |
|---|---|---|
| Chunk | [chunker.ts](../../src/app/rag/chunker.ts) | Heading-aware, fence-aware, keeps line ranges for citations |
| Tokenize | [tokenizer.ts](../../src/app/rag/tokenizer.ts) | Splits `camelCase`, keeps Arabic |
| Lexical | [bm25.ts](../../src/app/rag/bm25.ts) | Exact terms and identifiers |
| Semantic | [vector.ts](../../src/app/rag/vector.ts) | Cosine on unit vectors |
| Fuse | [fusion.ts](../../src/app/rag/fusion.ts) | Reciprocal Rank Fusion: no score calibration needed |
| Orchestrate | [retriever.ts](../../src/app/rag/retriever.ts) | Vectors optional, confidence level |
| Prompt | [prompt.ts](../../src/app/rag/prompt.ts) | Numbered context, "answer only from context", language mirroring |
| Cite | [citations.ts](../../src/app/rag/citations.ts) | `[n]` markers become clickable |
| Fallback | [extractive.ts](../../src/app/rag/extractive.ts) | Best passages verbatim. Cannot hallucinate |

## Why hybrid

Docs are full of exact identifiers (`linkedSignal`, `withHooks`). Embeddings blur those; BM25 nails them. Embeddings catch paraphrases BM25 misses. RRF merges both using ranks only.

## Honesty features

- Confidence is shown, and "nothing relevant found" is a real answer: the LLM is not called when retrieval is empty.
- Every claim links to the exact lines on GitHub.
- The system prompt forbids answering outside the context.

## Limits

English embedding model. Arabic questions over English docs rely on BM25 identifier matches and the LLM, so recall is lower. No re-ranker. No incremental re-index.
