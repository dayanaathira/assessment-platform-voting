import { EntityManager, wrap } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { STATUS_ID } from '../../common/const/status.const';
import { businessDayRange } from '../../common/utils/date.util';
import { Comment } from '../feature-request/entities/comment.entity';
import { FeatureRequest } from '../feature-request/entities/feature-request.entity';
import { Status } from '../feature-request/entities/status.entity';
import { Vote } from '../feature-request/entities/votes.entity';
import { USER_FIELDS } from '../user/user.const';
import { ReportQueryDto } from './dtos/report-query.dto';
import { ReportDto } from './dtos/report.dto';

const TOP_VOTED_LIMIT = 5;
const NEEDS_REVIEW_LIMIT = 10;

@Injectable()
export class ReportingService {
  constructor(private readonly em: EntityManager) {}

  /**
   * Admin dashboard figures. Covers requests created in the date range (all
   * time if none), excluding merged and deleted ones; vote and comment totals
   * are those on the same requests.
   *
   * @param query - Optional created-date range.
   * @returns Totals, counts per status, top voted and oldest under review.
   */
  async getReport(query: ReportQueryDto): Promise<ReportDto> {
    const createdAt = businessDayRange(query.fromDate, query.toDate);
    const requests = {
      merges: { $none: {} },
      ...(createdAt && { createdAt }),
    };
    // Merges move votes and comments off the source, so only the date range
    // matters here; deleted requests are dropped by the soft-delete filter.
    const onRequests = createdAt ? { featureRequest: { createdAt } } : {};

    const [
      requestTotal,
      voteTotal,
      commentTotal,
      statusCounts,
      statuses,
      topVoted,
      needsReview,
    ] = await Promise.all([
      this.em.count(FeatureRequest, requests),
      this.em.count(Vote, onRequests),
      this.em.count(Comment, onRequests),
      this.em.countBy(FeatureRequest, 'status', { where: requests }),
      this.em.find(Status, {}, { orderBy: { id: 'asc' } }),
      this.em.find(FeatureRequest, requests, {
        populate: ['status'],
        orderBy: { voteCount: 'desc', createdAt: 'desc', id: 'desc' },
        limit: TOP_VOTED_LIMIT,
      }),
      this.em.find(
        FeatureRequest,
        { ...requests, status: STATUS_ID.UNDER_REVIEW },
        {
          populate: ['createdBy'],
          fields: [
            'id',
            'title',
            'voteCount',
            'commentCount',
            'createdAt',
            ...USER_FIELDS.map((f) => `createdBy.${f}` as const),
          ],
          orderBy: { createdAt: 'asc', id: 'asc' },
          limit: NEEDS_REVIEW_LIMIT,
        },
      ),
    ]);

    return plainToInstance(
      ReportDto,
      {
        totals: {
          requests: requestTotal,
          votes: voteTotal,
          comments: commentTotal,
        },
        byStatus: statuses.map((s) => ({
          id: s.id,
          name: s.name,
          count: statusCounts[s.id] ?? 0,
        })),
        topVoted: topVoted.map((f) => wrap(f).toObject()),
        needsReview: needsReview.map((f) => wrap(f).toObject()),
      },
      { excludeExtraneousValues: true },
    );
  }
}
