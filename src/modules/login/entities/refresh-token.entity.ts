import { defineEntity, p } from '@mikro-orm/core';
import { User } from '../../user/entities/user.entity';

/**
 * One row per issued refresh token, keyed by the JWT's `jti`. The token itself
 * isn't stored: a jti is useless without a token signed by JWT_REFRESH_SECRET.
 */
const RefreshTokenSchema = defineEntity({
  name: 'RefreshToken',
  tableName: 'refresh_token',
  indexes: [{ properties: ['user'] }],
  properties: () => ({
    id: p.uuid().primary(),
    user: () => p.manyToOne(User).deleteRule('cascade'),
    expiresAt: p.datetime(),
    // Set when the token is rotated or logged out; a revoked token can't refresh.
    revokedAt: p.datetime().nullable(),
    createdAt: p
      .datetime()
      .defaultRaw('now()')
      .onCreate(() => new Date()),
  }),
});

export class RefreshToken extends RefreshTokenSchema.class {}
RefreshTokenSchema.setClass(RefreshToken);
