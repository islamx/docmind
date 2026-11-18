# State: signals and SignalStore

**Rule.** Signals hold state. RxJS handles streams ([ADR 1](../adr/0001-signals-and-rxjs.md)).

| Primitive | Used for | File |
|---|---|---|
| `signal` / `asReadonly` | Local state, exposed read-only | [notification.service.ts](../../src/app/core/notifications/notification.service.ts) |
| `computed` | Derived values, memoized | [ingest-progress.component.ts](../../src/app/features/ingest/ingest-progress.component.ts) |
| `effect` | Side effects that follow state (`<html dir>`, theme) | [i18n.service.ts](../../src/app/core/i18n/i18n.service.ts), [theme.service.ts](../../src/app/core/theme/theme.service.ts) |
| `linkedSignal` | Writable state that resets when a source changes (selected citation) | [chat.page.ts](../../src/app/features/chat/chat.page.ts) |
| `resource` | Async load as a signal (`value`, `isLoading`, `error`) | [chat.page.ts](../../src/app/features/chat/chat.page.ts) |
| `input` / `output` / `model` | Component API; `model` gives two-way binding | [composer.component.ts](../../src/app/features/chat/composer.component.ts) |

## SignalStore

[ADR 2](../adr/0002-ngrx-signalstore.md). Three stores, each with one job:

- [`LibraryStore`](../../src/app/core/state/library.store.ts): indexed sources. Uses `withHooks` to load on init.
- [`IngestStore`](../../src/app/features/ingest/ingest.store.ts): pipeline progress. `rxMethod` + `switchMap` cancels a running import when a new one starts.
- [`ChatStore`](../../src/app/features/chat/chat.store.ts): messages, streaming, stop, fallback.

**Custom feature.** [`withRequestStatus`](../../src/app/core/state/with-request-status.ts) adds `status`, `errorCode` and flags to any store, like a reusable hook.

## Pitfall found by tests

Reactive-form state is not signal-based. A `computed` over `control.invalid` goes stale. Use a method in the template. See `showInvalid()` in [home.page.ts](../../src/app/features/ingest/home.page.ts).
