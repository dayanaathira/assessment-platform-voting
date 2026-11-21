import { Expose } from 'class-transformer';

export class AuthUserDto {
  @Expose()
  id!: string;

  @Expose()
  name!: string;

  @Expose()
  roles!: string[];
}
