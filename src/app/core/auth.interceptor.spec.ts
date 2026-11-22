import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';

const URL = '/feature-voting/v1/feature-request';
const UNAUTHORIZED = { status: 401, statusText: 'Unauthorized' };

describe('authInterceptor', () => {
  let auth: {
    getAccessToken: ReturnType<typeof vi.fn>;
    refresh: ReturnType<typeof vi.fn>;
    logout: ReturnType<typeof vi.fn>;
  };
  let http: HttpClient;
  let backend: HttpTestingController;

  beforeEach(() => {
    auth = {
      getAccessToken: vi.fn(() => 'old-token'),
      refresh: vi.fn(() => of('new-token')),
      logout: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('adds the Bearer token', () => {
    http.get(URL).subscribe();

    expect(backend.expectOne(URL).request.headers.get('Authorization')).toBe('Bearer old-token');
  });

  it.each(['login', 'refresh', 'logout'])('leaves /auth/%s alone', (path) => {
    const url = `/feature-voting/v1/auth/${path}`;
    http.post(url, {}).subscribe({ error: () => {} });

    const req = backend.expectOne(url);
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush(null, UNAUTHORIZED);
    expect(auth.refresh).not.toHaveBeenCalled();
  });

  it('refreshes once on a 401 and retries with the new token', () => {
    let body: unknown;
    http.get(URL).subscribe((res) => (body = res));

    backend.expectOne(URL).flush(null, UNAUTHORIZED);
    const retry = backend.expectOne(URL);
    expect(retry.request.headers.get('Authorization')).toBe('Bearer new-token');
    retry.flush({ ok: true });

    expect(auth.refresh).toHaveBeenCalledTimes(1);
    expect(body).toEqual({ ok: true });
  });

  it('passes a second 401 on instead of refreshing again', () => {
    let status = 0;
    http.get(URL).subscribe({ error: (err) => (status = err.status) });

    backend.expectOne(URL).flush(null, UNAUTHORIZED);
    backend.expectOne(URL).flush(null, UNAUTHORIZED);

    expect(auth.refresh).toHaveBeenCalledTimes(1);
    expect(status).toBe(401);
  });

  it('logs out as expired when the refresh fails', () => {
    auth.refresh.mockReturnValue(throwError(() => new Error('refresh failed')));
    let failed = false;
    http.get(URL).subscribe({ error: () => (failed = true) });

    backend.expectOne(URL).flush(null, UNAUTHORIZED);

    expect(auth.logout).toHaveBeenCalledWith(true);
    expect(failed).toBe(true);
  });

  it('does not refresh on other errors', () => {
    http.get(URL).subscribe({ error: () => {} });

    backend.expectOne(URL).flush(null, { status: 409, statusText: 'Conflict' });

    expect(auth.refresh).not.toHaveBeenCalled();
  });
});
