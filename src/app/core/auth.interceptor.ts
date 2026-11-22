import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';

/**
 * Adds the Bearer token. On a 401 it refreshes once and retries; if the refresh fails it logs out.
 * @param req - Outgoing request.
 * @param next - Next handler.
 * @returns The response stream.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Login and refresh carry their own credentials, and a 401 there must reach the caller.
  if (req.url.endsWith('/auth/login') || req.url.endsWith('/auth/refresh')) {
    return next(req);
  }

  const auth = inject(AuthService);
  return next(withToken(req, auth.getAccessToken())).pipe(
    catchError((err) => {
      if (!(err instanceof HttpErrorResponse) || err.status !== 401) {
        return throwError(() => err);
      }
      return auth.refresh().pipe(
        catchError((refreshErr) => {
          auth.logout();
          return throwError(() => refreshErr);
        }),
        // A second 401 from the retry is passed on, not refreshed again.
        switchMap((token) => next(withToken(req, token))),
      );
    }),
  );
};

/**
 * Copies the request with an Authorization header.
 * @param req - Request to copy.
 * @param token - Access token, or null to send it unchanged.
 * @returns The request to send.
 */
function withToken<T>(req: HttpRequest<T>, token: string | null): HttpRequest<T> {
  return token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
}
