export const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';

export type WorkerRequest = { readonly id: number; readonly texts: readonly string[] };

export type WorkerResponse =
  | { readonly type: 'progress'; readonly value: number }
  | { readonly type: 'ready' }
  | { readonly type: 'result'; readonly id: number; readonly vectors: Float32Array[] }
  | { readonly type: 'error'; readonly id: number; readonly message: string };
