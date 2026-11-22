import { EntityManager, LockMode } from '@mikro-orm/postgresql';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { User } from '../user/entities/user.entity';
import { USER_FIELDS } from '../user/user.const';
import { RequestMergeDto } from '../feature-request/dtos/request-merge.dto';
import { Comment } from '../feature-request/entities/comment.entity';
import { FeatureRequest } from '../feature-request/entities/feature-request.entity';
import { RequestMerge } from '../feature-request/entities/request-merge.entity';
import { Vote } from '../feature-request/entities/votes.entity';
import { MergeRequestDto } from './dtos/merge-request.dto';

@Injectable()
export class MergeService {
  constructor(private readonly em: EntityManager) {}

  /**
   * Merges one request into another in a single transaction: votes move with
   * overlapping voters counted once, comments move, and both counts are
   * recomputed.
   *
   * @param userId - The admin's id.
   * @param sourceId - The request being merged away.
   * @param dto - The target request id.
   * @returns The merge record.
   */
  async merge(
    userId: string,
    sourceId: string,
    dto: MergeRequestDto,
  ): Promise<RequestMergeDto> {
    const { targetId } = dto;
    if (sourceId === targetId) {
      throw new BadRequestException('A request cannot be merged into itself');
    }

    const { merge, admin } = await this.em.transactional(async (em) => {
      // Locked in id order so two merges over the same pair can't deadlock.
      const locked = await em.find(
        FeatureRequest,
        { id: { $in: [sourceId, targetId] } },
        { lockMode: LockMode.PESSIMISTIC_WRITE, orderBy: { id: 'asc' } },
      );
      const source = locked.find((f) => f.id === sourceId);
      const target = locked.find((f) => f.id === targetId);
      if (!source || !target) {
        throw new NotFoundException('Feature request not found');
      }

      await this.assertMergeable(em, sourceId, targetId);

      // Loaded so the merge record can say who merged it.
      const admin = await em.findOne(User, userId, { fields: USER_FIELDS });
      if (!admin) {
        throw new NotFoundException('User not found');
      }

      // Bookkeeping on rows already checked above, so skip the soft-delete join.
      const noFilters = { filters: false };
      const voters = await em.find(
        Vote,
        { featureRequest: sourceId },
        { fields: ['user'], ...noFilters },
      );
      let votesMoved = 0;
      if (voters.length > 0) {
        const inserted = await em
          .createQueryBuilder(Vote)
          .insert(
            voters.map((v) => ({ user: v.user.id, featureRequest: targetId })),
          )
          .onConflict(['user', 'featureRequest'])
          .ignore()
          .execute();
        votesMoved = inserted.affectedRows;
        await em.nativeDelete(Vote, { featureRequest: sourceId }, noFilters);
      }

      const commentsMoved = await em.nativeUpdate(
        Comment,
        { featureRequest: sourceId },
        { featureRequest: targetId },
        noFilters,
      );

      const voteCount = await em.count(
        Vote,
        { featureRequest: targetId },
        noFilters,
      );
      const commentCount = await em.count(
        Comment,
        { featureRequest: targetId },
        noFilters,
      );

      const adminRef = em.getReference(User, userId);
      target.voteCount = voteCount;
      target.commentCount = commentCount;
      target.updatedBy = adminRef;
      source.voteCount = 0;
      source.commentCount = 0;
      source.updatedBy = adminRef;

      const created = em.create(RequestMerge, {
        sourceRequest: source,
        targetRequest: target,
        createdBy: adminRef,
        votesMoved,
        commentsMoved,
      });
      await em.flush();

      return { merge: created, admin };
    });

    return plainToInstance(
      RequestMergeDto,
      {
        id: merge.id,
        sourceRequestId: sourceId,
        targetRequestId: targetId,
        votesMoved: merge.votesMoved,
        commentsMoved: merge.commentsMoved,
        createdBy: { id: admin.id, name: admin.name, username: admin.username },
        createdAt: merge.createdAt,
      },
      { excludeExtraneousValues: true },
    );
  }

  /**
   * Rejects merges that would chain: the source or target already merged
   * away, or the source already holding merged requests.
   *
   * @param em - The transaction's entity manager.
   * @param sourceId - The request being merged away.
   * @param targetId - The request to merge into.
   * @returns Resolves if the merge is allowed.
   */
  private async assertMergeable(
    em: EntityManager,
    sourceId: string,
    targetId: string,
  ): Promise<void> {
    const existing = await em.find(
      RequestMerge,
      {
        $or: [
          { sourceRequest: { $in: [sourceId, targetId] } },
          { targetRequest: sourceId },
        ],
      },
      { filters: false },
    );

    for (const m of existing) {
      if (m.sourceRequest.id === sourceId) {
        throw new ConflictException('This request has already been merged');
      }
      if (m.sourceRequest.id === targetId) {
        throw new ConflictException(
          'Cannot merge into a request that has been merged',
        );
      }
    }
    if (existing.length > 0) {
      throw new ConflictException(
        'Cannot merge a request that other requests were merged into',
      );
    }
  }
}
