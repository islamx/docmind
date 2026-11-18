/// <reference lib="webworker" />
import { env, pipeline } from '@huggingface/transformers';
import { EMBEDDING_MODEL, WorkerRequest, WorkerResponse } from './embed-protocol';

/**
 * Runs the embedding model off the main thread so typing and scrolling stay smooth
 * while thousands of passages are processed.
 */
type Extractor = (
  texts: string[],
  options: { pooling: 'mean'; normalize: boolean },
) => Promise<{ data: Float32Array; dims: number[] }>;

env.allowLocalModels = false;

const post = (message: WorkerResponse, transfer: Transferable[] = []) => postMessage(message, transfer);

const fileProgress = new Map<string, { loaded: number; total: number }>();
let extractorPromise: Promise<Extractor> | undefined;

function loadModel(): Promise<Extractor> {
  extractorPromise ??= pipeline('feature-extraction', EMBEDDING_MODEL, {
    dtype: 'q8',
    progress_callback: (event: { status: string; file?: string; loaded?: number; total?: number }) => {
      if (event.status !== 'progress' || !event.file || !event.total) return;
      fileProgress.set(event.file, { loaded: event.loaded ?? 0, total: event.total });
      let loaded = 0;
      let total = 0;
      for (const f of fileProgress.values()) {
        loaded += f.loaded;
        total += f.total;
      }
      post({ type: 'progress', value: total ? loaded / total : 0 });
    },
  }).then((p) => {
    post({ type: 'ready' });
    return p as unknown as Extractor;
  });
  return extractorPromise;
}

addEventListener('message', async ({ data }: MessageEvent<WorkerRequest>) => {
  try {
    const extractor = await loadModel();
    const output = await extractor([...data.texts], { pooling: 'mean', normalize: true });
    const dim = output.dims[output.dims.length - 1];
    const vectors = data.texts.map((_, i) => output.data.slice(i * dim, (i + 1) * dim));
    post(
      { type: 'result', id: data.id, vectors },
      vectors.map((v) => v.buffer),
    );
  } catch (error) {
    extractorPromise = undefined; // allow a retry on the next request
    post({ type: 'error', id: data.id, message: error instanceof Error ? error.message : String(error) });
  }
});
