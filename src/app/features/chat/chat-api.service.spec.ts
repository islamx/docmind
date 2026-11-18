import { HttpEventType } from '@angular/common/http';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ChatApi, ChatApiError, failureFromStatus, toChatFailure } from './chat-api.service';

describe('ChatApi', () => {
  let api: ChatApi;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(ChatApi);
    controller = TestBed.inject(HttpTestingController);
  });

  const messages = [{ role: 'user', content: 'hi' }] as const;

  it('emits tokens as the response streams in, including frames split across chunks', () => {
    const tokens: string[] = [];
    let completed = false;
    api.stream(messages).subscribe({ next: (t) => tokens.push(t), complete: () => (completed = true) });

    const req = controller.expectOne('/api/chat');
    expect(req.request.body).toEqual({ messages });

    const progress = (partialText: string) =>
      req.event({ type: HttpEventType.DownloadProgress, loaded: partialText.length, partialText });
    progress('data: {"token":"Hel"}\n\ndata: {"tok');
    progress('data: {"token":"Hel"}\n\ndata: {"token":"lo"}\n\n');
    req.flush('data: {"token":"Hel"}\n\ndata: {"token":"lo"}\n\ndata: [DONE]\n\n');

    expect(tokens).toEqual(['Hel', 'lo']);
    expect(completed).toBe(true);
  });

  it('turns an in-stream error event into a ChatApiError', () => {
    let error: unknown;
    api.stream(messages).subscribe({ error: (e) => (error = e) });
    controller.expectOne('/api/chat').flush('data: {"error":"rate_limited"}\n\n');
    expect(error).toBeInstanceOf(ChatApiError);
    expect((error as ChatApiError).reason).toBe('rate_limited');
  });

  it('surfaces HTTP failures that map to a fallback reason', () => {
    let error: unknown;
    api.stream(messages).subscribe({ error: (e) => (error = e) });
    controller.expectOne('/api/chat').flush('', { status: 503, statusText: 'Unavailable' });
    expect(toChatFailure(error)).toBe('unavailable');
  });

  it('cancels the HTTP request on unsubscribe', () => {
    const sub = api.stream(messages).subscribe();
    const req = controller.expectOne('/api/chat');
    sub.unsubscribe();
    expect(req.cancelled).toBe(true);
  });

  it('classifies statuses', () => {
    expect(failureFromStatus(0)).toBe('network');
    expect(failureFromStatus(429)).toBe('rate_limited');
    expect(failureFromStatus(503)).toBe('unavailable');
    expect(failureFromStatus(500)).toBe('upstream');
  });
});
