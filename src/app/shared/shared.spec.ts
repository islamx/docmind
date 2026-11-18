import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CiteClickDirective } from './cite-click.directive';
import { FocusShortcutDirective } from './focus-shortcut.directive';
import { MarkdownPipe } from './markdown.pipe';

describe('MarkdownPipe', () => {
  const pipe = new MarkdownPipe();

  it('renders markdown', () => {
    expect(pipe.transform('**bold** and `code`')).toContain('<strong>bold</strong>');
  });
  it('turns valid citation markers into #cite links and leaves invalid ones', () => {
    const html = pipe.transform('See [1] and [9]', 2);
    expect(html).toContain('href="#cite-1"');
    expect(html).not.toContain('#cite-9');
  });
  it('returns an empty string for empty input', () => {
    expect(pipe.transform('')).toBe('');
  });
});

@Component({
  imports: [MarkdownPipe, CiteClickDirective],
  template: `<div [innerHTML]="text() | markdown: 2" (appCiteClick)="cited.push($event)"></div>`,
})
class MarkdownHost {
  text = signal('Answer [2] <img src=x onerror="window.__xss=1"> <script>window.__xss=1</script> [link](javascript:alert(1))');
  cited: number[] = [];
}

describe('markdown rendering safety and citation clicks', () => {
  it("strips scripts, handlers and javascript: URLs via Angular's sanitizer", () => {
    const fixture = TestBed.createComponent(MarkdownHost);
    fixture.detectChanges();
    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(html).not.toContain('<script');
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('href="javascript:');
    expect(html).toContain('unsafe:javascript'); // neutralised, not executable
  });

  it('emits the citation number when a marker is clicked and ignores other links', () => {
    const fixture = TestBed.createComponent(MarkdownHost);
    fixture.componentInstance.text.set('Use it [2] or [site](https://example.com)');
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    root.querySelector<HTMLAnchorElement>('a[href="#cite-2"]')!.click();
    root.querySelector<HTMLAnchorElement>('a[href="https://example.com"]')!.addEventListener('click', (e) => e.preventDefault());
    root.querySelector<HTMLAnchorElement>('a[href="https://example.com"]')!.click();

    expect(fixture.componentInstance.cited).toEqual([2]);
  });
});

@Component({ imports: [FocusShortcutDirective], template: `<textarea appFocusShortcut="/"></textarea><input id="other" />` })
class FocusHost {}

describe('FocusShortcutDirective', () => {
  const press = (target: EventTarget, key: string, init: KeyboardEventInit = {}) =>
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }));

  it('focuses the host on "/" from the page', () => {
    const fixture = TestBed.createComponent(FocusHost);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    const textarea = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;

    press(document.body, '/');
    expect(document.activeElement).toBe(textarea);
    fixture.nativeElement.remove();
  });

  it('does not steal "/" typed into another field or with a modifier', () => {
    const fixture = TestBed.createComponent(FocusHost);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    const other = fixture.nativeElement.querySelector('#other') as HTMLInputElement;
    other.focus();

    press(other, '/');
    expect(document.activeElement).toBe(other);
    press(document.body, '/', { ctrlKey: true });
    expect(document.activeElement).toBe(other);
    fixture.nativeElement.remove();
  });
});
