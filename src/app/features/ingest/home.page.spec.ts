import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FormControl } from '@angular/forms';
import { I18nService } from '../../core/i18n/i18n.service';
import { SearchIndexService } from '../../core/search/search-index.service';
import { ChunkRepository } from '../../data/chunk-repository';
import { MemoryChunkRepository } from '../../data/memory-chunk-repository';
import { HomePage } from './home.page';
import { IngestStore } from './ingest.store';
import { IngestionService } from './ingestion.service';
import { repoValidator } from './repo.validator';
import { NEVER } from 'rxjs';

describe('repoValidator', () => {
  it('accepts owner/repo and github URLs, rejects the rest', () => {
    expect(repoValidator(new FormControl('angular/angular'))).toBeNull();
    expect(repoValidator(new FormControl('https://github.com/a/b'))).toBeNull();
    expect(repoValidator(new FormControl('nope'))).toEqual({ repo: true });
    expect(repoValidator(new FormControl(''))).toBeNull(); // `required` reports empty
  });
});

describe('HomePage', () => {
  const ingest = vi.fn(() => NEVER);

  beforeEach(() => {
    ingest.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: IngestionService, useValue: { ingest } },
        { provide: ChunkRepository, useClass: MemoryChunkRepository },
        { provide: SearchIndexService, useValue: { invalidate: vi.fn() } },
      ],
    });
    TestBed.inject(I18nService).setLang('en');
  });

  const render = () => {
    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const input = el.querySelector<HTMLInputElement>('#repo')!;
    const type = (v: string) => {
      input.value = v;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    const submit = () => {
      el.querySelector('form')!.dispatchEvent(new Event('submit'));
      fixture.detectChanges();
    };
    return { fixture, el, type, submit };
  };

  it('shows a validation error and does not start ingestion for bad input', () => {
    const { el, type, submit } = render();
    type('not a repo');
    submit();
    expect(el.querySelector('[role=alert]')?.textContent).toContain('Enter owner/repo');
    expect(ingest).not.toHaveBeenCalled();
  });

  it('starts ingestion with the parsed repo and shows progress', () => {
    const { el, type, submit } = render();
    type('https://github.com/angular/angular/tree/main/adev/guide');
    submit();
    expect(ingest).toHaveBeenCalledWith({ owner: 'angular', repo: 'angular', path: 'adev/guide' });
    expect(el.querySelector('app-ingest-progress')).not.toBeNull();
    expect(TestBed.inject(IngestStore).isPending()).toBe(true);
  });

  it('an example chip fills the field and starts indexing', () => {
    const { el } = render();
    const chip = el.querySelector<HTMLButtonElement>('.examples .chip')!;
    chip.click();
    expect(ingest).toHaveBeenCalledTimes(1);
  });

  it('shows the empty-library hint', () => {
    expect(render().el.textContent).toContain('Nothing indexed yet.');
  });
});

