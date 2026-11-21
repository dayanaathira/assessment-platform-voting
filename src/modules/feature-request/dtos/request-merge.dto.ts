import { Expose, Type } from 'class-transformer';
import { FeatureRequestDto } from './feature-request.dto';
import { UserDto } from '../../user/dtos/user.dto';

export class RequestMergeDto {
  @Expose()
  id!: string;

  @Expose()
  @Type(() => FeatureRequestDto)
  sourceRequest!: FeatureRequestDto;

  @Expose()
  @Type(() => FeatureRequestDto)
  targetRequest!: FeatureRequestDto;

  @Expose()
  votesMoved?: number;

  @Expose()
  commentsMoved?: number;

  @Expose()
  @Type(() => UserDto)
  createdBy!: UserDto;

  @Expose()
  createdAt!: Date;
}
