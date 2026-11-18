import { chunkDocument } from './chunker';

const md = (lines: string[]) => ({ path: 'docs/a.md', text: lines.join('\n') });

describe('chunkDocument', () => {
  it('splits at headings and keeps a heading breadcrumb', () => {
    const chunks = chunkDocument(
      md([
        '# Signals',
        'Signals hold values that notify consumers when they change.',
        '',
        '## Computed',
        'Computed signals derive state from other signals lazily and memoize it.',
      ]),
    );
    expect(chunks.map((c) => c.heading)).toEqual(['Signals', 'Signals > Computed']);
  });

  it('records 1-based line ranges', () => {
    const [first, second] = chunkDocument(
      md([
        '# One',
        'first section has enough text to be kept here.',
        '# Two',
        'second section has enough text to be kept too.',
      ]),
    );
    expect([first.startLine, first.endLine]).toEqual([1, 2]);
    expect([second.startLine, second.endLine]).toEqual([3, 4]);
  });

  it('does not treat # inside a code fence as a heading', () => {
    const chunks = chunkDocument(
      md([
        '# Title',
        'Intro text that is long enough to be retained as content.',
        '```bash',
        '# not a heading',
        'echo hi',
        '```',
      ]),
    );
    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toContain('# not a heading');
  });

  it('closes a chunk at a blank line once the soft limit is exceeded', () => {
    const para = 'word '.repeat(60).trim();
    const chunks = chunkDocument(md(['# T', para, '', para, '', para]), {
      maxChars: 300,
      hardMaxChars: 2000,
      minChars: 10,
    });
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('enforces the hard limit even without blank lines', () => {
    const lines = Array.from({ length: 40 }, (_, i) => `line number ${i} with some filler text`);
    const chunks = chunkDocument(
      { path: 'x.ts', text: lines.join('\n') },
      { maxChars: 200, hardMaxChars: 400, minChars: 10 },
    );
    expect(chunks.every((c) => c.text.length <= 500)).toBe(true);
    expect(chunks.length).toBeGreaterThan(2);
  });

  it('drops tiny chunks and gives stable ids', () => {
    const chunks = chunkDocument(
      md(['# A', 'x', '# B', 'This section is long enough to survive the minimum size filter.']),
    );
    expect(chunks).toHaveLength(1);
    expect(chunks[0].id).toBe('docs/a.md#3');
  });

  it('handles CRLF and empty input', () => {
    expect(chunkDocument({ path: 'e.md', text: '' })).toEqual([]);
    const [c] = chunkDocument({ path: 'w.md', text: '# H\r\nWindows line endings are normalised before processing.' });
    expect(c.text).not.toContain('\r');
  });
});
