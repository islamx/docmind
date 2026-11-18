# ADR 3: Retrieval runs in the browser

**Status:** accepted

**Context.** Goal is zero running cost and no user data on a server.

**Decision.**
- Embeddings: `all-MiniLM-L6-v2` (quantized) via Transformers.js inside a Web Worker.
- Storage: IndexedDB. Vectors are stored with chunks.
- Search: BM25 + cosine similarity, merged with Reciprocal Rank Fusion. Hybrid beats either alone on code and docs, where exact identifiers matter.
- Chunks are searchable by BM25 *before* embeddings finish, so chat is usable immediately.

**Trade-offs.** First visit downloads ~25 MB model (cached afterwards). Model is English-centric; Arabic questions over English docs rely more on BM25 and the LLM. Acceptable for a demo; documented.

**Rejected.** Server vector DB (cost, privacy); WebLLM in-browser generation (WebGPU requirement, multi-GB download).
