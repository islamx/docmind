# ADR 1: Signals for state, RxJS for streams

**Status:** accepted

**Context.** Angular now has two reactive primitives. Using one for everything makes either state or async flows awkward.

**Decision.**
- Signals: component and store state, derived values (`computed`), local effects.
- RxJS: anything that is a *stream over time*: HTTP with retry, download concurrency (`mergeMap`), SSE token streaming, cancellation (`switchMap`, `takeUntil`).
- Bridge at the edge: the store subscribes to a stream and writes into signals.

**Consequences.** Templates read only signals. Cancellation and backpressure stay in RxJS where operators already solve them.
