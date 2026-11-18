import { Bm25Index } from './bm25';
import { reciprocalRankFusion } from './fusion';
import { Chunk } from './models';
import { HybridRetriever, rateConfidence } from './retriever';
import { tokenize } from './tokenizer';
import { dot, normalize, topK } from './vector';

const chunk = (id: string, text: string, heading = ''): Chunk => ({
  id,
  path: `${id}.md`,
  heading,
  startLine: 1,
  endLine: 5,
  text,
});

describe('tokenize', () => {
  it('splits camelCase and keeps the joined form', () => {
    expect(tokenize('linkedSignal')).toEqual(['linkedsignal', 'linked', 'signal']);
  });
  it('splits snake_case and drops stopwords and 1-char tokens', () => {
    expect(tokenize('the user_id is x')).toEqual(['userid', 'user', 'id']);
  });
  it('keeps Arabic words', () => {
    expect(tokenize('كيف أستخدم الإشارات')).toContain('الإشارات');
  });
});

describe('Bm25Index', () => {
  const index = new Bm25Index([
    { id: 'a', tokens: tokenize('signals computed derive state') },
    { id: 'b', tokens: tokenize('routing guards resolvers navigation') },
    { id: 'c', tokens: tokenize('signals signals signals everywhere') },
  ]);

  it('ranks documents containing the term and ignores the rest', () => {
    const hits = index.search(['routing'], 5);
    expect(hits.map((h) => h.id)).toEqual(['b']);
  });
  it('prefers rarer terms through idf', () => {
    const hits = index.search(['signals', 'guards'], 5);
    expect(hits[0].id).toBe('b');
  });
  it('returns nothing for unknown terms and respects the limit', () => {
    expect(index.search(['zzz'], 5)).toEqual([]);
    expect(index.search(['signals'], 1)).toHaveLength(1);
  });
});

describe('vector helpers', () => {
  it('normalizes to unit length', () => {
    const v = normalize(new Float32Array([3, 4]));
    expect(dot(v, v)).toBeCloseTo(1);
  });
  it('topK orders by similarity', () => {
    const vectors = new Map([
      ['near', normalize(new Float32Array([1, 0.1]))],
      ['far', normalize(new Float32Array([0, 1]))],
    ]);
    expect(topK(normalize(new Float32Array([1, 0])), vectors, 2).map((h) => h.id)).toEqual(['near', 'far']);
  });
});

describe('reciprocalRankFusion', () => {
  it('rewards items that appear in both lists', () => {
    const fused = reciprocalRankFusion([['a', 'b', 'c'], ['c', 'a']]);
    expect(fused.map((f) => f.id)).toEqual(['a', 'c', 'b']);
  });
  it('is stable for ties', () => {
    expect(reciprocalRankFusion([['x'], ['y']]).map((f) => f.id)).toEqual(['x', 'y']);
  });
});

describe('HybridRetriever', () => {
  const chunks = [
    chunk('signals', 'A signal wraps a value and notifies consumers.', 'Signals'),
    chunk('routing', 'The router maps URLs to components with guards.', 'Routing'),
    chunk('forms', 'Reactive forms track validity of inputs.', 'Forms'),
  ];

  it('works lexically with no vectors', () => {
    const result = new HybridRetriever(chunks).search('how do guards work', null, 2);
    expect(result.hits[0].chunk.id).toBe('routing');
    expect(result.usedVectors).toBe(false);
    expect(result.topSimilarity).toBeNull();
  });

  it('fuses vector hits in when vectors exist', () => {
    const vectors = new Map([
      ['signals', normalize(new Float32Array([1, 0, 0]))],
      ['routing', normalize(new Float32Array([0, 1, 0]))],
      ['forms', normalize(new Float32Array([0, 0, 1]))],
    ]);
    const retriever = new HybridRetriever(chunks, vectors);
    const result = retriever.search('unrelated words', normalize(new Float32Array([0, 0, 1])), 1);
    expect(result.hits[0].chunk.id).toBe('forms');
    expect(result.usedVectors).toBe(true);
    expect(result.confidence).toBe('high');
  });

  it('reports no confidence when nothing matches', () => {
    expect(new HybridRetriever(chunks).search('zzzz qqqq', null).confidence).toBe('none');
  });
});

describe('rateConfidence', () => {
  it('maps similarity to levels', () => {
    expect(rateConfidence(3, 0.6, 5)).toBe('high');
    expect(rateConfidence(3, 0.35, 5)).toBe('medium');
    expect(rateConfidence(3, 0.1, 0)).toBe('low');
  });
  it('is conservative without vectors', () => {
    expect(rateConfidence(3, null, 1)).toBe('low');
    expect(rateConfidence(3, null, 4)).toBe('medium');
  });
});
