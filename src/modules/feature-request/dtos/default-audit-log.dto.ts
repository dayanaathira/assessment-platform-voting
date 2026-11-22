import { Expose, Type } from 'class-transformer';
import { UserDto } from '../../user/dtos/user.dto';

export class DefaultAuditLogDto {
  @Expose()
  @Type(() => UserDto)
  createdBy!: UserDto;

  @Expose()
  createdAt!: Date;

  @Expose()
  @Type(() => UserDto)
  updatedBy?: UserDto;

  @Expose()
  updatedAt?: Date;
}
