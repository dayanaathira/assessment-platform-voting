import { ConflictException, NotFoundException } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { FeatureRequestService } from '../feature-request/feature-request.service';
import { AdminService } from './admin.service';

/**
 * @param feature - What the request lookup returns.
 * @param merges - How many merges have this request as the source.
 * @returns The service and the EntityManager double.
 */
function setup(feature: object | null, merges = 0) {
  const em = {
    findOne: jest.fn().mockResolvedValue(feature),
    count: jest.fn().mockResolvedValue(merges),
    flush: jest.fn().mockResolvedValue(undefined),
    getReference: jest.fn(),
  };
  const service = new AdminService(
    em as unknown as EntityManager,
    {} as FeatureRequestService,
  );
  return { service, em };
}

describe('AdminService', () => {
  describe.each([
    [
      'updateStatus',
      (s: AdminService) => s.updateStatus('admin', 'f1', { statusId: 2 }),
    ],
    [
      'setResponse',
      (s: AdminService) =>
        s.setResponse('admin', 'f1', { response: 'Planned for Q1.' }),
    ],
  ])('%s', (_name, act) => {
    it('returns 404 for a missing or deleted request', async () => {
      const { service } = setup(null);

      await expect(act(service)).rejects.toThrow(NotFoundException);
    });

    it('rejects changing a merged request', async () => {
      const { service, em } = setup({ id: 'f1' }, 1);

      await expect(act(service)).rejects.toThrow(ConflictException);
      expect(em.flush).not.toHaveBeenCalled();
    });
  });
});
