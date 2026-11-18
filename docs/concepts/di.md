# Dependency injection

DI is the main architectural tool. It replaces React context and module mocking.

## Abstract classes as ports

Features depend on an abstraction. The runtime picks the implementation.

| Port | Implementations | Chosen in |
|---|---|---|
| [`ChunkRepository`](../../src/app/data/chunk-repository.ts) | IndexedDB, in-memory | [provide-repository.ts](../../src/app/data/provide-repository.ts) (runtime check) |
| [`Embedder`](../../src/app/core/embedding/embedder.ts) | Web Worker, fake | [provide-embedder.ts](../../src/app/core/embedding/provide-embedder.ts) |

One [contract spec](../../src/app/data/chunk-repository.spec.ts) runs against both repositories, so they stay interchangeable.

## InjectionToken with a factory

[`APP_SETTINGS`](../../src/app/core/config/app-settings.ts) is root-provided with a default factory, so it works with zero setup. Tests and environments override it with `provideAppSettings()`.

## Functional providers

`provideChunkRepository()`, `provideEmbedder()` and `provideAppSettings()` are plain functions returning providers. [app.config.ts](../../src/app/app.config.ts) reads like a manifest.

## `inject()` everywhere

No constructor parameter lists. `inject()` also works in functions: [source.resolver.ts](../../src/app/features/chat/source.resolver.ts) and [interceptors.ts](../../src/app/core/http/interceptors.ts). Gotcha: call it before the first `await`.

## ErrorHandler override

[`GlobalErrorHandler`](../../src/app/core/errors/global-error-handler.ts) replaces the default handler and shows a translated toast.
