# Routing

All in [app.routes.ts](../../src/app/app.routes.ts) and [app.config.ts](../../src/app/app.config.ts).

| Feature | Detail |
|---|---|
| Lazy `loadComponent` | One chunk per page |
| Resolver | [`sourceResolver`](../../src/app/features/chat/source.resolver.ts) loads the source before the page renders |
| `RedirectCommand` | Unknown source redirects home instead of rendering a broken page |
| `withComponentInputBinding()` | Resolver data arrives as `source = input.required<SourceMeta>()`. No `ActivatedRoute` in the component |
| Dynamic `title` | Per-route document title from params |
| `withViewTransitions()` | Native page transitions |
| `withPreloading(PreloadAllModules)` | Chat chunk is fetched while the user is on home |
| URL design | `/chat/:owner/:repo?path=folder`. Source ids contain `/` and `:`, so [`chatLink`](../../src/app/features/chat/chat-link.ts) builds explicit parts |
