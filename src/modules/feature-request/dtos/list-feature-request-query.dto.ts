import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { API_DATE_EXAMPLE } from '../../../common/const/date.const';
import { STATUS_ID } from '../../../common/const/status.const';
import { IsApiDate } from '../../../common/decorators/api-date.decorator';
import { DefaultFilterDto } from '../../../common/dtos/default-filter.dto';
import { trimString } from '../../../common/utils/query.util';

export const FEATURE_REQUEST_SORTS = ['votes', 'new'] as const;
export type FeatureRequestSort = (typeof FEATURE_REQUEST_SORTS)[number];

export class ListFeatureRequestQueryDto extends DefaultFilterDto {
  @ApiPropertyOptional({ description: 'Searches title and description.' })
  @Transform(trimString)
  @IsString()
  @MaxLength(100)
  @IsOptional()
  q?: string;

  @ApiPropertyOptional({ enum: Object.values(STATUS_ID) })
  @Type(() => Number)
  @IsInt()
  @IsIn(Object.values(STATUS_ID))
  @IsOptional()
  status?: number;

  @ApiPropertyOptional({
    description: 'Earliest created date, inclusive (DD-MM-YYYY).',
    example: API_DATE_EXAMPLE,
  })
  @IsApiDate()
  @IsOptional()
  fromDate?: string;

  @ApiPropertyOptional({
    description: 'Latest created date, inclusive (DD-MM-YYYY).',
    example: API_DATE_EXAMPLE,
  })
  @IsApiDate()
  @IsOptional()
  toDate?: string;

  @ApiPropertyOptional({ enum: FEATURE_REQUEST_SORTS, default: 'votes' })
  @IsIn(FEATURE_REQUEST_SORTS)
  @IsOptional()
  sort: FeatureRequestSort = 'votes';
}
