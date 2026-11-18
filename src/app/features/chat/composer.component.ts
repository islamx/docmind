import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { FocusShortcutDirective } from '../../shared/focus-shortcut.directive';

@Component({
  selector: 'app-composer',
  imports: [TranslatePipe, FocusShortcutDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="composer" (submit)="submit($event)">
      <label class="visually-hidden" for="question">{{ 'chat.placeholder' | t }}</label>
      <textarea
        id="question"
        rows="1"
        appFocusShortcut="/"
        [value]="value()"
        [placeholder]="'chat.placeholder' | t"
        (input)="value.set($any($event.target).value)"
        (keydown)="onKeydown($event)"
      ></textarea>
      @if (busy()) {
        <button type="button" class="btn ghost" (click)="stop.emit()">{{ 'chat.stop' | t }}</button>
      } @else {
        <button type="submit" class="btn" [disabled]="!value().trim()">{{ 'chat.send' | t }}</button>
      }
    </form>
  `,
  styles: `
    .composer { display: flex; gap: .5rem; align-items: flex-end; padding: .6rem; border: 1px solid var(--border); background: var(--surface); border-radius: var(--radius-lg); &:focus-within { border-color: var(--accent); } }
    textarea { flex: 1; min-inline-size: 0; resize: none; border: 0; outline: 0; background: transparent; color: var(--ink); font: inherit; max-block-size: 9rem; field-sizing: content; padding: .35rem .4rem; }
  `,
})
export class ComposerComponent {
  /** Two-way bindable: `[(value)]="draft"`. */
  readonly value = model('');
  readonly busy = input(false);
  readonly send = output<string>();
  readonly stop = output<void>();

  protected submit(event: Event): void {
    event.preventDefault();
    const text = this.value().trim();
    if (!text || this.busy()) return;
    this.send.emit(text);
    this.value.set('');
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      this.submit(event);
    } else if (event.key === 'Escape' && this.busy()) {
      this.stop.emit();
    }
  }
}
