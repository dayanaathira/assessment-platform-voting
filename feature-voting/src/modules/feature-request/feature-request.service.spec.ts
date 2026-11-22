import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { STATUS_ID } from '../../common/const/status.const';
import { FeatureRequestService } from './feature-request.service';

const USER_ID = 'u1';
const REQUEST_ID = 'f1';

/**
 * @param overrides - Fields to change on the request.
 * @returns A request authored by USER_ID, Under Review, with 3 votes.
 */
function aRequest(overrides: Record<string, unknown> = {}) {
  return {
    id: REQUEST_ID,
    createdBy: { id: USER_ID },
    status: { id: STATUS_ID.UNDER_REVIEW },
    voteCount: 3,
    ...overrides,
  };
}

/**
 * An EntityManager double.
 *
 * @param state - What the queries return.
 * @returns The double and its spies.
 */
function entityManager(state: {
  feature?: ReturnType<typeof aRequest> | null;
  merges?: number;
  affectedRows?: number;
  deleted?: number;
}) {
  const execute = jest
    .fn()
    .mockResolvedValue({ affectedRows: state.affectedRows ?? 1 });
  const qb = {
    insert: jest.fn().mockReturnThis(),
    onConflict: jest.fn().mockReturnThis(),
    ignore: jest.fn().mockReturnThis(),
    execute,
  };
  const em: Record<string, jest.Mock> = {
    findOne: jest.fn().mockResolvedValue(state.feature ?? null),
    count: jest.fn().mockResolvedValue(state.merges ?? 0),
    createQueryBuilder: jest.fn().mockReturnValue(qb),
    nativeDelete: jest.fn().mockResolvedValue(state.deleted ?? 0),
    flush: jest.fn().mockResolvedValue(undefined),
    getReference: jest.fn(),
  };
  // Runs the callback with the same double, as the real one does with a fork.
  em.transactional = jest.fn((callback: (em: unknown) => unknown) =>
    callback(em),
  );
  return {
    em,
    qb,
    service: new FeatureRequestService(em as unknown as EntityManager),
  };
}

describe('FeatureRequestService', () => {
  describe('vote', () => {
    it('adds the vote and increments the count', async () => {
      const feature = aRequest();
      const { service, em, qb } = entityManager({ feature, affectedRows: 1 });

      await expect(service.vote(USER_ID, REQUEST_ID)).resolves.toEqual({
        voteCount: 4,
        hasVoted: true,
      });
      expect(qb.onConflict).toHaveBeenCalledWith(['user', 'featureRequest']);
      expect(em.flush).toHaveBeenCalledTimes(1);
    });

    // The insert result decides, so a repeat (or a concurrent duplicate) never
    // touches the count.
    it('rejects a repeat vote without changing the count', async () => {
      const feature = aRequest();
      const { service, em } = entityManager({ feature, affectedRows: 0 });

      await expect(service.vote(USER_ID, REQUEST_ID)).rejects.toThrow(
        new ConflictException('You have already voted for this request'),
      );
      expect(feature.voteCount).toBe(3);
      expect(em.flush).not.toHaveBeenCalled();
    });

    it('locks the request row before voting', async () => {
      const { service, em } = entityManager({ feature: aRequest() });

      await service.vote(USER_ID, REQUEST_ID);

      expect(em.findOne).toHaveBeenCalledWith(
        expect.anything(),
        { id: REQUEST_ID },
        { lockMode: expect.anything() },
      );
    });

    it.each([
      ['Released', STATUS_ID.RELEASED],
      ['Declined', STATUS_ID.DECLINED],
    ])('rejects voting on a %s request', async (_label, statusId) => {
      const { service, em } = entityManager({
        feature: aRequest({ status: { id: statusId } }),
      });

      await expect(service.vote(USER_ID, REQUEST_ID)).rejects.toThrow(
        ConflictException,
      );
      expect(em.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('rejects voting on a merged request', async () => {
      const { service, em } = entityManager({
        feature: aRequest(),
        merges: 1,
      });

      await expect(service.vote(USER_ID, REQUEST_ID)).rejects.toThrow(
        new ConflictException('Merged requests cannot be voted on'),
      );
      expect(em.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('returns 404 for a missing or deleted request', async () => {
      const { service } = entityManager({ feature: null });

      await expect(service.vote(USER_ID, REQUEST_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('unvote', () => {
    it('removes the vote and decrements the count', async () => {
      const feature = aRequest();
      const { service } = entityManager({ feature, deleted: 1 });

      await expect(service.unvote(USER_ID, REQUEST_ID)).resolves.toEqual({
        voteCount: 2,
        hasVoted: false,
      });
    });

    it('leaves the count unchanged when the user had not voted', async () => {
      const feature = aRequest();
      const { service, em } = entityManager({ feature, deleted: 0 });

      await expect(service.unvote(USER_ID, REQUEST_ID)).resolves.toEqual({
        voteCount: 3,
        hasVoted: false,
      });
      expect(em.flush).not.toHaveBeenCalled();
    });

    it('rejects removing a vote once the request is Released', async () => {
      const { service, em } = entityManager({
        feature: aRequest({ status: { id: STATUS_ID.RELEASED } }),
        deleted: 1,
      });

      await expect(service.unvote(USER_ID, REQUEST_ID)).rejects.toThrow(
        ConflictException,
      );
      expect(em.nativeDelete).not.toHaveBeenCalled();
    });
  });

  describe.each([
    ['edit', (s: FeatureRequestService) => s.edit(USER_ID, REQUEST_ID, {})],
    ['delete', (s: FeatureRequestService) => s.delete(USER_ID, REQUEST_ID)],
  ])('%s', (_name, act) => {
    it('returns 404 for a missing or deleted request', async () => {
      const { service } = entityManager({ feature: null });

      await expect(act(service)).rejects.toThrow(NotFoundException);
    });

    it("rejects changing another user's request", async () => {
      const { service, em } = entityManager({
        feature: aRequest({ createdBy: { id: 'someone-else' } }),
      });

      await expect(act(service)).rejects.toThrow(ForbiddenException);
      expect(em.flush).not.toHaveBeenCalled();
    });

    it('rejects changing a merged request', async () => {
      const { service, em } = entityManager({
        feature: aRequest(),
        merges: 1,
      });

      await expect(act(service)).rejects.toThrow(ConflictException);
      expect(em.flush).not.toHaveBeenCalled();
    });
  });
});
