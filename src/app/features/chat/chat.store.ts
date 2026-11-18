import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import {
  EMPTY,
  Observable,
  Subject,
  catchError,
  concat,
  defer,
  finalize,
  from,
  pipe,
  switchMap,
  takeUntil,
  tap,
} from 'rxjs';
import { APP_SETTINGS } from '../../core/config/app-settings';
import { SearchIndexService } from '../../core/search/search-index.service';
import { toCitations } from '../../rag/citations';
import { buildExtractiveAnswer, suggestFollowUps } from '../../rag/extractive';
import { Citation, Confidence } from '../../rag/models';
import { buildMessages } from '../../rag/prompt';
import { ChatApi, ChatFailure, toChatFailure } from './chat-api.service';

export type MessageStatus = 'streaming' | 'done' | 'stopped' | 'error';
export type AnswerMode = 'llm' | 'extractive';

export interface ChatMessageVm {
  readonly id: number;
  readonly role: 'user' | 'assistant';
  readonly text: string;
  readonly status: MessageStatus;
  readonly citations: readonly Citation[];
  readonly confidence: Confidence | null;
  readonly mode: AnswerMode;
  readonly fallbackReason: ChatFailure | null;
  readonly followUps: readonly string[];
}

export type ChatPhase = 'idle' | 'retrieving' | 'generating';

interface ChatState {
  readonly sourceId: string | null;
  readonly messages: readonly ChatMessageVm[];
  readonly phase: ChatPhase;
  readonly nextId: number;
}

const message = (id: number, role: ChatMessageVm['role'], text: string, status: MessageStatus): ChatMessageVm => ({
  id,
  role,
  text,
  status,
  citations: [],
  confidence: null,
  mode: 'llm',
  fallbackReason: null,
  followUps: [],
});

export const ChatStore = signalStore(
  { providedIn: 'root' },
  withState<ChatState>({ sourceId: null, messages: [], phase: 'idle', nextId: 1 }),
  withComputed(({ messages, phase }) => ({
    isBusy: computed(() => phase() !== 'idle'),
    hasMessages: computed(() => messages().length > 0),
    /** Citations of the newest assistant answer: what the sources panel shows by default. */
    latestCitations: computed(() => [...messages()].reverse().find((m) => m.role === 'assistant')?.citations ?? []),
  })),
  withMethods((store, search = inject(SearchIndexService), api = inject(ChatApi), settings = inject(APP_SETTINGS)) => {
    const cancel$ = new Subject<void>();

    const patchMessage = (id: number, patch: Partial<ChatMessageVm>) =>
      patchState(store, (s) => ({ messages: s.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)) }));

    const appendToken = (id: number, token: string) =>
      patchState(store, (s) => ({
        messages: s.messages.map((m) => (m.id === id ? { ...m, text: m.text + token } : m)),
      }));

    const find = (id: number) => store.messages().find((m) => m.id === id);

    const run = (question: string): Observable<unknown> => {
      const sourceId = store.sourceId();
      if (!sourceId) return EMPTY;

      const history = store
        .messages()
        .filter((m) => m.status === 'done' && m.text)
        .map((m) => ({ role: m.role, content: m.text }));

      const userId = store.nextId();
      const answerId = userId + 1;
      patchState(store, (s) => ({
        phase: 'retrieving' as ChatPhase,
        nextId: s.nextId + 2,
        messages: [
          ...s.messages,
          message(userId, 'user', question, 'done'),
          message(answerId, 'assistant', '', 'streaming'),
        ],
      }));

      const fallback = (citations: readonly Citation[], reason: ChatFailure) =>
        patchMessage(answerId, {
          text: buildExtractiveAnswer(citations),
          mode: 'extractive',
          fallbackReason: reason,
          status: 'done',
          followUps: suggestFollowUps(citations),
        });

      return defer(() => from(search.search(sourceId, question, settings.retrieval.topK))).pipe(
        switchMap((result) => {
          const citations = toCitations(result.hits);
          patchMessage(answerId, { citations, confidence: result.confidence });
          if (citations.length === 0) {
            patchMessage(answerId, { status: 'done' });
            return EMPTY;
          }
          patchState(store, { phase: 'generating' });
          return concat(
            api.stream(buildMessages(question, citations, history)).pipe(tap((token) => appendToken(answerId, token))),
            defer(() => {
              patchMessage(answerId, { status: 'done', followUps: suggestFollowUps(citations) });
              return EMPTY;
            }),
          ).pipe(
            catchError((error: unknown) => {
              const reason = toChatFailure(error);
              if (find(answerId)?.text) patchMessage(answerId, { status: 'error', fallbackReason: reason });
              else fallback(citations, reason);
              return EMPTY;
            }),
          );
        }),
        catchError(() => {
          patchMessage(answerId, { status: 'error' });
          return EMPTY;
        }),
        takeUntil(cancel$),
        finalize(() => {
          // Covers user stop and being superseded by a newer question.
          if (find(answerId)?.status === 'streaming') patchMessage(answerId, { status: 'stopped' });
          patchState(store, { phase: 'idle' });
        }),
      );
    };

    return {
      /** Switch source. Conversation is per-source, so changing it starts fresh. */
      open(sourceId: string): void {
        if (store.sourceId() === sourceId) return;
        cancel$.next();
        patchState(store, { sourceId, messages: [], phase: 'idle', nextId: 1 });
      },
      ask: rxMethod<string>(pipe(switchMap(run))),
      stop(): void {
        cancel$.next();
      },
      clear(): void {
        cancel$.next();
        patchState(store, { messages: [], phase: 'idle' });
      },
    };
  }),
);
