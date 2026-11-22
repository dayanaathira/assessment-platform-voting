import { Expose, Type } from 'class-transformer';
import { UserDto } from '../../user/dtos/user.dto';
import { FeatureRequestDto } from './feature-request.dto';

export class VotesDto {
  @Expose()
  @Type(() => UserDto)
  user!: UserDto;

  @Expose()
  @Type(() => FeatureRequestDto)
  featureRequest!: FeatureRequestDto;

  @Expose()
  createdAt!: Date;
}
