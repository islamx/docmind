import { Injectable, signal } from '@angular/core';

export type ToastKind = 'info' | 'error' | 'success';

export interface Toast {
  readonly id: number;
  readonly kind: ToastKind;
  readonly text: string;
}

const AUTO_DISMISS_MS = 6000;

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private nextId = 1;
  private readonly _toasts = signal<readonly Toast[]>([]);
  /** Read-only view: callers cannot mutate the list. */
  readonly toasts = this._toasts.asReadonly();

  push(kind: ToastKind, text: string): number {
    const id = this.nextId++;
    this._toasts.update((list) => [...list.slice(-3), { id, kind, text }]);
    setTimeout(() => this.dismiss(id), AUTO_DISMISS_MS);
    return id;
  }

  error(text: string): number {
    return this.push('error', text);
  }

  dismiss(id: number): void {
    this._toasts.update((list) => list.filter((t) => t.id !== id));
  }
}
