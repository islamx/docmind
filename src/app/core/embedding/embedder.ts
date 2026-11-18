import { Signal } from '@angular/core';

export type EmbedderStatus = 'idle' | 'loading' | 'ready' | 'unavailable';

/**
 * Port for turning text into unit vectors. Abstract class doubles as the DI token,
 * so the Web Worker implementation can be swapped for a fake in tests.
 */
export abstract class Embedder {
  abstract readonly status: Signal<EmbedderStatus>;
  /** Model download progress, 0..1. */
  abstract readonly progress: Signal<number>;
  /** Rejects when the model cannot be loaded. Callers must fall back to keyword search. */
  abstract embed(texts: readonly string[]): Promise<Float32Array[]>;
}
