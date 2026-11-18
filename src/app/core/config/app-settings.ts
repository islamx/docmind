import { InjectionToken, Provider } from '@angular/core';
import { DEFAULT_FILE_FILTER, FileFilter } from '../../rag/github';

export interface AppSettings {
  readonly chatEndpoint: string;
  readonly github: { readonly apiBase: string; readonly rawBase: string; readonly downloadConcurrency: number };
  readonly embedding: { readonly batchSize: number };
  readonly retrieval: { readonly topK: number };
  readonly fileFilter: FileFilter;
}

export const DEFAULT_SETTINGS: AppSettings = {
  chatEndpoint: '/api/chat',
  github: { apiBase: 'https://api.github.com', rawBase: 'https://raw.githubusercontent.com', downloadConcurrency: 8 },
  embedding: { batchSize: 16 },
  retrieval: { topK: 5 },
  fileFilter: DEFAULT_FILE_FILTER,
};

/**
 * Configuration lives behind an InjectionToken so tests and environments can override it
 * without touching call sites. Root-provided with a factory: works with zero setup.
 */
export const APP_SETTINGS = new InjectionToken<AppSettings>('APP_SETTINGS', {
  providedIn: 'root',
  factory: () => DEFAULT_SETTINGS,
});

/** Functional provider with a shallow override per section. */
export function provideAppSettings(overrides: Partial<AppSettings>): Provider {
  return { provide: APP_SETTINGS, useValue: { ...DEFAULT_SETTINGS, ...overrides } };
}
