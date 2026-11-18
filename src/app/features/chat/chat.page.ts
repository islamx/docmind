import { LiveAnnouncer } from '@angular/cdk/a11y';
import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  ElementRef,
  Component,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  resource,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Embedder } from '../../core/embedding/embedder';
import { TranslationKey } from '../../core/i18n/translations';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { SearchIndexService } from '../../core/search/search-index.service';
import { SourceMeta } from '../../data/chunk-repository';
import { blobUrl } from '../../rag/github';
import { Chunk, Citation } from '../../rag/models';
import { ChatStore } from './chat.store';
import { ComposerComponent } from './composer.component';
import { FileListComponent } from './file-list.component';
import { SourceViewerComponent } from './source-viewer.component';
import { MessageComponent } from './message.component';

const EXAMPLE_KEYS: readonly TranslationKey[] = ['chat.example.1', 'chat.example.2', 'chat.example.3'];

@Component({
  selector: 'app-chat-page',
  imports: [RouterLink, TranslatePipe, ComposerComponent, MessageComponent, FileListComponent, SourceViewerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './chat.page.html',
  styleUrl: './chat.page.scss',
})
export class ChatPage {
  /** Bound from the route resolver through `withComponentInputBinding()`. */
  readonly source = input.required<SourceMeta>();

  protected readonly chat = inject(ChatStore);
  protected readonly embedder = inject(Embedder);
  private readonly searchIndex = inject(SearchIndexService);
  private readonly announcer = inject(LiveAnnouncer);
  private readonly i18n = inject(I18nService);

  protected readonly draft = signal('');
  protected readonly examples = EXAMPLE_KEYS;
  protected readonly showPanel = signal(false);
  private readonly log = viewChild<ElementRef<HTMLElement>>('log');
  /** Short display name: the folder when a sub-path was indexed, else the repo. */
  protected readonly displayName = computed(() => this.source().path.split('/').pop() || this.source().repo);

  /** Async data as a signal: reloads whenever the source changes, exposes value/isLoading/error. */
  protected readonly chunks = resource({
    params: () => this.source().id,
    loader: ({ params }) => this.searchIndex.chunks(params),
  });

  protected readonly files = computed(() => [...new Set((this.chunks.value() ?? []).map((c) => c.path))].sort());

  /** Selected passage. Resets to null whenever a new answer arrives. */
  protected readonly selected = linkedSignal<readonly Citation[], Chunk | null>({
    source: this.chat.latestCitations,
    computation: () => null,
  });

  protected readonly githubUrl = computed(() => {
    const chunk = this.selected();
    const { owner, repo, path } = this.source();
    return chunk ? blobUrl({ owner, repo, path }, chunk.path, chunk.startLine, chunk.endLine) : '';
  });

  protected readonly semanticStatus = computed(() => {
    const meta = this.source();
    if (meta.status === 'partial') return 'keyword' as const;
    return this.embedder.status() === 'loading' ? ('loading' as const) : ('ready' as const);
  });

  constructor() {
    // Keep the newest message in view while it streams, unless the user scrolled up to read.
    afterRenderEffect(() => {
      this.chat.messages();
      const el = this.log()?.nativeElement;
      if (!el) return;
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
      if (nearBottom || this.chat.phase() === 'retrieving') el.scrollTo({ top: el.scrollHeight });
    });

    effect(() => this.chat.open(this.source().id));

    // Screen readers hear progress without focus moving away from the input.
    effect(() => {
      const phase = this.chat.phase();
      if (phase === 'retrieving') untracked(() => this.announcer.announce(this.i18n.t('chat.retrieving')));
    });
  }

  protected ask(question: string): void {
    this.chat.ask(question);
  }

  protected exampleText(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected openCitation(n: number): void {
    const citation = this.chat.latestCitations().find((c) => c.n === n);
    if (citation) this.selected.set(citation.chunk);
  }

  protected openFile(path: string): void {
    const first = (this.chunks.value() ?? []).find((c) => c.path === path);
    if (first) this.selected.set(first);
  }
}
