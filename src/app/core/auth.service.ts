import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { finalize, map, Observable, shareReplay, throwError } from 'rxjs';
import { API_URL } from './api';
import { ApiResponse, AuthUser, Tokens } from './models';

const ACCESS_KEY = 'fv.accessToken';
const REFRESH_KEY = 'fv.refreshToken';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly accessToken = signal(localStorage.getItem(ACCESS_KEY));
  // Shared so parallel 401s wait on one refresh call instead of each sending their own.
  private refreshing$?: Observable<string>;

  readonly user = computed(() => decodeUser(this.accessToken()));
  readonly isLoggedIn = computed(() => this.user() !== null);
  readonly isAdmin = computed(() => this.user()?.roles.includes('admin') ?? false);

  /**
   * Signs in and stores the token pair.
   * @param username - Login name; the API lower-cases it.
   * @param password - Plain password.
   * @returns Completes once the tokens are stored.
   */
  login(username: string, password: string): Observable<void> {
    return this.http
      .post<ApiResponse<Tokens>>(`${API_URL}/auth/login`, { username, password })
      .pipe(map((res) => this.store(res.data)));
  }

  /**
   * Swaps the refresh token for a new pair. Concurrent callers share one request.
   * @returns The new access token.
   */
  refresh(): Observable<string> {
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    if (!refreshToken) {
      return throwError(() => new Error('No refresh token'));
    }

    this.refreshing$ ??= this.http
      .post<ApiResponse<Tokens>>(`${API_URL}/auth/refresh`, { refreshToken })
      .pipe(
        map((res) => {
          this.store(res.data);
          return res.data.accessToken;
        }),
        finalize(() => (this.refreshing$ = undefined)),
        shareReplay(1),
      );
    return this.refreshing$;
  }

  /**
   * Current access token for the interceptor.
   * @returns The token, or null when signed out.
   */
  getAccessToken(): string | null {
    return this.accessToken();
  }

  /**
   * Clears the tokens and sends the user to the login page.
   * @returns Nothing.
   */
  logout(): void {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    this.accessToken.set(null);
    this.router.navigate(['/login']);
  }

  /**
   * Persists a token pair and updates the signed-in user.
   * @param tokens - Pair returned by login or refresh.
   * @returns Nothing.
   */
  private store(tokens: Tokens): void {
    localStorage.setItem(ACCESS_KEY, tokens.accessToken);
    localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
    this.accessToken.set(tokens.accessToken);
  }
}

/**
 * Reads the user from the access token's payload. Display only; the API verifies the signature.
 * @param token - JWT access token.
 * @returns The user, or null when the token is missing or malformed.
 */
function decodeUser(token: string | null): AuthUser | null {
  if (!token) {
    return null;
  }
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    // TextDecoder keeps non-ASCII names intact; atob alone returns Latin-1.
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder().decode(bytes));
    return { id: payload.sub, name: payload.name, roles: payload.roles ?? [] };
  } catch {
    return null;
  }
}
