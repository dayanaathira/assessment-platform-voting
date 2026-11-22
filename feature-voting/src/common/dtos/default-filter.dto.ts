import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { PaginationConstants } from '../const/pagination.const';

export class DefaultFilterDto {
  @ApiPropertyOptional({
    description: `Maximum items per page (1–${PaginationConstants.MAX_LIMIT})`,
    default: PaginationConstants.DEFAULT_LIMIT,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(PaginationConstants.MAX_LIMIT)
  @Type(() => Number)
  limit: number = PaginationConstants.DEFAULT_LIMIT;

  @ApiPropertyOptional({
    description: `Items to skip (0–${PaginationConstants.MAX_OFFSET})`,
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(PaginationConstants.MAX_OFFSET)
  @Type(() => Number)
  offset: number = 0;
}
