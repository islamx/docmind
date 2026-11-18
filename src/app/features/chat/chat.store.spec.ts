import { TestBed } from '@angular/core/testing';
import { Observable, Subject, throwError } from 'rxjs';
import { SearchIndexService } from '../../core/search/search-index.service';
import { SearchResult } from '../../rag/models';
import { makeChunk } from '../../../testing/fakes';
import { ChatApi, ChatApiError } from './chat-api.service';
import { ChatStore } from './chat.store';

const result = (ids: string[]): SearchResult => ({
  hits: ids.map((id) => ({ chunk: makeChunk(id, `text of ${id}`, `Heading ${id}`), score: 1 })),
  topSimilarity: 0.6,
  confidence: 'high',
  usedVectors: true,
});

describe('ChatStore', () => {
  let searchResult: SearchResult;
  let tokens$: Subject<string>;
  let apiStream: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    searchResult = result(['a', 'b']);
    tokens$ = new Subject<string>();
    apiStream = vi.fn(() => tokens$);
    TestBed.configureTestingModule({
      providers: [
        { provide: SearchIndexService, useValue: { search: vi.fn(async () => searchResult) } },
        { provide: ChatApi, useValue: { stream: apiStream } },
      ],
    });
  });

  const setup = () => {
    const store = TestBed.inject(ChatStore);
    store.open('o/r');
    return store;
  };
  const flush = () => new Promise((r) => setTimeout(r, 0));
  const lastAnswer = (s: ReturnType<typeof setup>) => s.messages().at(-1)!;

  it('retrieves, streams tokens into the answer and finishes with follow-ups', async () => {
    const store = setup();
    store.ask('what is a?');
    await flush();

    expect(store.phase()).toBe('generating');
    expect(lastAnswer(store).citations.map((c) => c.n)).toEqual([1, 2]);

    tokens$.next('Hello ');
    tokens$.next('world [1]');
    expect(lastAnswer(store).text).toBe('Hello world [1]');
    expect(lastAnswer(store).status).toBe('streaming');

    tokens$.complete();
    expect(lastAnswer(store).status).toBe('done');
    expect(lastAnswer(store).followUps.length).toBeGreaterThan(0);
    expect(store.phase()).toBe('idle');
  });

  it('sends only completed turns as history', async () => {
    const store = setup();
    store.ask('first');
    await flush();
    tokens$.next('answer one');
    tokens$.complete();

    tokens$ = new Subject<string>();
    store.ask('second');
    await flush();

    const sent = apiStream.mock.calls.at(-1)![0] as { role: string; content: string }[];
    expect(sent.map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'user']);
    expect(sent[2].content).toBe('answer one');
  });

  it('falls back to an extractive answer when the LLM is unavailable', async () => {
    apiStream.mockReturnValue(throwError(() => new ChatApiError('unavailable')));
    const store = setup();
    store.ask('q');
    await flush();

    const answer = lastAnswer(store);
    expect(answer.mode).toBe('extractive');
    expect(answer.fallbackReason).toBe('unavailable');
    expect(answer.text).toContain('Heading a');
    expect(answer.status).toBe('done');
  });

  it('keeps partial text and flags an error if the stream dies mid-answer', async () => {
    apiStream.mockReturnValue(
      new Observable<string>((sub) => {
        sub.next('partial');
        sub.error(new ChatApiError('upstream'));
      }),
    );
    const store = setup();
    store.ask('q');
    await flush();
    expect(lastAnswer(store).text).toBe('partial');
    expect(lastAnswer(store).status).toBe('error');
  });

  it('answers "nothing found" without calling the LLM when retrieval is empty', async () => {
    searchResult = { hits: [], topSimilarity: null, confidence: 'none', usedVectors: false };
    const store = setup();
    store.ask('zzz');
    await flush();
    expect(apiStream).not.toHaveBeenCalled();
    expect(lastAnswer(store).confidence).toBe('none');
    expect(lastAnswer(store).status).toBe('done');
  });

  it('stop() ends generation and marks the answer stopped', async () => {
    const store = setup();
    store.ask('q');
    await flush();
    tokens$.next('partial');
    store.stop();
    expect(lastAnswer(store).status).toBe('stopped');
    expect(lastAnswer(store).text).toBe('partial');
    expect(store.phase()).toBe('idle');
  });

  it('a new question supersedes the one in flight', async () => {
    const store = setup();
    store.ask('first');
    await flush();
    tokens$.next('x');
    tokens$ = new Subject<string>();
    store.ask('second');
    await flush();
    const answers = store.messages().filter((m) => m.role === 'assistant');
    expect(answers[0].status).toBe('stopped');
    expect(answers[1].status).toBe('streaming');
  });

  it('switching source starts a fresh conversation', async () => {
    const store = setup();
    store.ask('q');
    await flush();
    store.open('other/repo');
    expect(store.messages()).toEqual([]);
    expect(store.sourceId()).toBe('other/repo');
  });

  it('ignores questions when no source is open', () => {
    const store = TestBed.inject(ChatStore);
    store.ask('q');
    expect(store.messages()).toEqual([]);
  });

  it('exposes latest citations', async () => {
    const store = setup();
    store.ask('q');
    await flush();
    expect(store.latestCitations().length).toBe(2);
  });
});
