# ADR 2: NgRx SignalStore for feature state

**Status:** accepted

**Context.** Three features share non-trivial state (library, ingestion progress, chat). Plain services get messy; classic NgRx is too much ceremony here.

**Decision.** Use `@ngrx/signals` stores with `withState`, `withComputed`, `withMethods`. Shared behaviour (request status) is a reusable `signalStoreFeature`.

**Alternatives.** Plain signal services (no conventions, hard to test uniformly); NgRx Store (boilerplate unjustified for this size).

**Consequences.** Stores are root-provided, easy to unit test with fake dependencies injected through DI.
