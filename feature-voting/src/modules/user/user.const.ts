/** User columns safe to load and return alongside other records. */
export const USER_FIELDS = ['id', 'name', 'username'] as const;

/** Seeded role names. */
export const ROLE = {
  USER: 'user',
  ADMIN: 'admin',
} as const;
export type RoleName = (typeof ROLE)[keyof typeof ROLE];
