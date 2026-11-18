# Performance

Initial load is about 90 kB transferred. The embedding model never touches the main thread.

| Technique | Why | File |
|---|---|---|
| Zoneless + `OnPush` everywhere | Change detection driven by signals only ([ADR 5](../adr/0005-zoneless-onpush-spa.md)) | all components, [app.config.ts](../../src/app/app.config.ts) |
| Lazy routes + preloading | Home does not pay for chat | [app.routes.ts](../../src/app/app.routes.ts) |
| `@defer (when …)` | Source viewer code loads on first citation click | [chat.page.html](../../src/app/features/chat/chat.page.html) |
| CDK virtual scroll | Thousands of file paths, a few dozen DOM nodes | [file-list.component.ts](../../src/app/features/chat/file-list.component.ts) |
| Web Worker | Embeddings off the main thread, results transferred not copied | [embed.worker.ts](../../src/app/core/embedding/embed.worker.ts) |
| Pure pipe | Markdown re-renders only when text changes | [markdown.pipe.ts](../../src/app/shared/markdown.pipe.ts) |
| Early searchability | Keyword search works before embeddings finish | [ingestion.service.ts](../../src/app/features/ingest/ingestion.service.ts) |
| Batching + persistence | Embeds 16 at a time and saves each batch | same |

Budgets are enforced in [angular.json](../../angular.json): the build fails above 1 MB initial.

## Known limit

Vector search is brute force, fine to about 50k passages. An ANN index is the next step.
