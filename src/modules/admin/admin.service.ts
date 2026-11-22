import { EntityManager, wrap } from '@mikro-orm/postgresql';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { User } from '../user/entities/user.entity';
import { FeatureRequestDto } from '../feature-request/dtos/feature-request.dto';
import { FeatureRequest } from '../feature-request/entities/feature-request.entity';
import { RequestMerge } from '../feature-request/entities/request-merge.entity';
import { Status } from '../feature-request/entities/status.entity';
import { FeatureRequestService } from '../feature-request/feature-request.service';
import { OfficialResponseDto } from './dtos/official-response.dto';
import { UpdateStatusDto } from './dtos/update-status.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly em: EntityManager,
    private readonly featureRequestService: FeatureRequestService,
  ) {}

  /**
   * Changes a request's status.
   *
   * @param userId - The admin's id.
   * @param id - The feature request id.
   * @param dto - The new status.
   * @returns The updated request.
   */
  async updateStatus(
    userId: string,
    id: string,
    dto: UpdateStatusDto,
  ): Promise<FeatureRequestDto> {
    const feature = await this.findEditable(id);

    wrap(feature).assign({
      status: this.em.getReference(Status, dto.statusId),
      updatedBy: this.em.getReference(User, userId),
    });
    await this.em.flush();

    return this.featureRequestService.view(userId, id);
  }

  /**
   * Sets or replaces the official response on a request.
   *
   * @param userId - The admin's id.
   * @param id - The feature request id.
   * @param dto - The response text.
   * @returns The updated request.
   */
  async setResponse(
    userId: string,
    id: string,
    dto: OfficialResponseDto,
  ): Promise<FeatureRequestDto> {
    const feature = await this.findEditable(id);
    const admin = this.em.getReference(User, userId);

    wrap(feature).assign({
      officialResponse: dto.response,
      officialResponseAt: new Date(),
      officialResponseBy: admin,
      updatedBy: admin,
    });
    await this.em.flush();

    return this.featureRequestService.view(userId, id);
  }

  /**
   * @param id - The feature request id.
   * @returns The request, if it exists and hasn't been merged away.
   */
  private async findEditable(id: string): Promise<FeatureRequest> {
    const [feature, merged] = await Promise.all([
      this.em.findOne(FeatureRequest, { id }),
      this.em.count(RequestMerge, { sourceRequest: id }),
    ]);

    if (!feature) {
      throw new NotFoundException('Feature request not found');
    }
    if (merged > 0) {
      throw new ConflictException('Merged requests cannot be changed');
    }

    return feature;
  }
}
