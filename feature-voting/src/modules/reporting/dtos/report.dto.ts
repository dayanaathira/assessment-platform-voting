import { Expose, Type } from 'class-transformer';
import { UserDto } from '../../user/dtos/user.dto';
import { DefaultDto } from '../../feature-request/dtos/default.dto';

export class ReportTotalsDto {
  @Expose()
  requests!: number;

  @Expose()
  votes!: number;

  @Expose()
  comments!: number;
}

export class StatusCountDto {
  @Expose()
  id!: number;

  @Expose()
  name!: string;

  @Expose()
  count!: number;
}

export class ReportRequestDto {
  @Expose()
  id!: string;

  @Expose()
  title!: string;

  @Expose()
  voteCount!: number;

  @Expose()
  commentCount!: number;

  @Expose()
  @Type(() => DefaultDto)
  status?: DefaultDto;

  @Expose()
  @Type(() => UserDto)
  createdBy?: UserDto;

  @Expose()
  createdAt!: Date;
}

export class ReportDto {
  @Expose()
  @Type(() => ReportTotalsDto)
  totals!: ReportTotalsDto;

  @Expose()
  @Type(() => StatusCountDto)
  byStatus!: StatusCountDto[];

  @Expose()
  @Type(() => ReportRequestDto)
  topVoted!: ReportRequestDto[];

  @Expose()
  @Type(() => ReportRequestDto)
  needsReview!: ReportRequestDto[];
}
