import { Expose, Type } from 'class-transformer';
import { FeatureRequestDto } from './feature-request.dto';

export class FeatureRequestListDto {
  @Expose()
  @Type(() => FeatureRequestDto)
  items!: FeatureRequestDto[];

  @Expose()
  total!: number;

  @Expose()
  limit!: number;

  @Expose()
  offset!: number;
}
