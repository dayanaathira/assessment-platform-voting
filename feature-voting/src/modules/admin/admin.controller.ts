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
import { ApiBearerAuth, ApiForbiddenResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { ROLE } from '../user/user.const';
import { ResponseMessage } from '../../common/decorators/response.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/types/auth-user.type';
import { CustomApiResponse } from '../../common/utils/api-response.util';
import { FeatureRequestDto } from '../feature-request/dtos/feature-request.dto';
import { RequestMergeDto } from '../feature-request/dtos/request-merge.dto';
import { AdminService } from './admin.service';
import { MergeRequestDto } from './dtos/merge-request.dto';
import { OfficialResponseDto } from './dtos/official-response.dto';
import { UpdateStatusDto } from './dtos/update-status.dto';
import { MergeService } from './merge.service';

@ApiTags('admin')
@ApiBearerAuth()
@ApiForbiddenResponse({ description: 'Admin role required.' })
@Roles(ROLE.ADMIN)
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
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStatusDto,
  ): Promise<FeatureRequestDto> {
    return this.adminService.updateStatus(user.id, id, dto);
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
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: OfficialResponseDto,
  ): Promise<FeatureRequestDto> {
    return this.adminService.setResponse(user.id, id, dto);
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
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MergeRequestDto,
  ): Promise<RequestMergeDto> {
    return this.mergeService.merge(user.id, id, dto);
  }
}
