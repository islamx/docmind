import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslationKey } from '../../core/i18n/translations';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { chatLink } from '../chat/chat-link';
import { IngestPhase, IngestStore } from './ingest.store';

const STEPS: readonly { phase: Exclude<IngestPhase, 'idle' | 'searchable' | 'done'>; label: TranslationKey }[] = [
  { phase: 'listing', label: 'ingest.listing' },
  { phase: 'downloading', label: 'ingest.downloading' },
  { phase: 'chunking', label: 'ingest.chunking' },
  { phase: 'embedding', label: 'ingest.embedding' },
];

type StepState = 'done' | 'active' | 'todo';

@Component({
  selector: 'app-ingest-progress',
  imports: [RouterLink, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ingest-progress.component.html',
  styleUrl: './ingest-progress.component.scss',
})
export class IngestProgressComponent {
  protected readonly store = inject(IngestStore);

  protected readonly steps = computed(() => {
    const phase = this.store.phase();
    const activeIndex = phase === 'done' ? STEPS.length : STEPS.findIndex((s) => s.phase === phase);
    return STEPS.map((step, i) => ({
      ...step,
      state: (i < activeIndex ? 'done' : i === activeIndex ? 'active' : 'todo') as StepState,
    }));
  });

  protected readonly percent = computed(() => {
    const fraction = this.store.fraction();
    return fraction === null ? null : Math.round(fraction * 100);
  });

  protected readonly link = computed(() => {
    const meta = this.store.meta();
    return meta ? chatLink(meta) : null;
  });
}
