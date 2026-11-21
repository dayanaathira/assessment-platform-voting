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

  // Set when this request was merged away; the client redirects to it.
  @Expose()
  mergedIntoId?: string;

  @Expose()
  @Type(() => MergedRequestDto)
  mergedFrom!: MergedRequestDto[];
}
