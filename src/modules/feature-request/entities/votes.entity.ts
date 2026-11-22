import { defineEntity, p } from '@mikro-orm/core';
import { User } from '../../user/entities/user.entity';
import { FeatureRequest } from './feature-request.entity';

/** One vote per user per request, enforced by the composite primary key. */
const VoteSchema = defineEntity({
  name: 'Vote',
  tableName: 'votes',
  // The primary key leads with user_id; merges and counts look up by request.
  indexes: [{ properties: ['featureRequest'] }],
  properties: () => ({
    user: () => p.manyToOne(User).primary(),
    featureRequest: () =>
      p.manyToOne(FeatureRequest).inversedBy('votes').primary(),
    createdAt: p
      .datetime()
      .defaultRaw('now()')
      .onCreate(() => new Date()),
  }),
});

export class Vote extends VoteSchema.class {}
VoteSchema.setClass(Vote);
