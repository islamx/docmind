# Forms, i18n and accessibility

## Forms

Typed reactive form with a custom validator in [home.page.ts](../../src/app/features/ingest/home.page.ts). The validator reuses [`parseRepoInput`](../../src/app/rag/github.ts), the same parser ingestion uses, so validation and behaviour cannot disagree.

## i18n and RTL

[ADR 6](../adr/0006-i18n.md). English and Arabic at runtime, no reload.

- [`I18nService`](../../src/app/core/i18n/i18n.service.ts): `lang` signal; `dir` is `computed`; an `effect` writes `<html lang dir>`.
- [`TranslatePipe`](../../src/app/core/i18n/translate.pipe.ts): impure on purpose, explained in the file.
- Keys are typed: `'chat.sent' | t` fails to compile. A test asserts both dictionaries have identical keys.
- CSS uses logical properties (`inline-start`, `padding-inline`), so layout mirrors for free.

## Accessibility

| Practice | Where |
|---|---|
| Skip link, landmark `main` | [app.html](../../src/app/app.html) |
| `role="log"` + `aria-live` for streaming answers | [chat.page.html](../../src/app/features/chat/chat.page.html) |
| CDK `LiveAnnouncer` for status changes | [chat.page.ts](../../src/app/features/chat/chat.page.ts) |
| Labelled controls, `aria-invalid`, `role="alert"` errors | [home.page.html](../../src/app/features/ingest/home.page.html) |
| Keyboard: `/` focus, `Enter` send, `Esc` stop | [focus-shortcut.directive.ts](../../src/app/shared/focus-shortcut.directive.ts), [composer.component.ts](../../src/app/features/chat/composer.component.ts) |
| `prefers-reduced-motion`, visible focus ring | [_base.scss](../../src/styles/_base.scss) |

## Security

Model output is untrusted. Markdown is bound with `[innerHTML]`, so Angular's sanitizer strips scripts, handlers and `javascript:` URLs. Never `bypassSecurityTrust*`. A [test](../../src/app/shared/shared.spec.ts) proves it. The API key lives only in the serverless function.
