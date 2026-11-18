import { TestBed } from '@angular/core/testing';
import { I18nService, interpolate } from './i18n.service';
import { AR, EN } from './translations';

describe('I18nService', () => {
  beforeEach(() => localStorage.clear());

  it('translates and interpolates', () => {
    const i18n = TestBed.inject(I18nService);
    i18n.setLang('en');
    expect(i18n.t('chat.send')).toBe('Send');
    expect(i18n.t('chat.empty.title', { name: 'ngrx' })).toBe('Ask about ngrx');
  });

  it('switching to Arabic flips direction and updates <html>', () => {
    const i18n = TestBed.inject(I18nService);
    i18n.setLang('ar');
    TestBed.tick();
    expect(i18n.dir()).toBe('rtl');
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');
    expect(i18n.t('chat.send')).toBe('إرسال');
  });

  it('toggle persists the choice', () => {
    const i18n = TestBed.inject(I18nService);
    i18n.setLang('en');
    i18n.toggle();
    expect(localStorage.getItem('docmind.lang')).toBe('ar');
  });

  it('leaves unknown placeholders intact', () => {
    expect(interpolate('Hi {who} {x}', { who: 'A' })).toBe('Hi A {x}');
  });

  it('has the same keys in every language', () => {
    expect(Object.keys(AR).sort()).toEqual(Object.keys(EN).sort());
  });
});
