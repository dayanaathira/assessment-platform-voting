import { Expose, Type } from 'class-transformer';
import { UserDto } from '../../user/dtos/user.dto';

export class RequestMergeDto {
  @Expose()
  id!: string;

  @Expose()
  sourceRequestId!: string;

  @Expose()
  targetRequestId!: string;

  // Votes newly added to the target; voters already on it aren't counted.
  @Expose()
  votesMoved!: number;

  @Expose()
  commentsMoved!: number;

  @Expose()
  @Type(() => UserDto)
  createdBy!: UserDto;

  @Expose()
  createdAt!: Date;
}
