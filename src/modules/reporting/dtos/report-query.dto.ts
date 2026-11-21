import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { API_DATE_EXAMPLE } from '../../../common/const/date.const';
import { IsApiDate } from '../../../common/decorators/api-date.decorator';

export class ReportQueryDto {
  @ApiPropertyOptional({
    description: 'Earliest request created date, inclusive (DD-MM-YYYY).',
    example: API_DATE_EXAMPLE,
  })
  @IsApiDate()
  @IsOptional()
  fromDate?: string;

  @ApiPropertyOptional({
    description: 'Latest request created date, inclusive (DD-MM-YYYY).',
    example: API_DATE_EXAMPLE,
  })
  @IsApiDate()
  @IsOptional()
  toDate?: string;
}
