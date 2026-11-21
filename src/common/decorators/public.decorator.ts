import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Lets a route or controller through JwtAuthGuard without a token.
 *
 * @returns The metadata decorator.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
