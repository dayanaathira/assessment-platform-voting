import {
  Body,
  Controller,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ResponseMessage } from '../../common/decorators/response.decorator';
import { CustomApiResponse } from '../../common/utils/api-response.util';
import { FeatureRequestDto } from '../feature-request/dtos/feature-request.dto';
import { RequestMergeDto } from '../feature-request/dtos/request-merge.dto';
import { AdminService } from './admin.service';
import { MergeRequestDto } from './dtos/merge-request.dto';
import { OfficialResponseDto } from './dtos/official-response.dto';
import { UpdateStatusDto } from './dtos/update-status.dto';
import { MergeService } from './merge.service';

@ApiTags('admin')
@Controller('admin/feature-request')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly mergeService: MergeService,
  ) {}

  /**
   * @param id - The feature request id.
   * @param dto - The new status.
   * @returns The updated request.
   */
  @Patch(':id/status')
  @ResponseMessage('Status updated')
  @CustomApiResponse(
    'Update status',
    'Admin only. Merged requests cannot be changed.',
    HttpStatus.OK,
  )
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStatusDto,
  ): Promise<FeatureRequestDto> {
    return this.adminService.updateStatus('', id, dto);
  }

  /**
   * @param id - The feature request id.
   * @param dto - The response text.
   * @returns The updated request.
   */
  @Put(':id/response')
  @ResponseMessage('Official response saved')
  @CustomApiResponse(
    'Set official response',
    'Admin only. Replaces any existing response. Merged requests cannot be changed.',
    HttpStatus.OK,
  )
  setResponse(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: OfficialResponseDto,
  ): Promise<FeatureRequestDto> {
    return this.adminService.setResponse('', id, dto);
  }

  /**
   * @param id - The request being merged away.
   * @param dto - The target request id.
   * @returns The merge record.
   */
  @Post(':id/merge')
  @ResponseMessage('Feature request merged')
  @CustomApiResponse(
    'Merge into another request',
    'Admin only. Moves votes (overlapping voters counted once) and comments to the target.',
    HttpStatus.CREATED,
  )
  merge(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MergeRequestDto,
  ): Promise<RequestMergeDto> {
    return this.mergeService.merge('', id, dto);
  }
}
