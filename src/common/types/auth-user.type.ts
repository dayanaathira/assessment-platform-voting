/** The signed-in user, as set on the request by JwtAuthGuard. */
export interface AuthUser {
  id: string;
  name: string;
  roles: string[];
}

/** Access token claims. */
export interface AccessTokenPayload {
  sub: string;
  name: string;
  roles: string[];
}

/** Refresh token claims; roles are reloaded from the database on refresh. */
export interface RefreshTokenPayload {
  sub: string;
  // Id of the refresh_token row; absent on tokens issued before rotation.
  jti?: string;
}
