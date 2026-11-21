import { EntityManager, LockMode, wrap } from '@mikro-orm/postgresql';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { STATUS_ID } from '../../common/const/status.const';
import { nextDay, startOfBusinessDay } from '../../common/utils/date.util';
import { containsPattern } from '../../common/utils/query.util';
import { User } from '../user/entities/user.entity';
import { USER_FIELDS } from '../user/user.const';
import { AddCommentDto } from './dtos/add-comment.dto';
import { AddFeatureRequestDto } from './dtos/add-feature-request.dto';
import { DefaultFilterDto } from '../../common/dtos/default-filter.dto';
import { CommentDto } from './dtos/comment.dto';
import { CommentListDto } from './dtos/comment-list.dto';
import { EditFeatureRequestDto } from './dtos/edit-feature-request.dto';
import { FeatureRequestDto } from './dtos/feature-request.dto';
import { FeatureRequestListDto } from './dtos/feature-request-list.dto';
import { ListFeatureRequestQueryDto } from './dtos/list-feature-request-query.dto';
import { Comment } from './entities/comment.entity';
import { FeatureRequest } from './entities/feature-request.entity';
import { RequestMerge } from './entities/request-merge.entity';
import { Status } from './entities/status.entity';
import { Vote } from './entities/votes.entity';

@Injectable()
export class FeatureRequestService {
  constructor(private readonly em: EntityManager) {}

  /**
   * Lists requests, excluding merged and deleted ones, with whether the user
   * voted on each.
   *
   * @param userId - The viewing user's id.
   * @param query - Search, status, created-date range, sort and paging.
   * @returns One page of requests and the total match count.
   */
  async list(
    userId: string,
    query: ListFeatureRequestQueryDto,
  ): Promise<FeatureRequestListDto> {
    const { q, status, fromDate, toDate, sort, limit, offset } = query;
    const pattern = q ? containsPattern(q) : undefined;

    const qb = this.em
      .createQueryBuilder(FeatureRequest, 'fr')
      .leftJoinAndSelect('fr.status', 's')
      .leftJoinAndSelect('fr.createdBy', 'cb', {}, USER_FIELDS)
      .leftJoinAndSelect('fr.updatedBy', 'ub', {}, USER_FIELDS)
      .leftJoinAndSelect('fr.officialResponseBy', 'rb', {}, USER_FIELDS)
      .where({
        ...(pattern && {
          $or: [
            { title: { $ilike: pattern } },
            { description: { $ilike: pattern } },
          ],
        }),
        merges: { $none: {} },
        ...(status && { status }),
        ...((fromDate || toDate) && {
          createdAt: {
            ...(fromDate && { $gte: startOfBusinessDay(fromDate) }),
            ...(toDate && { $lt: startOfBusinessDay(nextDay(toDate)) }),
          },
        }),
      })
      .orderBy(
        sort === 'new'
          ? { createdAt: 'desc', id: 'desc' }
          : { voteCount: 'desc', createdAt: 'desc', id: 'desc' },
      )
      .limit(limit)
      .offset(offset);
    await qb.applyFilters();

    const [features, total] = await qb.getResultAndCount();
    const votes = features.length
      ? await this.em.find(
          Vote,
          { user: userId, featureRequest: { $in: features.map((f) => f.id) } },
          { fields: ['featureRequest'] },
        )
      : [];
    const voted = new Set(votes.map((v) => v.featureRequest.id));

    return plainToInstance(
      FeatureRequestListDto,
      {
        items: features.map((f) => ({
          ...wrap(f).toObject(),
          hasVoted: voted.has(f.id),
        })),
        total,
        limit,
        offset,
      },
      { excludeExtraneousValues: true },
    );
  }

  /**
   * Creates a feature request authored by the user, starting as Under Review.
   *
   * @param userId - The author's id.
   * @param dto - Title and description.
   * @returns The created request.
   */
  async create(
    userId: string,
    dto: AddFeatureRequestDto,
  ): Promise<FeatureRequestDto> {
    const feature = this.em.create(FeatureRequest, {
      title: dto.title,
      description: dto.description,
      status: this.em.getReference(Status, STATUS_ID.UNDER_REVIEW),
      createdBy: this.em.getReference(User, userId),
    });
    await this.em.flush();

    return this.view(userId, feature.id);
  }

  /**
   * Edits the title or description. Only the author may edit, and merged
   * requests are read-only.
   *
   * @param userId - The editing user's id.
   * @param id - The feature request id.
   * @param dto - Fields to change.
   * @returns The updated request.
   */
  async edit(
    userId: string,
    id: string,
    dto: EditFeatureRequestDto,
  ): Promise<FeatureRequestDto> {
    const [feature, merged] = await Promise.all([
      this.em.findOne(FeatureRequest, { id }),
      this.em.count(RequestMerge, { sourceRequest: id }),
    ]);

    if (!feature) {
      throw new NotFoundException('Feature request not found');
    }
    if (feature.createdBy.id !== userId) {
      throw new ForbiddenException('Only the author can edit this request');
    }
    if (merged > 0) {
      throw new ConflictException('Merged requests cannot be edited');
    }

    wrap(feature).assign({
      title: dto.title ?? feature.title,
      description: dto.description ?? feature.description,
      updatedBy: this.em.getReference(User, userId),
    });
    await this.em.flush();

    return this.view(userId, id);
  }

