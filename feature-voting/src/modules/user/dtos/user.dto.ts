import { Expose } from 'class-transformer';
import { DefaultDto } from '../../feature-request/dtos/default.dto';

export class UserDto extends DefaultDto {
  @Expose()
  username!: string;
}
