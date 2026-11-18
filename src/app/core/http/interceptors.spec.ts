import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AppError } from '../errors/app-error';
import { githubErrorInterceptor, retryInterceptor } from './interceptors';

describe('http interceptors', () => {
  let http: HttpClient;
  let controller: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([githubErrorInterceptor, retryInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    controller.verify();
    vi.useRealTimers();
  });

  it('retries a GET after a 500 and then succeeds', async () => {
    let result: unknown;
    http.get('/x').subscribe((r) => (result = r));

    controller.expectOne('/x').flush('boom', { status: 500, statusText: 'Server Error' });
    await vi.advanceTimersByTimeAsync(300);
    controller.expectOne('/x').flush({ ok: true });

    expect(result).toEqual({ ok: true });
  });

  it('does not retry a 4xx', () => {
    let error: unknown;
    http.get('/x').subscribe({ error: (e) => (error = e) });
    controller.expectOne('/x').flush('nope', { status: 400, statusText: 'Bad Request' });
    expect(error).toBeTruthy();
    controller.expectNone('/x');
  });

  it('never retries a POST', () => {
    http.post('/x', {}).subscribe({ error: () => undefined });
    controller.expectOne('/x').flush('boom', { status: 500, statusText: 'Server Error' });
    controller.expectNone('/x');
  });

  it('maps an exhausted GitHub rate limit to AppError', () => {
    let error: unknown;
    http.get('https://api.github.com/repos/a/b').subscribe({ error: (e) => (error = e) });
    controller
      .expectOne('https://api.github.com/repos/a/b')
      .flush('limit', { status: 403, statusText: 'Forbidden', headers: { 'x-ratelimit-remaining': '0' } });
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe('github_rate_limit');
  });

  it('maps a GitHub 404 to repo_not_found and leaves other hosts alone', () => {
    const errors: unknown[] = [];
    http.get('https://api.github.com/repos/a/b').subscribe({ error: (e) => errors.push(e) });
    http.get('https://other.dev/x').subscribe({ error: (e) => errors.push(e) });
    controller.expectOne('https://api.github.com/repos/a/b').flush('', { status: 404, statusText: 'Not Found' });
    controller.expectOne('https://other.dev/x').flush('', { status: 404, statusText: 'Not Found' });
    expect((errors[0] as AppError).code).toBe('repo_not_found');
    expect(errors[1]).not.toBeInstanceOf(AppError);
  });
});