  /**
   * Soft-deletes a request; its comments and votes are kept. Only the author
   * may delete, and requests in a merge are kept for its history.
   *
   * @param userId - The deleting user's id.
   * @param id - The feature request id.
   * @returns Resolves once the request is flagged as deleted.
   */
  async delete(userId: string, id: string): Promise<void> {
    const [feature, merges] = await Promise.all([
      this.em.findOne(FeatureRequest, { id }),
      this.em.count(RequestMerge, {
        $or: [{ sourceRequest: id }, { targetRequest: id }],
      }),
    ]);

    if (!feature) {
      throw new NotFoundException('Feature request not found');
    }
    if (feature.createdBy.id !== userId) {
      throw new ForbiddenException('Only the author can delete this request');
    }
    if (merges > 0) {
      throw new ConflictException('Merged requests cannot be deleted');
    }

    wrap(feature).assign({
      deleteFlag: true,
      updatedBy: this.em.getReference(User, userId),
    });
    await this.em.flush();
  }

  /**
   * Adds a comment and bumps the request's comment count in one transaction.
   * The request row is locked so concurrent comments and merges can't race the
   * count.
   *
   * @param userId - The commenting user's id.
   * @param featureRequestId - The feature request id.
   * @param dto - The comment body.
   * @returns The created comment.
   */
  async createComment(
    userId: string,
    featureRequestId: string,
    dto: AddCommentDto,
  ): Promise<CommentDto> {
    const comment = await this.em.transactional(async (em) => {
      const feature = await em.findOne(
        FeatureRequest,
        { id: featureRequestId },
        { lockMode: LockMode.PESSIMISTIC_WRITE },
      );
      if (!feature) {
        throw new NotFoundException('Feature request not found');
      }

      const merged = await em.count(RequestMerge, {
        sourceRequest: featureRequestId,
      });
      if (merged > 0) {
        throw new ConflictException(
          "Comments can't be added to a merged request",
        );
      }

      // Loaded so the response carries the user's name, not just the id.
      const user = await em.findOne(User, userId, { fields: USER_FIELDS });
      if (!user) {
        throw new NotFoundException('User not found');
      }

      const userRef = em.getReference(User, userId);
      const created = em.create(Comment, {
        user: userRef,
        featureRequest: feature,
        body: dto.body,
        createdBy: userRef,
      });
      feature.commentCount += 1;
      await em.flush();

      return created;
    });

    return plainToInstance(
      CommentDto,
      { ...wrap(comment).toObject(), featureRequestId },
      { excludeExtraneousValues: true },
    );
  }

  /**
   * Lists a request's comments, newest first.
   *
   * @param featureRequestId - The feature request id.
   * @param query - Paging.
   * @returns One page of comments and the total count.
   */
  async listComments(
    featureRequestId: string,
    query: DefaultFilterDto,
  ): Promise<CommentListDto> {
    const { limit, offset } = query;
    const [exists, comments, total] = await Promise.all([
      this.em.count(FeatureRequest, { id: featureRequestId }),
      this.em.find(
        Comment,
        { featureRequest: featureRequestId },
        {
          populate: ['user'],
          fields: [
            'id',
            'body',
            'createdAt',
            'updatedAt',
            'user.id',
            'user.name',
            'user.username',
          ],
          orderBy: { createdAt: 'desc', id: 'desc' },
          limit,
          offset,
        },
      ),
      // The request check above covers soft deletes, so skip the filter join.
      this.em.count(
        Comment,
        { featureRequest: featureRequestId },
        { filters: false },
      ),
    ]);

    if (!exists) {
      throw new NotFoundException('Feature request not found');
    }

    return plainToInstance(
      CommentListDto,
      {
        items: comments.map((c) => ({
          ...wrap(c).toObject(),
          featureRequestId,
        })),
        total,
        limit,
        offset,
      },
      { excludeExtraneousValues: true },
    );
  }

  /**
   * Returns one request with whether the user voted on it and its merge links.
   *
   * @param userId - The viewing user's id.
   * @param id - The feature request id.
   * @returns The request.
   */
  async view(userId: string, id: string): Promise<FeatureRequestDto> {
    const [feature, votes, mergedInto, mergedFrom] = await Promise.all([
      this.em.findOne(
        FeatureRequest,
        { id },
        {
          populate: ['status', 'createdBy', 'updatedBy', 'officialResponseBy'],
        },
      ),
      this.em.count(Vote, { user: userId, featureRequest: id }),
      this.em.findOne(RequestMerge, { sourceRequest: id }),
      this.em.find(
        RequestMerge,
        { targetRequest: id },
        { populate: ['sourceRequest'] },
      ),
    ]);

    if (!feature) {
      throw new NotFoundException('Feature request not found');
    }

    return plainToInstance(
      FeatureRequestDto,
      {
        ...wrap(feature).toObject(),
        hasVoted: votes > 0,
        mergedIntoId: mergedInto?.targetRequest.id,
        mergedFrom: mergedFrom.map((m) => ({
          id: m.sourceRequest.id,
          title: m.sourceRequest.title,
        })),
      },
      { excludeExtraneousValues: true },
    );
  }
}
