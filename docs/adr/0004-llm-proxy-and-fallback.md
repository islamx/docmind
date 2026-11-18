# ADR 4: Thin LLM proxy with extractive fallback

**Status:** accepted

**Context.** An API key must never ship to the browser. Free LLM tiers are rate limited and can disappear.

**Decision.**
- One Vercel function, `/api/chat`, speaks the OpenAI-compatible protocol. Groq, Gemini, OpenRouter and others work by changing three env vars (`LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`).
- Function validates input, caps sizes, rate limits per IP, and re-emits a minimal SSE format (`{"token": "..."}`).
- If the function is unavailable the client shows an extractive answer from the retrieved passages.

**Consequences.** Provider is swappable without a client change. The app is useful with no key at all.
