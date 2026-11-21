import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CustomApiResponse } from '../../common/utils/api-response.util';
import { ResponseMessage } from '../../common/decorators/response.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { AuthUser } from '../../common/types/auth-user.type';
import { DefaultFilterDto } from '../../common/dtos/default-filter.dto';
import { AddCommentDto } from './dtos/add-comment.dto';
import { AddFeatureRequestDto } from './dtos/add-feature-request.dto';
import { CommentDto } from './dtos/comment.dto';
import { CommentListDto } from './dtos/comment-list.dto';
import { DefaultDto } from './dtos/default.dto';
import { EditFeatureRequestDto } from './dtos/edit-feature-request.dto';
import { FeatureRequestDto } from './dtos/feature-request.dto';
import { FeatureRequestListDto } from './dtos/feature-request-list.dto';
import { ListFeatureRequestQueryDto } from './dtos/list-feature-request-query.dto';
import { FeatureRequestService } from './feature-request.service';

@ApiTags('feature-request')
@Controller('feature-request')
export class FeatureRequestController {
  constructor(private readonly featureRequestService: FeatureRequestService) {}

  /**
   * @param req - The request, carrying the authenticated user.
   * @param query - Search, status, created-date range, sort and paging.
   * @returns One page of requests and the total match count.
   */
  @Get()
  @CustomApiResponse(
    'List feature requests',
    'Excludes merged and deleted requests. Filters by search text, status and created date (DD-MM-YYYY); sorts by votes or newest.',
    HttpStatus.OK,
  )
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: ListFeatureRequestQueryDto,
  ): Promise<FeatureRequestListDto> {
    return this.featureRequestService.list(user.id, query);
  }

  /**
   * @param req - The request, carrying the authenticated user.
   * @param dto - Title and description.
   * @returns The created request.
   */
  @Post()
  @ResponseMessage('Feature request created')
  @CustomApiResponse(
    'Create a feature request',
    'Creates a request authored by the current user, starting as Under Review.',
    HttpStatus.CREATED,
  )
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: AddFeatureRequestDto,
  ): Promise<FeatureRequestDto> {
    return this.featureRequestService.create(user.id, dto);
  }

  /**
   * @returns Every status, in id order.
   */
  // Must stay above @Get(':id'), or "status" is matched as an id.
  @Public()
  @Get('status')
  @CustomApiResponse(
    'List statuses',
    'Returns every feature request status, in id order.',
    HttpStatus.OK,
  )
  listStatuses(): Promise<DefaultDto[]> {
    return this.featureRequestService.listStatuses();
  }

  /**
   * @param req - The request, carrying the authenticated user.
   * @param id - The feature request id.
   * @returns The request.
   */
  @Get(':id')
  @CustomApiResponse(
    'View a feature request',
    'Returns the request with hasVoted and its merge links.',
    HttpStatus.OK,
  )
  view(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<FeatureRequestDto> {
    return this.featureRequestService.view(user.id, id);
  }

  /**
   * @param req - The request, carrying the authenticated user.
   * @param id - The feature request id.
   * @param dto - Fields to change.
   * @returns The updated request.
   */
  @Patch(':id')
  @ResponseMessage('Feature request updated')
  @CustomApiResponse(
    'Edit a feature request',
    'Author only. Merged requests cannot be edited.',
    HttpStatus.OK,
  )
  edit(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EditFeatureRequestDto,
  ): Promise<FeatureRequestDto> {
    return this.featureRequestService.edit(user.id, id, dto);
  }

  /**
   * @param req - The request, carrying the authenticated user.
   * @param id - The feature request id.
   * @returns Resolves once the request is soft-deleted.
   */
  @Delete(':id')
  @ResponseMessage('Feature request deleted')
  @CustomApiResponse(
    'Delete a feature request',
    'Author only. Soft delete; merged requests cannot be deleted.',
    HttpStatus.OK,
  )
  delete(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.featureRequestService.delete(user.id, id);
  }

  /**
   * @param id - The feature request id.
   * @param dto - The comment body.
   * @returns The created comment.
   */
  @Post(':id/comments')
  @ResponseMessage('Comment added')
  @CustomApiResponse(
    'Add a comment',
    'Adds a comment to the request. Merged requests cannot be commented on.',
    HttpStatus.CREATED,
  )
  createComment(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddCommentDto,
  ): Promise<CommentDto> {
    return this.featureRequestService.createComment(user.id, id, dto);
  }

  /**
   * @param id - The feature request id.
   * @param query - Paging.
   * @returns One page of comments, newest first, and the total count.
   */
  @Get(':id/comments')
  @CustomApiResponse(
    'List comments',
    'Returns the request comments newest first, paged by limit and offset.',
    HttpStatus.OK,
  )
  listComments(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: DefaultFilterDto,
  ): Promise<CommentListDto> {
    return this.featureRequestService.listComments(id, query);
  }
}
