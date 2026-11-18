import { Provider } from '@angular/core';
import { Embedder } from './embedder';
import { WorkerEmbedder } from './worker-embedder';

export function provideEmbedder(): Provider {
  return { provide: Embedder, useClass: WorkerEmbedder };
}
