import { Pipe, PipeTransform } from '@angular/core';
import { marked } from 'marked';
import { linkifyCitations } from '../rag/citations';

/**
 * Markdown to HTML. The output is bound with `[innerHTML]`, so Angular's built-in
 * DomSanitizer strips scripts, event handlers and unsafe URLs: model output is untrusted
 * and is never marked as trusted. Citation markers become `#cite-n` links.
 * Pure on purpose: re-runs only when the text or citation count changes.
 */
@Pipe({ name: 'markdown' })
export class MarkdownPipe implements PipeTransform {
  transform(text: string, citationCount = 0): string {
    if (!text) return '';
    const source = citationCount > 0 ? linkifyCitations(text, citationCount) : text;
    return marked.parse(source, { async: false, gfm: true, breaks: false });
  }
}
