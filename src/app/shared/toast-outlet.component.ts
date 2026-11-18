import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NotificationService } from '../core/notifications/notification.service';
import { TranslatePipe } from '../core/i18n/translate.pipe';

@Component({
  selector: 'app-toast-outlet',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toasts" role="status" aria-live="polite">
      @for (toast of notifications.toasts(); track toast.id) {
        <div class="toast" [class]="'toast ' + toast.kind">
          <span>{{ toast.text }}</span>
          <button type="button" class="icon-btn" [attr.aria-label]="'toast.dismiss' | t" (click)="notifications.dismiss(toast.id)">
            ×
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .toasts { position: fixed; inset-block-end: 1rem; inset-inline-end: 1rem; display: grid; gap: .5rem; z-index: 50; max-inline-size: min(26rem, calc(100vw - 2rem)); }
    .toast { display: flex; gap: .75rem; align-items: center; justify-content: space-between; padding: .7rem .9rem; border-radius: var(--radius); background: var(--surface-raised); border: 1px solid var(--border); box-shadow: var(--shadow); font-size: .9rem; }
    .toast.error { border-color: var(--danger); }
    .icon-btn { background: none; border: 0; color: inherit; font-size: 1.2rem; cursor: pointer; line-height: 1; }
  `,
})
export class ToastOutletComponent {
  protected readonly notifications = inject(NotificationService);
}
