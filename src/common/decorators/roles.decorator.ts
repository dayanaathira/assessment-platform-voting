import { SetMetadata } from '@nestjs/common';
import type { RoleName } from '../../modules/user/user.const';

export const ROLES_KEY = 'roles';

/**
 * Restricts a route or controller to users holding any of the given roles.
 *
 * @param roles - Roles allowed through.
 * @returns The metadata decorator.
 */
export const Roles = (...roles: RoleName[]) => SetMetadata(ROLES_KEY, roles);
