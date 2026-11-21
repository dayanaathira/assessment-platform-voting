import { Expose, Type } from 'class-transformer';
import { DefaultDto } from './default.dto';
import { DefaultAuditLogDto } from './default-audit-log.dto';
import { UserDto } from '../../user/dtos/user.dto';

export class MergedRequestDto {
  @Expose()
  id!: string;

  @Expose()
  title!: string;
}

export class MergedIntoDto extends MergedRequestDto {
  @Expose()
  mergedAt!: Date;

  @Expose()
  @Type(() => UserDto)
  mergedBy!: UserDto;
}

export class FeatureRequestDto extends DefaultAuditLogDto {
  @Expose()
  id!: string;

  @Expose()
  title!: string;

  @Expose()
  description!: string;

  @Expose()
  @Type(() => DefaultDto)
  status!: DefaultDto;

  @Expose()
  voteCount!: number;

  @Expose()
  commentCount!: number;

  @Expose()
  officialResponse?: string;

  @Expose()
  officialResponseAt?: Date;

  @Expose()
  @Type(() => UserDto)
  officialResponseBy?: UserDto;

  @Expose()
  hasVoted!: boolean;

  // False once the request is Released or Declined.
  @Expose()
  canVote!: boolean;

  // The request this one was merged into, or null; the client links to it.
  @Expose()
  @Type(() => MergedIntoDto)
  mergedInto!: MergedIntoDto | null;

  @Expose()
  @Type(() => MergedRequestDto)
  mergedFrom!: MergedRequestDto[];
}
