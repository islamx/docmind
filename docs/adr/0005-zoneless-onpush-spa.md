# ADR 5: Zoneless, OnPush, client-rendered SPA

**Status:** accepted

**Decision.** No Zone.js. All components `OnPush`. No SSR.

**Why.** State is signals, so change detection is driven by signal reads. SSR adds little: the app is an authenticated-free tool whose value is client-side compute (workers, IndexedDB) that SSR cannot run.

**Consequence.** Any non-signal async state must be written to a signal. Enforced by convention and tests.
