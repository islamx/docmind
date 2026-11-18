import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { Chunk } from '../../rag/models';

/**
 * Shows the exact passage behind a citation, with a deep link to the same lines on GitHub.
 * Loaded through `@defer`, so its code is not in the initial bundle.
 */
@Component({
  selector: 'app-source-viewer',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="viewer" role="dialog" aria-modal="false" [attr.aria-label]="chunk().path">
      <header>
        <div class="title">
          <code>{{ chunk().path }}</code>
          <span class="lines">L{{ chunk().startLine }}–{{ chunk().endLine }}</span>
        </div>
        <button type="button" class="btn ghost small" (click)="closed.emit()">{{ 'chat.viewer.close' | t }}</button>
      </header>
      @if (chunk().heading) {
        <p class="heading">{{ chunk().heading }}</p>
      }
      <pre dir="ltr">{{ chunk().text }}</pre>
      <a class="btn small" [href]="githubUrl()" target="_blank" rel="noopener noreferrer">{{ 'chat.viewer.github' | t }} ↗</a>
    </section>
  `,
  styles: `
    .viewer { display: grid; gap: .6rem; padding: .9rem; border: 1px solid var(--accent); border-radius: var(--radius); background: var(--surface); }
    header { display: flex; justify-content: space-between; gap: .5rem; align-items: flex-start; }
    .title { display: grid; min-inline-size: 0; code { overflow-wrap: anywhere; } }
    .lines, .heading { color: var(--ink-soft); font-size: .82rem; }
    pre { margin: 0; max-block-size: 16rem; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; background: var(--surface-sunk); padding: .7rem; border-radius: 8px; font-size: .82rem; }
    a { justify-self: start; text-decoration: none; }
  `,
})
export class SourceViewerComponent {
  readonly chunk = input.required<Chunk>();
  readonly githubUrl = input.required<string>();
  readonly closed = output<void>();
}
