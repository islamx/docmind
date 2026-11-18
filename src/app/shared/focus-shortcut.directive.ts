import { Directive, ElementRef, inject, input } from '@angular/core';

/**
 * Focuses the host when a key is pressed anywhere outside a text field.
 * `<textarea appFocusShortcut="/">` gives the familiar "press / to search".
 */
@Directive({
  selector: '[appFocusShortcut]',
  host: { '(document:keydown)': 'onKey($event)' },
})
export class FocusShortcutDirective {
  readonly key = input('/', { alias: 'appFocusShortcut' });
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected onKey(event: KeyboardEvent): void {
    if (event.key !== this.key() || event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target as HTMLElement | null;
    if (target && (target.isContentEditable || /^(input|textarea|select)$/i.test(target.tagName))) return;
    event.preventDefault();
    this.host.nativeElement.focus();
  }
}
