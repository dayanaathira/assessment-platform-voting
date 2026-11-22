import { Expose } from 'class-transformer';

export class DefaultDto {
  @Expose()
  id!: string | number;

  @Expose()
  name!: string;
}
