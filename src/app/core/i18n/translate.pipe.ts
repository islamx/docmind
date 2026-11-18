import { Pipe, PipeTransform, inject } from '@angular/core';
import { I18nService } from './i18n.service';
import { TranslationKey } from './translations';

/**
 * `{{ 'chat.send' | t }}`. Marked impure on purpose: a pure pipe is cached per input,
 * so it would not re-run when the language signal changes. The signal read inside
 * `transform` is tracked by the template, so OnPush views still update correctly.
 */
@Pipe({ name: 't', pure: false })
export class TranslatePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(key: TranslationKey, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }
}
