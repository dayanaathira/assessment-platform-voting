import { randomUUID } from 'node:crypto';
import { defineEntity, p } from '@mikro-orm/core';
import { User } from './user.entity';
import { Role } from './role.entity';

const UserRoleSchema = defineEntity({
  name: 'UserRole',
  tableName: 'user_roles',
  uniques: [{ properties: ['user', 'role'] }],
  properties: () => ({
    id: p
      .uuid()
      .primary()
      .onCreate(() => randomUUID()),
    user: () => p.manyToOne(User).inversedBy('userRoles'),
    role: () => p.manyToOne(Role).fieldName('roles_id'),
  }),
});

export class UserRole extends UserRoleSchema.class {}
UserRoleSchema.setClass(UserRole);
