import { isSwaggerEnabled, validateEnv } from './env.validation';

const validEnv = {
  POSTGRES_HOST: '127.0.0.1',
  POSTGRES_PORT: '5433',
  POSTGRES_NAME: 'app_db',
  POSTGRES_USER: 'postgres',
  POSTGRES_PASS: 'postgres',
  CORS_ORIGINS: 'http://localhost:4200',
};

describe('validateEnv', () => {
  it('accepts a minimal valid environment and applies defaults', () => {
    const env = validateEnv({ ...validEnv });

    expect(env.NODE_ENV).toBe('development');
    expect(env.POSTGRES_SCHEMA).toBe('public');
    expect(env.POSTGRES_PORT).toBe(5433);
  });

  it('coerces numeric values instead of leaving them as strings', () => {
    const env = validateEnv({ ...validEnv, PORT: '8080' });

    expect(env.PORT).toBe(8080);
  });

  // `parseInt(process.env.POSTGRES_PORT!)` used to yield NaN here, and the
  // service then failed to connect for reasons that looked unrelated.
  it('rejects a non-numeric database port', () => {
    expect(() =>
      validateEnv({ ...validEnv, POSTGRES_PORT: 'five-thousand' }),
    ).toThrow(/POSTGRES_PORT/);
  });

  it('rejects a missing required value', () => {
    const { POSTGRES_HOST: _omitted, ...withoutHost } = validEnv;

    expect(() => validateEnv(withoutHost)).toThrow(/POSTGRES_HOST/);
  });

  it('rejects an empty required value', () => {
    expect(() => validateEnv({ ...validEnv, POSTGRES_NAME: '' })).toThrow(
      /POSTGRES_NAME/,
    );
  });

  it('reports every problem at once, not just the first', () => {
    expect(() =>
      validateEnv({ ...validEnv, POSTGRES_HOST: '', POSTGRES_USER: '' }),
    ).toThrow(/POSTGRES_HOST[\s\S]*POSTGRES_USER/);
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(() => validateEnv({ ...validEnv, NODE_ENV: 'prod' })).toThrow(
      /NODE_ENV/,
    );
  });

  it('rejects a malformed migration lock timeout', () => {
    expect(() =>
      validateEnv({ ...validEnv, DB_MIGRATION_LOCK_TIMEOUT_MS: '0' }),
    ).toThrow(/DB_MIGRATION_LOCK_TIMEOUT_MS/);
  });

  it('accepts a configured structured log level', () => {
    const env = validateEnv({ ...validEnv, LOG_LEVEL: 'debug' });

    expect(env.LOG_LEVEL).toBe('debug');
  });

  it('rejects an unknown structured log level', () => {
    expect(() => validateEnv({ ...validEnv, LOG_LEVEL: 'trace' })).toThrow(
      /LOG_LEVEL/,
    );
  });

  describe('TRUST_PROXY_HOPS', () => {
    // The hop count decides what req.ip is, and therefore which address the
    // access log records. A boolean here would be read as `trust proxy: true`,
    // which takes the caller-supplied leftmost X-Forwarded-For entry and lets
    // any client write whatever address it likes into the log.
    it('accepts a proxy hop count', () => {
      expect(
        validateEnv({ ...validEnv, TRUST_PROXY_HOPS: '1' }).TRUST_PROXY_HOPS,
      ).toBe(1);
      expect(
        validateEnv({ ...validEnv, TRUST_PROXY_HOPS: '0' }).TRUST_PROXY_HOPS,
      ).toBe(0);
    });

    it('refuses a boolean or negative proxy hop count', () => {
      expect(() =>
        validateEnv({ ...validEnv, TRUST_PROXY_HOPS: 'true' }),
      ).toThrow(/TRUST_PROXY_HOPS/);
      expect(() =>
        validateEnv({ ...validEnv, TRUST_PROXY_HOPS: '-1' }),
      ).toThrow(/TRUST_PROXY_HOPS/);
    });
  });

  describe('CORS_ORIGINS', () => {
    it('parses a comma-separated list into trimmed origins', () => {
      const env = validateEnv({
        ...validEnv,
        CORS_ORIGINS: 'https://app.example.com, https://admin.example.com',
      });

      expect(env.CORS_ORIGINS).toEqual([
        'https://app.example.com',
        'https://admin.example.com',
      ]);
    });

    // The failure this prevents: an earlier draft fell back to
    // http://localhost:4200 outside production, so staging silently accepted a
    // localhost origin and nothing said so.
    it('refuses to boot when unset, rather than falling back', () => {
      const { CORS_ORIGINS: _omitted, ...withoutCors } = validEnv;

      expect(() => validateEnv(withoutCors)).toThrow(/CORS_ORIGINS/);
    });

    it('refuses an empty or comma-only value', () => {
      expect(() => validateEnv({ ...validEnv, CORS_ORIGINS: '' })).toThrow(
        /CORS_ORIGINS/,
      );
      expect(() => validateEnv({ ...validEnv, CORS_ORIGINS: ' , ' })).toThrow(
        /CORS_ORIGINS/,
      );
    });
  });
});

describe('isSwaggerEnabled', () => {
  it('is off in production by default', () => {
    const env = validateEnv({ ...validEnv, NODE_ENV: 'production' });

    expect(isSwaggerEnabled(env)).toBe(false);
  });

  it('can be explicitly turned on in production', () => {
    const env = validateEnv({
      ...validEnv,
      NODE_ENV: 'production',
      SWAGGER_ENABLED: 'true',
    });

    expect(isSwaggerEnabled(env)).toBe(true);
  });

  it('is on outside production by default', () => {
    expect(isSwaggerEnabled(validateEnv({ ...validEnv }))).toBe(true);
  });

  it('can be explicitly turned off outside production', () => {
    const env = validateEnv({ ...validEnv, SWAGGER_ENABLED: 'false' });

    expect(isSwaggerEnabled(env)).toBe(false);
  });
});
