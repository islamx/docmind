import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslationKey } from '../../core/i18n/translations';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LibraryStore } from '../../core/state/library.store';
import { parseRepoInput } from '../../rag/github';
import { IngestProgressComponent } from './ingest-progress.component';
import { IngestStore } from './ingest.store';
import { repoValidator } from './repo.validator';
import { SourceListComponent } from './source-list.component';

export const EXAMPLES = [
  {
    label: 'Angular: Signals guide',
    value: 'https://github.com/angular/angular/tree/main/adev/src/content/guide/signals',
  },
  {
    label: 'NgRx: SignalStore docs',
    value: 'https://github.com/ngrx/platform/tree/main/projects/www/src/app/pages/guide/signals',
  },
  { label: 'DocMind: its own docs', value: 'https://github.com/islamx/docmind/tree/main/docs' },
] as const;

@Component({
  selector: 'app-home-page',
  imports: [ReactiveFormsModule, TranslatePipe, IngestProgressComponent, SourceListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
})
export class HomePage {
  protected readonly ingest = inject(IngestStore);
  protected readonly library = inject(LibraryStore);
  protected readonly examples = EXAMPLES;

  protected readonly form = inject(NonNullableFormBuilder).group({
    repo: ['', [Validators.required, repoValidator]],
  });

  protected readonly errorKey = computed(() => {
    const code = this.ingest.errorCode();
    return code ? (`error.${code}` as TranslationKey) : null;
  });
  protected readonly showProgress = computed(() => this.ingest.phase() !== 'idle');
  /** A method, not a `computed`: reactive-form state is not signal-based, so a computed would go stale. */
  protected showInvalid(): boolean {
    const c = this.form.controls.repo;
    return c.invalid && (c.touched || c.dirty);
  }

  protected submit(): void {
    this.form.markAllAsTouched();
    const ref = parseRepoInput(this.form.controls.repo.value);
    if (this.form.invalid || !ref) return;
    this.ingest.start(ref);
  }

  protected useExample(value: string): void {
    this.form.controls.repo.setValue(value);
    this.submit();
  }
}
