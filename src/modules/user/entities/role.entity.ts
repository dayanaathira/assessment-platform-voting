import { randomUUID } from 'node:crypto';
import { defineEntity, p } from '@mikro-orm/core';

const RoleSchema = defineEntity({
  name: 'Role',
  tableName: 'roles',
  properties: {
    id: p
      .uuid()
      .primary()
      .onCreate(() => randomUUID()),
    // 'user' | 'admin'
    name: p.string().length(50).unique(),
  },
});

export class Role extends RoleSchema.class {}
RoleSchema.setClass(Role);
