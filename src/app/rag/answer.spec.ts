import { citedNumbers, linkifyCitations, normalizeCitations, parseCiteHref, toCitations } from './citations';
import { buildExtractiveAnswer, suggestFollowUps } from './extractive';
import { blobUrl, parseRepoInput, selectFiles, sourceId } from './github';
import { Chunk } from './models';
import { buildContext, buildMessages, SYSTEM_PROMPT } from './prompt';
import { encodeSse, parseSse } from './sse';

const chunk = (n: number, text = `passage ${n}`): Chunk => ({
  id: `f${n}#1`,
  path: `docs/f${n}.md`,
  heading: `Topic ${n} > Sub ${n}`,
  startLine: 1,
  endLine: 9,
  text,
});
const citations = toCitations([1, 2, 3].map((n) => ({ chunk: chunk(n), score: 1 })));

describe('prompt', () => {
  it('numbers context passages with their location', () => {
    const ctx = buildContext(citations);
    expect(ctx).toContain('[1] docs/f1.md:1-9 (Topic 1 > Sub 1)');
    expect(ctx).toContain('[3] docs/f3.md');
  });
  it('truncates context by size but always keeps the first passage', () => {
    expect(buildContext(citations, 1)).toContain('[1]');
    expect(buildContext(citations, 1)).not.toContain('[2]');
  });
  it('builds system + history + user messages and caps history', () => {
    const history = Array.from({ length: 10 }, (_, i) => ({ role: 'user' as const, content: `q${i}` }));
    const msgs = buildMessages('why?', citations, history);
    expect(msgs[0]).toEqual({ role: 'system', content: SYSTEM_PROMPT });
    expect(msgs).toHaveLength(1 + 4 + 1);
    expect(msgs.at(-1)?.content).toContain('Question: why?');
  });
});

describe('citations', () => {
  it('extracts valid unique numbers in order', () => {
    expect(citedNumbers('Use A [2] and B [1], again [2], bogus [9]', 3)).toEqual([2, 1]);
  });
  it('linkifies only valid markers and not existing links', () => {
    expect(linkifyCitations('see [1] and [7] and [x](http://a)', 3)).toBe(
      'see [\\[1\\]](#cite-1) and [7] and [x](http://a)',
    );
  });
  it('normalizes model-specific citation styles', () => {
    expect(normalizeCitations('A【2†L23-L26】 and B【1】')).toBe('A[2] and B[1]');
    expect(linkifyCitations('x【2†L1】', 3)).toBe('x[\\[2\\]](#cite-2)');
    expect(citedNumbers('x【3†L9】', 3)).toEqual([3]);
  });
  it('parses cite hrefs', () => {
    expect(parseCiteHref('#cite-3')).toBe(3);
    expect(parseCiteHref('https://x.dev')).toBeNull();
    expect(parseCiteHref(null)).toBeNull();
  });
});

describe('extractive fallback', () => {
  it('shows top passages with citation markers', () => {
    const answer = buildExtractiveAnswer(citations);
    expect(answer).toContain('**Topic 1 > Sub 1** [1]');
    expect(answer).toContain('[3]');
  });
  it('does not repeat the heading already shown as the title', () => {
    const c = toCitations([{ chunk: chunk(1, '## Computed signals\nBody text of the passage.'), score: 1 }]);
    expect(buildExtractiveAnswer(c)).not.toContain('## Computed signals');
    expect(buildExtractiveAnswer(c)).toContain('Body text of the passage.');
  });
  it('truncates long passages and handles empty input', () => {
    const long = toCitations([{ chunk: chunk(1, 'x'.repeat(2000)), score: 1 }]);
    expect(buildExtractiveAnswer(long).length).toBeLessThan(700);
    expect(buildExtractiveAnswer([])).toBe('');
  });
  it('suggests follow-ups from the deepest heading', () => {
    expect(suggestFollowUps(citations, 2)).toEqual(['Tell me more about "Sub 1"', 'Tell me more about "Sub 2"']);
  });
});

describe('sse', () => {
  it('parses complete frames and the DONE marker', () => {
    const r = parseSse('', 'data: {"token":"Hi"}\n\ndata: {"token":" there"}\n\ndata: [DONE]\n\n');
    expect(r.events).toEqual([{ token: 'Hi' }, { token: ' there' }]);
    expect(r.done).toBe(true);
    expect(r.rest).toBe('');
  });
  it('keeps a split frame in rest and completes it on the next chunk', () => {
    const first = parseSse('', 'data: {"tok');
    expect(first.events).toEqual([]);
    const second = parseSse(first.rest, 'en":"ok"}\n\n');
    expect(second.events).toEqual([{ token: 'ok' }]);
  });
  it('ignores malformed and unknown payloads', () => {
    expect(parseSse('', 'data: nope\n\ndata: {"x":1}\n\n').events).toEqual([]);
  });
  it('round-trips with encodeSse', () => {
    expect(parseSse('', encodeSse({ error: 'rate_limited' })).events).toEqual([{ error: 'rate_limited' }]);
  });
});

describe('github helpers', () => {
  it('parses owner/repo, URLs and tree URLs', () => {
    expect(parseRepoInput('angular/angular')).toEqual({ owner: 'angular', repo: 'angular', path: '' });
    expect(parseRepoInput('https://github.com/ngrx/platform.git')).toEqual({
      owner: 'ngrx',
      repo: 'platform',
      path: '',
    });
    expect(parseRepoInput('https://github.com/angular/angular/tree/main/adev/src/content/guide/')).toEqual({
      owner: 'angular',
      repo: 'angular',
      path: 'adev/src/content/guide',
    });
  });
  it('rejects garbage', () => {
    expect(parseRepoInput('')).toBeNull();
    expect(parseRepoInput('not a repo')).toBeNull();
    expect(parseRepoInput('https://gitlab.com/a/b')).toBeNull();
  });
  it('builds ids and blob links', () => {
    const ref = { owner: 'a', repo: 'b', path: 'docs' };
    expect(sourceId(ref)).toBe('a/b:docs');
    expect(blobUrl(ref, 'docs/x.md', 3, 9)).toBe('https://github.com/a/b/blob/HEAD/docs/x.md#L3-L9');
    expect(blobUrl(ref, 'docs/x.md', 3, 3)).toBe('https://github.com/a/b/blob/HEAD/docs/x.md#L3');
  });
  it('filters, prioritises docs and caps file count', () => {
    const ref = { owner: 'a', repo: 'b', path: 'docs' };
    const files = [
      { path: 'docs/z.ts', size: 10 },
      { path: 'docs/a.md', size: 10 },
      { path: 'docs/node_modules/x.md', size: 10 },
      { path: 'docs/big.md', size: 9_999_999 },
      { path: 'docs/x.spec.ts', size: 10 },
      { path: 'src/other.md', size: 10 },
      { path: 'docs/img.png', size: 10 },
    ];
    expect(selectFiles(files, ref).map((f) => f.path)).toEqual(['docs/a.md', 'docs/z.ts']);
    expect(selectFiles(files, ref, { extensions: ['.md', '.ts'], maxFileBytes: 100, maxFiles: 1 })).toHaveLength(1);
  });
});
