import { Expose } from 'class-transformer';

export class DefaultDto {
  @Expose()
  id!: string;

  @Expose()
  name!: string;
}
