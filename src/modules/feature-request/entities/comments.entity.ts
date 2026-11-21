import { randomUUID } from 'node:crypto';
import { defineEntity, p } from '@mikro-orm/core';
import { User } from '../../user/entities/user.entity';
import { FeatureRequest } from './feature-request.entity';

const CommentSchema = defineEntity({
  name: 'Comment',
  tableName: 'comment',
  indexes: [{ properties: ['featureRequest', 'createdAt'] }],
  properties: () => ({
    id: p
      .uuid()
      .primary()
      .onCreate(() => randomUUID()),
    user: () => p.manyToOne(User),
    featureRequest: () => p.manyToOne(FeatureRequest).inversedBy('comments'),
    body: p.string().type('text'),
    createdAt: p
      .datetime()
      .defaultRaw('now()')
      .onCreate(() => new Date()),
    updatedAt: p
      .datetime()
      .defaultRaw('now()')
      .onCreate(() => new Date())
      .onUpdate(() => new Date()),
  }),
});

export class Comment extends CommentSchema.class {}
CommentSchema.setClass(Comment);
