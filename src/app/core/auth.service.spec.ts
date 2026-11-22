import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthService } from './auth.service';

const REFRESH_URL = '/feature-voting/v1/auth/refresh';
const LOGOUT_URL = '/feature-voting/v1/auth/logout';
const UNAUTHORIZED = { status: 401, statusText: 'Unauthorized' };

describe('AuthService', () => {
  let service: AuthService;
  let backend: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('fv.accessToken', 'access-1');
    localStorage.setItem('fv.refreshToken', 'refresh-1');
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    backend = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });

  afterEach(() => backend.verify());

  it('sends one refresh for concurrent callers and stores the new pair', () => {
    const results: string[] = [];
    service.refresh().subscribe((t) => results.push(t));
    service.refresh().subscribe((t) => results.push(t));

    const req = backend.expectOne(REFRESH_URL);
    expect(req.request.body).toEqual({ refreshToken: 'refresh-1' });
    req.flush({ data: { accessToken: 'access-2', refreshToken: 'refresh-2' } });

    expect(results).toEqual(['access-2', 'access-2']);
    expect(localStorage.getItem('fv.refreshToken')).toBe('refresh-2');
    expect(service.getAccessToken()).toBe('access-2');
  });

  it('uses the pair another tab stored when its own refresh token was already rotated', () => {
    let token = '';
    service.refresh().subscribe((t) => (token = t));

    // Another tab refreshed first and wrote the new pair.
    localStorage.setItem('fv.accessToken', 'access-from-tab');
    localStorage.setItem('fv.refreshToken', 'refresh-from-tab');
    backend.expectOne(REFRESH_URL).flush(null, UNAUTHORIZED);

    expect(token).toBe('access-from-tab');
    expect(service.getAccessToken()).toBe('access-from-tab');
  });

  it('fails the refresh when no other tab has a newer token', () => {
    let failed = false;
    service.refresh().subscribe({ error: () => (failed = true) });

    backend.expectOne(REFRESH_URL).flush(null, UNAUTHORIZED);

    expect(failed).toBe(true);
  });

  it('revokes the refresh token on a normal logout', () => {
    service.logout();

    expect(backend.expectOne(LOGOUT_URL).request.body).toEqual({ refreshToken: 'refresh-1' });
    expect(localStorage.getItem('fv.accessToken')).toBeNull();
    expect(localStorage.getItem('fv.refreshToken')).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: {} });
  });

  it('skips the revoke call and keeps the return path when the session expired', () => {
    service.logout(true);

    backend.expectNone(LOGOUT_URL);
    expect(navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/', expired: 1 },
    });
  });
});
