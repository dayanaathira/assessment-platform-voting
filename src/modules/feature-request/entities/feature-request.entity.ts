import { randomUUID } from 'node:crypto';
import { defineEntity, p } from '@mikro-orm/core';
import { User } from '../../user/entities/user.entity';
import { Status } from './status.entity';
import { Comment } from './comments.entity';
import { Vote } from './votes.entity';

const FeatureRequestSchema = defineEntity({
  name: 'FeatureRequest',
  tableName: 'feature_request',
  indexes: [
    { columns: [{ name: 'vote_count', sort: 'DESC' }] },
    { columns: [{ name: 'created_at', sort: 'DESC' }] },
  ],
  properties: () => ({
    id: p
      .uuid()
      .primary()
      .onCreate(() => randomUUID()),
    title: p.string().length(255),
    description: p.string().type('text'),
    status: () => p.manyToOne(Status).index(),
    createdBy: () => p.manyToOne(User).fieldName('created_by'),
    officialResponse: p.string().type('text').nullable(),
    officialResponseAt: p.datetime().nullable(),
    officialResponseBy: () =>
      p.manyToOne(User).fieldName('official_response_by').nullable(),
    // Denormalised totals, kept in step with `votes` and `comments`.
    voteCount: p.integer().default(0).check('vote_count >= 0'),
    commentCount: p.integer().default(0).check('comment_count >= 0'),
    createdAt: p
      .datetime()
      .defaultRaw('now()')
      .onCreate(() => new Date()),
    updatedAt: p
      .datetime()
      .defaultRaw('now()')
      .onCreate(() => new Date())
      .onUpdate(() => new Date()),
    comments: () => p.oneToMany(Comment).mappedBy('featureRequest'),
    votes: () => p.oneToMany(Vote).mappedBy('featureRequest'),
  }),
});

export class FeatureRequest extends FeatureRequestSchema.class {}
FeatureRequestSchema.setClass(FeatureRequest);
