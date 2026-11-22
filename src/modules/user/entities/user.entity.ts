import { randomUUID } from 'node:crypto';
import { defineEntity, p } from '@mikro-orm/core';
import { UserRole } from './user-role.entity';

const UserSchema = defineEntity({
  name: 'User',
  tableName: 'user',
  properties: () => ({
    id: p
      .uuid()
      .primary()
      .onCreate(() => randomUUID()),
    name: p.string().length(255),
    username: p.string().length(100).unique(),
    passwordHash: p.string().hidden(),
    createdAt: p
      .datetime()
      .defaultRaw('now()')
      .onCreate(() => new Date()),
    updatedAt: p
      .datetime()
      .defaultRaw('now()')
      .onCreate(() => new Date())
      .onUpdate(() => new Date()),
    userRoles: () => p.oneToMany(UserRole).mappedBy('user'),
  }),
});

export class User extends UserSchema.class {}
UserSchema.setClass(User);
