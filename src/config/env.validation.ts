import { z } from 'zod';

const port = z.coerce.number().int().min(1).max(65535);
const positiveInt = z.coerce.number().int().positive();

// A jsonwebtoken duration such as 15m, 12h or 7d.
const duration = z
  .string()
  .regex(/^\d+[smhd]$/, 'must be a duration like 15m, 12h or 7d');

const booleanish = z
  .enum(['true', 'false', '1', '0', 'yes', 'no', 'on', 'off'])
  .transform((value) => ['true', '1', 'yes', 'on'].includes(value));

/**
 * The environment this service genuinely requires.
 *
 * Deliberately not every conceivable setting — only the values whose absence
 * or malformation would otherwise surface as a confusing runtime failure.
 * `parseInt(process.env.POSTGRES_PORT!)` happily yields NaN, and the service
 * then fails to connect for reasons that look nothing like "the port is
 * missing".
 */
export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: port.optional(),

    POSTGRES_HOST: z.string().min(1),
    POSTGRES_PORT: port,
    POSTGRES_NAME: z.string().min(1),
    POSTGRES_USER: z.string().min(1),
    POSTGRES_PASS: z.string().min(1),
    POSTGRES_SCHEMA: z.string().min(1).default('public'),

    // Explicit allowlist of browser origins, comma-separated. Not '*', and not
    // `origin: true` — that reflects whatever origin asked, which is "any
    // origin" wearing an allowlist's clothes. There is deliberately no fallback
    // value: a default of http://localhost:4200 means staging silently accepts
    // a localhost origin and nobody finds out.
    //
    // An internal service or worker that no browser calls should delete this
    // field and the enableCors() call in main.ts, rather than configuring CORS
    // decoratively.
    CORS_ORIGINS: z
      .string()
      .transform((value) =>
        value
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean),
      )
      .refine((origins) => origins.length > 0, {
        message:
          'CORS_ORIGINS must list at least one origin for a browser-facing service',
      }),

    LOG_LEVEL: z
      .enum(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'])
      .optional(),

    DB_MIGRATION_LOCK_NAME: z.string().min(1).optional(),
    DB_MIGRATION_LOCK_TIMEOUT_MS: positiveInt.optional(),
    DB_MIGRATION_LOCK_POLL_MS: positiveInt.optional(),

    // Swagger is off in production unless this explicitly turns it on.
    SWAGGER_ENABLED: booleanish.optional(),

    // How many reverse proxies sit between the internet and this process.
    //
    // Unset means Express trusts nothing, so req.ip is the socket peer. Behind
    // nginx that is nginx, and every client appears in the access log as the
    // same address.
    //
    // A hop COUNT is the safe way to fix that. `trust proxy: true` is not: it
    // makes req.ip the leftmost X-Forwarded-For entry, which the caller writes,
    // so any client can put whatever address it likes in your logs. That is why
    // this is a number and there is no boolean form.
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).optional(),

    // Separate secrets, so a refresh token can't pass as an access token.
    JWT_SECRET: z.string().min(32),
    JWT_EXPIRES_IN: duration.default('15m'),
    JWT_REFRESH_SECRET: z.string().min(32),
    JWT_REFRESH_EXPIRES_IN: duration.default('7d'),

    // Only `npm run seed` reads these; the seeder fails if they're missing.
    SEED_ADMIN_PASSWORD: z.string().min(8).optional(),
    SEED_USER_PASSWORD: z.string().min(8).optional(),
  })
  .refine((env) => env.JWT_SECRET !== env.JWT_REFRESH_SECRET, {
    message: 'must differ from JWT_SECRET',
    path: ['JWT_REFRESH_SECRET'],
  });

export type ValidatedEnv = z.infer<typeof envSchema>;

/**
 * Validates the environment, or throws with every problem listed at once.
 *
 * Call this before anything opens a connection, so a misconfigured service
 * fails immediately and says why, rather than half-starting and failing
 * somewhere less obvious.
 */
export function validateEnv(
  env: NodeJS.ProcessEnv = process.env,
): ValidatedEnv {
  return parseOrThrow(envSchema, env);
}

/** Turns a Zod failure into one message listing every problem at once. */
function parseOrThrow<Schema extends z.ZodType>(
  schema: Schema,
  env: NodeJS.ProcessEnv,
): z.infer<Schema> {
  const result = schema.safeParse(env);

  if (result.success) {
    return result.data;
  }

  const problems = result.error.issues
    .map((issue) => `  ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');

  throw new Error(
    `Invalid environment configuration:\n${problems}\n\n` +
      'See .env.example for the expected values.',
  );
}

/** Whether Swagger UI should be mounted, given the validated environment. */
export function isSwaggerEnabled(env: ValidatedEnv): boolean {
  return env.SWAGGER_ENABLED ?? env.NODE_ENV !== 'production';
}
