const STOPWORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'of',
  'to',
  'in',
  'on',
  'for',
  'is',
  'are',
  'was',
  'be',
  'it',
  'this',
  'that',
  'with',
  'as',
  'at',
  'by',
  'from',
  'how',
  'what',
  'do',
  'does',
  'i',
  'you',
  'can',
  'if',
  'not',
  'use',
]);

/**
 * Lowercase word tokens. Splits camelCase and snake_case so that a query for
 * "signal" still matches `linkedSignal`, while the joined form is kept too.
 * Unicode-aware, so Arabic words survive.
 */
export function tokenize(text: string): string[] {
  const out: string[] = [];
  const words = text.match(/[\p{L}\p{N}_]+/gu) ?? [];
  for (const word of words) {
    const parts = word
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/_/g, ' ')
      .toLowerCase()
      .split(' ')
      .filter(Boolean);
    const joined = word.toLowerCase().replace(/_/g, '');
    const all = parts.length > 1 ? [joined, ...parts] : parts;
    for (const token of all) {
      if (token.length >= 2 && !STOPWORDS.has(token)) out.push(token);
    }
  }
  return out;
}
