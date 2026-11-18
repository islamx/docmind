# Angular concepts map

Where each concept lives in the code, and the React habit it replaces. Each topic page is short and links to real files.

| Concept | Where | React equivalent |
|---|---|---|
| Signals, `computed`, `linkedSignal`, `resource` | [state.md](state.md) | `useState`, `useMemo`, derived state, React Query |
| NgRx SignalStore + custom store feature | [state.md](state.md) | Zustand / Redux Toolkit |
| Dependency injection, tokens, abstract ports | [di.md](di.md) | Context, props, module mocks |
| RxJS for streams, cancellation, concurrency | [rxjs.md](rxjs.md) | `useEffect` + AbortController, async iterators |
| HTTP interceptors, error handling | [rxjs.md](rxjs.md) | fetch wrappers, error boundaries |
| OnPush, zoneless, `@defer`, virtual scroll, Web Worker | [performance.md](performance.md) | `memo`, `lazy`/`Suspense`, `react-window` |
| Lazy routes, resolvers, input binding, view transitions | [routing.md](routing.md) | React Router loaders |
| Reactive forms, i18n/RTL, accessibility | [ui.md](ui.md) | React Hook Form, i18next |
| Testing strategy | [testing.md](testing.md) | Testing Library, MSW |
| Hybrid RAG pipeline | [rag.md](rag.md) | n/a |
