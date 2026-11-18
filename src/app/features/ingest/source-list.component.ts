import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { SourceMeta } from '../../data/chunk-repository';
import { chatLink } from '../chat/chat-link';

/** Presentational: data in through `input()`, intent out through `output()`. */
@Component({
  selector: 'app-source-list',
  imports: [RouterLink, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="list">
      @for (source of sources(); track source.id) {
        <li class="item">
          <div class="meta">
            <a class="name" [routerLink]="link(source).commands" [queryParams]="link(source).queryParams">
              {{ source.owner }}/{{ source.repo }}
            </a>
            @if (source.path) {
              <code class="path">{{ source.path }}</code>
            }
            <span class="stats">
              {{ source.fileCount }} {{ 'ingest.files' | t }} · {{ source.chunkCount }} {{ 'ingest.passages' | t }}
              ·
              <span [class]="'status ' + source.status">
                {{ source.status === 'partial' ? ('source.status.partial' | t) : ('source.status.ready' | t) }}
              </span>
            </span>
          </div>
          <div class="row-actions">
            <a class="btn small" [routerLink]="link(source).commands" [queryParams]="link(source).queryParams">{{ 'source.open' | t }}</a>
            <button type="button" class="btn small danger" (click)="remove.emit(source.id)">{{ 'source.remove' | t }}</button>
          </div>
        </li>
      }
    </ul>
  `,
  styles: `
    .list { list-style: none; margin: 0; padding: 0; display: grid; gap: .6rem; }
    .item { display: flex; gap: 1rem; align-items: center; justify-content: space-between; flex-wrap: wrap; padding: .8rem 1rem; border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); }
    .meta { display: grid; gap: .15rem; min-inline-size: 0; }
    .name { font-weight: 650; color: var(--ink); text-decoration: none; &:hover { color: var(--accent); } }
    .path { color: var(--ink-soft); overflow-wrap: anywhere; }
    .stats { color: var(--ink-soft); font-size: .85rem; }
    .status.ready { color: var(--ok); }
    .status.partial, .status.embedding { color: var(--warn); }
    .row-actions { display: flex; gap: .4rem; }
  `,
})
export class SourceListComponent {
  readonly sources = input.required<readonly SourceMeta[]>();
  readonly remove = output<string>();

  protected link = chatLink;
}
