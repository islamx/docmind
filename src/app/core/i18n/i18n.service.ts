import { DOCUMENT } from '@angular/common';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { readStorage, writeStorage } from '../storage';
import { DICTIONARIES, Lang, TranslationKey } from './translations';

const STORAGE_KEY = 'docmind.lang';

export function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => String(params[name] ?? whole));
}

/**
 * Runtime i18n built on signals. `lang` is the single source of truth:
 * `dir`, the dictionary and the <html> attributes are all derived from it.
 */
@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly document = inject(DOCUMENT);

  readonly lang = signal<Lang>(this.initialLang());
  readonly dir = computed(() => (this.lang() === 'ar' ? 'rtl' : 'ltr'));
  private readonly dictionary = computed(() => DICTIONARIES[this.lang()]);

  constructor() {
    effect(() => {
      const root = this.document.documentElement;
      root.lang = this.lang();
      root.dir = this.dir();
    });
  }

  t(key: TranslationKey, params?: Record<string, string | number>): string {
    return interpolate(this.dictionary()[key], params);
  }

  setLang(lang: Lang): void {
    this.lang.set(lang);
    writeStorage(STORAGE_KEY, lang);
  }

  toggle(): void {
    this.setLang(this.lang() === 'en' ? 'ar' : 'en');
  }

  private initialLang(): Lang {
    const saved = readStorage(STORAGE_KEY);
    if (saved === 'en' || saved === 'ar') return saved;
    return globalThis.navigator?.language?.toLowerCase().startsWith('ar') ? 'ar' : 'en';
  }
}
