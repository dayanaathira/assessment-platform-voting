/**
 * The single source of this service's identity.
 *
 * These are constants, not environment variables, so a route cannot
 * accidentally differ between environments — an endpoint that is
 * `/feature-voting/v1/things` in staging is the same in production.
 */

/** Used in logs, Swagger, and the migration history table name. */
export const SERVICE_NAME = 'feature-voting';

/**
 * Global route prefix. URI versioning appends the version, so routes are
 * served at `/<API_PREFIX>/v<n>/...`.
 */
export const API_PREFIX = SERVICE_NAME;

/** Swagger UI path. Registered outside the global prefix, so it is absolute. */
export const SWAGGER_PATH = `${SERVICE_NAME}/api-docs`;

/**
 * Port used when PORT is not set. Give each service its own so several can
 * run on one host at once.
 */
export const DEFAULT_PORT = 3000;
