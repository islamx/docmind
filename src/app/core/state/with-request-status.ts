import { computed } from '@angular/core';
import { signalStoreFeature, withComputed, withState } from '@ngrx/signals';
import { AppErrorCode } from '../errors/app-error';

export type RequestStatus = 'idle' | 'pending' | 'success' | 'error';

interface RequestState {
  readonly status: RequestStatus;
  readonly errorCode: AppErrorCode | null;
}

/**
 * Reusable store feature (the SignalStore answer to a custom hook).
 * Adds `status`, `errorCode` and derived flags. Update it with the `set*` helpers.
 */
export function withRequestStatus() {
  return signalStoreFeature(
    withState<RequestState>({ status: 'idle', errorCode: null }),
    withComputed(({ status }) => ({
      isPending: computed(() => status() === 'pending'),
      isError: computed(() => status() === 'error'),
    })),
  );
}

export const setIdle = (): RequestState => ({ status: 'idle', errorCode: null });
export const setPending = (): RequestState => ({ status: 'pending', errorCode: null });
export const setSuccess = (): RequestState => ({ status: 'success', errorCode: null });
export const setError = (errorCode: AppErrorCode): RequestState => ({ status: 'error', errorCode });
