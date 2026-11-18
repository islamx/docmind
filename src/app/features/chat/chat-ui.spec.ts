import { TestBed } from '@angular/core/testing';
import { Router, RedirectCommand, ActivatedRouteSnapshot, provideRouter } from '@angular/router';
import { ChunkRepository, SourceMeta } from '../../data/chunk-repository';
import { MemoryChunkRepository } from '../../data/memory-chunk-repository';
import { chatLink } from './chat-link';
import { ComposerComponent } from './composer.component';
import { ChatMessageVm } from './chat.store';
import { MessageComponent } from './message.component';
import { sourceResolver } from './source.resolver';
import { I18nService } from '../../core/i18n/i18n.service';

const text = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ').trim();

describe('ComposerComponent', () => {
  const setup = () => {
    const fixture = TestBed.createComponent(ComposerComponent);
    TestBed.inject(I18nService).setLang('en');
    fixture.detectChanges();
    const sent: string[] = [];
    let stopped = 0;
    fixture.componentInstance.send.subscribe((v) => sent.push(v));
    fixture.componentInstance.stop.subscribe(() => stopped++);
    const el = fixture.nativeElement as HTMLElement;
    const textarea = el.querySelector('textarea')!;
    const type = (value: string) => {
      textarea.value = value;
      textarea.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    return { fixture, el, textarea, type, sent, stopped: () => stopped };
  };

  it('disables Send until there is text', () => {
    const { el, type, fixture } = setup();
    expect(el.querySelector<HTMLButtonElement>('button[type=submit]')!.disabled).toBe(true);
    type('hello');
    fixture.detectChanges();
    expect(el.querySelector<HTMLButtonElement>('button[type=submit]')!.disabled).toBe(false);
  });

  it('Enter sends and clears; Shift+Enter does not send', () => {
    const { textarea, type, sent, fixture } = setup();
    type('  question  ');
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, cancelable: true }));
    expect(sent).toEqual([]);
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }));
    expect(sent).toEqual(['question']);
    expect(fixture.componentInstance.value()).toBe('');
  });

  it('shows Stop while busy, Esc stops, and sending is blocked', () => {
    const { fixture, el, textarea, type, sent, stopped } = setup();
    fixture.componentRef.setInput('busy', true);
    type('x');
    expect(text(el.querySelector('button')!)).toBe('Stop');
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
    expect(stopped()).toBe(1);
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }));
    expect(sent).toEqual([]);
  });
});

describe('MessageComponent', () => {
  const base: ChatMessageVm = {
    id: 2,
    role: 'assistant',
    text: '',
    status: 'streaming',
    citations: [],
    confidence: null,
    mode: 'llm',
    fallbackReason: null,
    followUps: [],
  };
  const render = (m: Partial<ChatMessageVm>) => {
    TestBed.inject(I18nService).setLang('en');
    const fixture = TestBed.createComponent(MessageComponent);
    fixture.componentRef.setInput('message', { ...base, ...m });
    fixture.detectChanges();
    return fixture;
  };

  it('shows a searching state before the first token', () => {
    expect(text(render({}).nativeElement)).toContain('Searching sources');
  });

  it('renders markdown and a streaming caret while generating', () => {
    const fixture = render({ text: '**hi**', citations: [] });
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('strong')?.textContent).toBe('hi');
    expect(el.querySelector('.answer.streaming')).not.toBeNull();
  });

  it('shows the extractive notice, copy and follow-up chips when done', () => {
    const fixture = render({ text: 'passage', status: 'done', mode: 'extractive', followUps: ['Tell me more'] });
    const el = fixture.nativeElement as HTMLElement;
    expect(text(el)).toContain('No language model connected');
    expect(text(el)).toContain('Copy');
    let picked = '';
    fixture.componentInstance.followUp.subscribe((q) => (picked = q));
    el.querySelector<HTMLButtonElement>('.chip')!.click();
    expect(picked).toBe('Tell me more');
  });

  it('warns on low confidence but not on high', () => {
    expect(text(render({ text: 'a', status: 'done', confidence: 'low' }).nativeElement)).toContain('Low confidence');
    expect(text(render({ text: 'a', status: 'done', confidence: 'high' }).nativeElement)).not.toContain('confidence');
  });

  it('renders user messages as plain text', () => {
    const fixture = render({ role: 'user', text: '<b>raw</b>', status: 'done' });
    expect((fixture.nativeElement as HTMLElement).querySelector('b')).toBeNull();
    expect(text(fixture.nativeElement)).toContain('<b>raw</b>');
  });
});

describe('chatLink', () => {
  it('builds route commands and only adds path when present', () => {
    expect(chatLink({ owner: 'a', repo: 'b', path: '' })).toEqual({ commands: ['/chat', 'a', 'b'], queryParams: {} });
    expect(chatLink({ owner: 'a', repo: 'b', path: 'docs/x' }).queryParams).toEqual({ path: 'docs/x' });
  });
});

describe('sourceResolver', () => {
  const meta: SourceMeta = {
    id: 'a/b:docs',
    owner: 'a',
    repo: 'b',
    path: 'docs',
    fileCount: 1,
    chunkCount: 1,
    embeddedCount: 1,
    status: 'ready',
    indexedAt: 1,
  };
  const route = (path?: string) =>
    ({
      paramMap: new Map([
        ['owner', 'a'],
        ['repo', 'b'],
      ]) as unknown as ActivatedRouteSnapshot['paramMap'],
      queryParamMap: { get: () => path ?? null } as unknown as ActivatedRouteSnapshot['queryParamMap'],
    }) as ActivatedRouteSnapshot;

  beforeEach(async () => {
    const repo = new MemoryChunkRepository();
    await repo.saveSource(meta, []);
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: ChunkRepository, useValue: repo }],
    });
  });

  it('returns the stored source', async () => {
    const result = await TestBed.runInInjectionContext(() => sourceResolver(route('docs'), {} as never));
    expect(result).toMatchObject({ id: 'a/b:docs' });
  });

  it('redirects home when the source is unknown', async () => {
    const result = await TestBed.runInInjectionContext(() => sourceResolver(route('missing'), {} as never));
    expect(result).toBeInstanceOf(RedirectCommand);
    expect((result as RedirectCommand).redirectTo.toString()).toBe(TestBed.inject(Router).parseUrl('/').toString());
  });
});
