import { Expose, Type } from 'class-transformer';
import { DefaultAuditLogDto } from './default-audit-log.dto';
import { UserDto } from '../../user/dtos/user.dto';
import { FeatureRequestDto } from './feature-request.dto';

export class CommentDto extends DefaultAuditLogDto {
  @Expose()
  id!: string;

  @Expose()
  @Type(() => UserDto)
  user!: UserDto;

  @Expose()
  @Type(() => FeatureRequestDto)
  featureRequest!: FeatureRequestDto;

  @Expose()
  body!: string;
}
