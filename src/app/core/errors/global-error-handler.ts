import { ErrorHandler, Injectable, inject } from '@angular/core';
import { I18nService } from '../i18n/i18n.service';
import { NotificationService } from '../notifications/notification.service';
import { toAppError } from './app-error';

/**
 * Last line of defence. Anything that escapes a component or store lands here:
 * log it for developers, show a calm message to the user. Replaces React error boundaries
 * for async/unhandled errors (boundaries for render errors do not exist in Angular).
 */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly notifications = inject(NotificationService);
  private readonly i18n = inject(I18nService);

  handleError(error: unknown): void {
    const appError = toAppError(error);
    console.error('[docmind]', error);
    this.notifications.error(this.i18n.t(`error.${appError.code}`));
  }
}
