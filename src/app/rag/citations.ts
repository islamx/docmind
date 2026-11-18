import { Citation, ScoredChunk } from './models';

export function toCitations(hits: readonly ScoredChunk[]): Citation[] {
  return hits.map((h, i) => ({ n: i + 1, chunk: h.chunk }));
}

/** Citation numbers actually referenced by the model, in order of first use. */
export function citedNumbers(answer: string, max: number): number[] {
  const seen = new Set<number>();
  for (const match of normalizeCitations(answer).matchAll(/\[(\d{1,2})\]/g)) {
    const n = Number(match[1]);
    if (n >= 1 && n <= max) seen.add(n);
  }
  return [...seen];
}

/** Some models cite as 【2†L23-L26】. Rewrite those to the plain [2] form. */
export function normalizeCitations(text: string): string {
  return text.replace(/【(\d{1,2})(?:†[^】]*)?】/g, '[$1]');
}

/** Turns `[2]` into a markdown link the UI can intercept: `[\[2\]](#cite-2)`. */
export function linkifyCitations(markdown: string, max: number): string {
  return normalizeCitations(markdown).replace(/\[(\d{1,2})\](?!\()/g, (whole, digits: string) => {
    const n = Number(digits);
    return n >= 1 && n <= max ? `[\\[${n}\\]](#cite-${n})` : whole;
  });
}

export function parseCiteHref(href: string | null): number | null {
  const match = /^#cite-(\d{1,2})$/.exec(href ?? '');
  return match ? Number(match[1]) : null;
}
