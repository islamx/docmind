import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, ErrorHandler, provideBrowserGlobalErrorListeners } from '@angular/core';
import {
  PreloadAllModules,
  provideRouter,
  withComponentInputBinding,
  withPreloading,
  withViewTransitions,
} from '@angular/router';
import { provideEmbedder } from './core/embedding/provide-embedder';
import { GlobalErrorHandler } from './core/errors/global-error-handler';
import { githubErrorInterceptor, retryInterceptor } from './core/http/interceptors';
import { provideChunkRepository } from './data/provide-repository';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    // Route params, query params and resolver data arrive as component `input()`s.
    provideRouter(routes, withComponentInputBinding(), withViewTransitions(), withPreloading(PreloadAllModules)),
    // Order matters: the first interceptor wraps the rest, so GitHub errors are mapped after retries ran.
    provideHttpClient(withFetch(), withInterceptors([githubErrorInterceptor, retryInterceptor])),
    provideChunkRepository(),
    provideEmbedder(),
  ],
};
