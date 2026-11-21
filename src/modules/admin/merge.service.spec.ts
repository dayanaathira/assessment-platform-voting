import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { User } from '../user/entities/user.entity';
import { Comment } from '../feature-request/entities/comment.entity';
import { FeatureRequest } from '../feature-request/entities/feature-request.entity';
import { RequestMerge } from '../feature-request/entities/request-merge.entity';
import { Vote } from '../feature-request/entities/votes.entity';
import { MergeService } from './merge.service';

const ADMIN_ID = 'admin';
const SOURCE = 'b-source';
const TARGET = 'a-target';

/**
 * An EntityManager double for one merge.
 *
 * @param state - What each query returns.
 * @returns The service, the double, and the two locked requests.
 */
function setup(
  state: {
    locked?: string[];
    existingMerges?: { sourceRequest: { id: string } }[];
    voters?: string[];
    inserted?: number;
    commentsMoved?: number;
    targetVotes?: number;
    targetComments?: number;
  } = {},
) {
  const source = { id: SOURCE, voteCount: 2, commentCount: 1 };
  const target = { id: TARGET, voteCount: 3, commentCount: 4 };
  const rows: Record<string, typeof source> = {
    [SOURCE]: source,
    [TARGET]: target,
  };

  const qb = {
    insert: jest.fn().mockReturnThis(),
    onConflict: jest.fn().mockReturnThis(),
    ignore: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ affectedRows: state.inserted ?? 0 }),
  };
  const em: Record<string, jest.Mock> = {
    find: jest.fn((entity: unknown) => {
      if (entity === FeatureRequest) {
        return Promise.resolve(
          (state.locked ?? [SOURCE, TARGET]).map((id) => rows[id]),
        );
      }
      if (entity === RequestMerge) {
        return Promise.resolve(state.existingMerges ?? []);
      }
      if (entity === Vote) {
        return Promise.resolve(
          (state.voters ?? []).map((id) => ({ user: { id } })),
        );
      }
      return Promise.resolve([]);
    }),
    findOne: jest.fn((entity: unknown) =>
      Promise.resolve(
        entity === User
          ? { id: ADMIN_ID, name: 'Admin', username: 'admin' }
          : null,
      ),
    ),
    count: jest.fn((entity: unknown) =>
      Promise.resolve(
        entity === Vote
          ? (state.targetVotes ?? 0)
          : (state.targetComments ?? 0),
      ),
    ),
    createQueryBuilder: jest.fn().mockReturnValue(qb),
    nativeDelete: jest.fn().mockResolvedValue(0),
    nativeUpdate: jest.fn().mockResolvedValue(state.commentsMoved ?? 0),
    getReference: jest.fn(() => ({ id: ADMIN_ID })),
    create: jest.fn((_entity: unknown, data: Record<string, unknown>) => ({
      id: 'm1',
      createdAt: new Date('2026-11-22T00:00:00Z'),
      ...data,
    })),
    flush: jest.fn().mockResolvedValue(undefined),
  };
  // Runs the callback with the same double, as the real one does with a fork.
  em.transactional = jest.fn((callback: (em: unknown) => unknown) =>
    callback(em),
  );

  return {
    service: new MergeService(em as unknown as EntityManager),
    em,
    qb,
    source,
    target,
  };
}

describe('MergeService', () => {
  it('rejects merging a request into itself before touching the database', async () => {
    const { service, em } = setup();

    await expect(
      service.merge(ADMIN_ID, SOURCE, { targetId: SOURCE }),
    ).rejects.toThrow(BadRequestException);
    expect(em.transactional).not.toHaveBeenCalled();
  });

  it.each([
    ['the source', [TARGET]],
    ['the target', [SOURCE]],
  ])('returns 404 when %s is missing or deleted', async (_label, locked) => {
    const { service } = setup({ locked });

    await expect(
      service.merge(ADMIN_ID, SOURCE, { targetId: TARGET }),
    ).rejects.toThrow(NotFoundException);
  });

  it('locks both requests in id order', async () => {
    const { service, em } = setup();

    await service.merge(ADMIN_ID, SOURCE, { targetId: TARGET });

    expect(em.find).toHaveBeenCalledWith(
      FeatureRequest,
      { id: { $in: [SOURCE, TARGET] } },
      expect.objectContaining({ orderBy: { id: 'asc' } }),
    );
  });

  it.each([
    [
      'the source was already merged',
      SOURCE,
      'This request has already been merged',
    ],
    [
      'the target was merged away',
      TARGET,
      'Cannot merge into a request that has been merged',
    ],
    [
      'the source holds merged requests',
      'c-other',
      'Cannot merge a request that other requests were merged into',
    ],
  ])('rejects the merge when %s', async (_label, mergedSource, message) => {
    const { service, em } = setup({
      existingMerges: [{ sourceRequest: { id: mergedSource } }],
    });

    await expect(
      service.merge(ADMIN_ID, SOURCE, { targetId: TARGET }),
    ).rejects.toThrow(new ConflictException(message));
    expect(em.createQueryBuilder).not.toHaveBeenCalled();
    expect(em.flush).not.toHaveBeenCalled();
  });

  // Ali voted on both, Dina only on the source: one vote moves, and the
  // target is recounted from the table rather than added to.
  it('moves votes counting overlapping voters once, and recounts both requests', async () => {
    const { service, em, qb, source, target } = setup({
      voters: ['ali', 'dina'],
      inserted: 1,
      commentsMoved: 2,
      targetVotes: 4,
      targetComments: 6,
    });

    const result = await service.merge(ADMIN_ID, SOURCE, { targetId: TARGET });

    expect(qb.insert).toHaveBeenCalledWith([
      { user: 'ali', featureRequest: TARGET },
      { user: 'dina', featureRequest: TARGET },
    ]);
    expect(qb.onConflict).toHaveBeenCalledWith(['user', 'featureRequest']);
    expect(em.nativeDelete).toHaveBeenCalledWith(
      Vote,
      { featureRequest: SOURCE },
      { filters: false },
    );
    expect(em.nativeUpdate).toHaveBeenCalledWith(
      Comment,
      { featureRequest: SOURCE },
      { featureRequest: TARGET },
      { filters: false },
    );
    expect(target).toMatchObject({ voteCount: 4, commentCount: 6 });
    expect(source).toMatchObject({ voteCount: 0, commentCount: 0 });
    expect(result).toMatchObject({
      sourceRequestId: SOURCE,
      targetRequestId: TARGET,
      votesMoved: 1,
      commentsMoved: 2,
      createdBy: { id: ADMIN_ID, name: 'Admin', username: 'admin' },
    });
    expect(em.flush).toHaveBeenCalledTimes(1);
  });

  it('skips the vote copy when the source has no votes', async () => {
    const { service, em } = setup({ voters: [] });

    const result = await service.merge(ADMIN_ID, SOURCE, { targetId: TARGET });

    expect(em.createQueryBuilder).not.toHaveBeenCalled();
    expect(result.votesMoved).toBe(0);
  });
});
