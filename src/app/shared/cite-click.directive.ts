import { Directive, output } from '@angular/core';
import { parseCiteHref } from '../rag/citations';

/**
 * Event delegation for rendered markdown: the HTML is injected as a string, so we cannot
 * bind (click) on its links. One host listener catches clicks on `#cite-n` anchors and
 * emits the citation number.
 */
@Directive({
  selector: '[appCiteClick]',
  host: { '(click)': 'onClick($event)' },
})
export class CiteClickDirective {
  readonly cite = output<number>({ alias: 'appCiteClick' });

  protected onClick(event: MouseEvent): void {
    const anchor = (event.target as HTMLElement | null)?.closest('a');
    const n = parseCiteHref(anchor?.getAttribute('href') ?? null);
    if (n === null) return;
    event.preventDefault();
    this.cite.emit(n);
  }
}
