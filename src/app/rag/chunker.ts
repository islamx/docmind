import { Chunk, SourceDoc } from './models';

export interface ChunkOptions {
  /** Soft limit. A chunk is closed at the next blank line after exceeding it. */
  readonly maxChars: number;
  /** Hard limit. A chunk is always closed here, even mid-paragraph. */
  readonly hardMaxChars: number;
  /** Chunks shorter than this are dropped as noise. */
  readonly minChars: number;
}

export const DEFAULT_CHUNK_OPTIONS: ChunkOptions = { maxChars: 900, hardMaxChars: 1600, minChars: 40 };

const HEADING = /^(#{1,6})\s+(.*)$/;
const FENCE = /^\s*(```|~~~)/;

/**
 * Markdown-aware chunker.
 * - Prefers heading boundaries, then blank lines, never splits inside a code fence
 *   (unless the hard limit forces it).
 * - Keeps a heading breadcrumb so a chunk is understandable out of context.
 * - Records 1-based line ranges, which become the citation anchors.
 */
export function chunkDocument(doc: SourceDoc, options: ChunkOptions = DEFAULT_CHUNK_OPTIONS): Chunk[] {
  const lines = doc.text.replace(/\r\n/g, '\n').split('\n');
  const isMarkdown = /\.(md|mdx|markdown)$/i.test(doc.path);
  const chunks: Chunk[] = [];

  const trail: string[] = [];
  let buffer: string[] = [];
  let bufferStart = 1;
  let size = 0;
  let inFence = false;

  const flush = (endLine: number) => {
    const text = buffer.join('\n').trim();
    if (text.length >= options.minChars) {
      chunks.push({
        id: `${doc.path}#${bufferStart}`,
        path: doc.path,
        heading: trail.filter(Boolean).join(' > '),
        startLine: bufferStart,
        endLine,
        text,
      });
    }
    buffer = [];
    size = 0;
  };

  lines.forEach((line, i) => {
    const lineNo = i + 1;

    if (isMarkdown && FENCE.test(line)) inFence = !inFence;

    const heading = isMarkdown && !inFence ? HEADING.exec(line) : null;
    if (heading) {
      flush(lineNo - 1);
      const level = heading[1].length;
      trail.length = level - 1;
      trail[level - 1] = heading[2].trim();
      bufferStart = lineNo;
    } else if (buffer.length === 0) {
      bufferStart = lineNo;
    }

    buffer.push(line);
    size += line.length + 1;

    const atBlank = line.trim() === '' && !inFence;
    if ((size >= options.maxChars && atBlank) || size >= options.hardMaxChars) flush(lineNo);
  });
  flush(lines.length);

  return chunks;
}
