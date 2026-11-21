import { randomUUID } from 'node:crypto';
import { defineEntity, p } from '@mikro-orm/core';
import { User } from '../../user/entities/user.entity';
import { FeatureRequest } from './feature-request.entity';

/** A request merged into another, with how many votes and comments moved. */
const RequestMergeSchema = defineEntity({
  name: 'RequestMerge',
  tableName: 'request_merge',
  checks: [
    {
      name: 'request_merge_source_not_target',
      expression: 'source_request_id <> target_request_id',
    },
  ],
  properties: () => ({
    id: p
      .uuid()
      .primary()
      .onCreate(() => randomUUID()),
    // Unique: a request can only be merged once.
    sourceRequest: () => p.manyToOne(FeatureRequest).unique(),
    targetRequest: () => p.manyToOne(FeatureRequest).index(),
    createdBy: () => p.manyToOne(User).fieldName('created_by'),
    votesMoved: p.integer(),
    commentsMoved: p.integer(),
    createdAt: p
      .datetime()
      .defaultRaw('now()')
      .onCreate(() => new Date()),
  }),
});

export class RequestMerge extends RequestMergeSchema.class {}
RequestMergeSchema.setClass(RequestMerge);
