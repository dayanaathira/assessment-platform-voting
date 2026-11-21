import { Expose } from 'class-transformer';

export class ViewExampleDto {
  @Expose()
  name!: string;
}
