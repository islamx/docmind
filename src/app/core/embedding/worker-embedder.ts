import { Injectable, signal } from '@angular/core';
import { AppError } from '../errors/app-error';
import { Embedder, EmbedderStatus } from './embedder';
import { WorkerResponse } from './embed-protocol';

interface Pending {
  resolve: (vectors: Float32Array[]) => void;
  reject: (error: Error) => void;
}

/** Embedder backed by a module Web Worker. The worker (and the model) load lazily on first use. */
@Injectable()
export class WorkerEmbedder extends Embedder {
  private worker?: Worker;
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();

  private readonly _status = signal<EmbedderStatus>('idle');
  private readonly _progress = signal(0);
  readonly status = this._status.asReadonly();
  readonly progress = this._progress.asReadonly();

  embed(texts: readonly string[]): Promise<Float32Array[]> {
    if (this._status() === 'unavailable') {
      return Promise.reject(new AppError('embedding_unavailable'));
    }
    const worker = this.ensureWorker();
    if (!worker) return Promise.reject(new AppError('embedding_unavailable'));

    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      this.pending.set(id, { resolve, reject });
      worker.postMessage({ id, texts });
    });
  }

  private ensureWorker(): Worker | undefined {
    if (this.worker) return this.worker;
    if (typeof Worker === 'undefined') {
      this._status.set('unavailable');
      return undefined;
    }
    this._status.set('loading');
    const worker = new Worker(new URL('./embed.worker', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }: MessageEvent<WorkerResponse>) => this.onMessage(data);
    worker.onerror = () => this.fail(new AppError('embedding_unavailable'));
    this.worker = worker;
    return worker;
  }

  private onMessage(message: WorkerResponse): void {
    switch (message.type) {
      case 'progress':
        this._progress.set(message.value);
        break;
      case 'ready':
        this._status.set('ready');
        this._progress.set(1);
        break;
      case 'result':
        this.settle(message.id, (p) => p.resolve(message.vectors));
        break;
      case 'error':
        this.settle(message.id, (p) => p.reject(new AppError('embedding_unavailable', message.message)));
        if (this._status() !== 'ready') this.markUnavailable();
        break;
    }
  }

  private settle(id: number, action: (p: Pending) => void): void {
    const pending = this.pending.get(id);
    if (!pending) return;
    this.pending.delete(id);
    action(pending);
  }

  private fail(error: AppError): void {
    this.markUnavailable();
    for (const [id] of this.pending) this.settle(id, (p) => p.reject(error));
  }

  private markUnavailable(): void {
    this._status.set('unavailable');
    this.worker?.terminate();
    this.worker = undefined;
  }
}
