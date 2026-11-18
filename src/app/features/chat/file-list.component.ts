import { ScrollingModule } from '@angular/cdk/scrolling';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** Thousands of paths without thousands of DOM nodes: CDK virtual scroll renders only what is visible. */
@Component({
  selector: 'app-file-list',
  imports: [ScrollingModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <cdk-virtual-scroll-viewport class="viewport" itemSize="30" minBufferPx="200" maxBufferPx="400">
      <button
        *cdkVirtualFor="let path of paths(); trackBy: trackByPath"
        type="button"
        class="file"
        [title]="path"
        (click)="picked.emit(path)"
      >
        {{ path }}
      </button>
    </cdk-virtual-scroll-viewport>
  `,
  styles: `
    :host {
      display: block;
      min-block-size: 0;
      flex: 1;
    }
    .viewport {
      block-size: 100%;
      min-block-size: 8rem;
    }
    .file {
      display: block;
      inline-size: 100%;
      block-size: 30px;
      text-align: start;
      border: 0;
      background: none;
      color: var(--ink-soft);
      font: inherit;
      font-family: var(--font-mono);
      font-size: 0.78rem;
      padding-inline: 0.4rem;
      cursor: pointer;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      direction: ltr;
      &:hover {
        background: var(--surface-sunk);
        color: var(--ink);
      }
    }
  `,
})
export class FileListComponent {
  readonly paths = input.required<readonly string[]>();
  readonly picked = output<string>();

  protected trackByPath = (_: number, path: string) => path;
}
