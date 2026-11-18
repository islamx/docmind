import { HttpClient, HttpErrorResponse, HttpEventType } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, filter, map, mergeMap, from } from 'rxjs';
import { APP_SETTINGS } from '../../core/config/app-settings';
import { ChatMessage } from '../../rag/chat-contract';
import { parseSse } from '../../rag/sse';

export type ChatFailure = 'unavailable' | 'rate_limited' | 'network' | 'upstream';

export class ChatApiError extends Error {
  constructor(readonly reason: ChatFailure) {
    super(reason);
    this.name = 'ChatApiError';
  }
}

export function failureFromStatus(status: number): ChatFailure {
  if (status === 0) return 'network';
  if (status === 429) return 'rate_limited';
  if (status === 501 || status === 503 || status === 404) return 'unavailable';
  return 'upstream';
}

/**
 * Streams tokens from `/api/chat`. Uses HttpClient's fetch backend with `reportProgress`,
 * which exposes the growing response body as `partialText`. That keeps interceptors, testing
 * (`HttpTestingController`) and cancellation (unsubscribe aborts the request) for free.
 */
@Injectable({ providedIn: 'root' })
export class ChatApi {
  private readonly http = inject(HttpClient);
  private readonly settings = inject(APP_SETTINGS);

  stream(messages: readonly ChatMessage[]): Observable<string> {
    let consumed = 0;
    let buffer = '';

    return this.http
      .post(this.settings.chatEndpoint, { messages }, { observe: 'events', responseType: 'text', reportProgress: true })
      .pipe(
        filter((event) => event.type === HttpEventType.DownloadProgress || event.type === HttpEventType.Response),
        map((event) => {
          const text = event.type === HttpEventType.Response ? (event.body ?? '') : (event.partialText ?? '');
          const fresh = text.slice(consumed);
          consumed = text.length;
          const parsed = parseSse(buffer, fresh);
          buffer = parsed.rest;
          return parsed.events;
        }),
        mergeMap((events) => from(events)),
        map((event) => {
          if ('error' in event) throw new ChatApiError(event.error === 'rate_limited' ? 'rate_limited' : 'upstream');
          return event.token;
        }),
      );
  }
}

export function toChatFailure(error: unknown): ChatFailure {
  if (error instanceof ChatApiError) return error.reason;
  if (error instanceof HttpErrorResponse) return failureFromStatus(error.status);
  return 'upstream';
}
