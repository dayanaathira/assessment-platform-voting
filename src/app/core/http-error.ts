import { HttpErrorResponse } from '@angular/common/http';
import { ApiError } from './models';

/**
 * Turns an API error into one line to show the user.
 * @param err - Whatever the HTTP call threw.
 * @param fallback - Text when the error carries no usable message.
 * @returns The message to display.
 */
export function errorMessage(
  err: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (!(err instanceof HttpErrorResponse)) {
    return fallback;
  }
  if (err.status === 0) {
    return 'Cannot reach the server. Check your connection and try again.';
  }

  const message = (err.error as Partial<ApiError> | null)?.message;
  if (Array.isArray(message)) {
    return message.join(' ');
  }
  return message || fallback;
}
