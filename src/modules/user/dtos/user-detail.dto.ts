import { Expose } from 'class-transformer';
import { UserDto } from './user.dto';

export class UserDetailDto extends UserDto {
  @Expose()
  roles!: string[];

  @Expose()
  createdAt!: Date;
}
