import { Controller, Get, HttpStatus, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CustomApiResponse } from '../../common/utils/api-response.util';
import { ReportQueryDto } from './dtos/report-query.dto';
import { ReportDto } from './dtos/report.dto';
import { ReportingService } from './reporting.service';

@ApiTags('admin')
@Controller('admin/reporting')
export class ReportingController {
  constructor(private readonly reportingService: ReportingService) {}

  /**
   * @param query - Optional created-date range.
   * @returns The admin dashboard figures.
   */
  @Get()
  @CustomApiResponse(
    'Admin report',
    'Admin only. Totals, counts per status, top voted and oldest Under Review requests, excluding merged and deleted ones. Optionally limited to requests created between fromDate and toDate (DD-MM-YYYY).',
    HttpStatus.OK,
  )
  getReport(@Query() query: ReportQueryDto): Promise<ReportDto> {
    return this.reportingService.getReport(query);
  }
}
