import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiForbiddenResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { ROLE } from './user.const';
import { ResponseMessage } from '../../common/decorators/response.decorator';
import { CustomApiResponse } from '../../common/utils/api-response.util';
import { AddUserDto } from './dtos/add-user.dto';
import { UserDetailDto } from './dtos/user-detail.dto';
import { UserService } from './user.service';

@ApiTags('user')
@ApiBearerAuth()
@ApiForbiddenResponse({ description: 'Admin role required.' })
@Roles(ROLE.ADMIN)
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * @param dto - Name, username, password and role.
   * @returns The created user.
   */
  @Post()
  @ResponseMessage('User created')
  @CustomApiResponse(
    'Add a user',
    'Creates a user with one role. Usernames are unique and stored lower-case.',
    HttpStatus.CREATED,
  )
  create(@Body() dto: AddUserDto): Promise<UserDetailDto> {
    return this.userService.create(dto);
  }

  /**
   * @param id - The user id.
   * @returns The user with their roles.
   */
  @Get(':id')
  @CustomApiResponse(
    'Get a user',
    'Returns the user and their roles.',
    HttpStatus.OK,
  )
  view(@Param('id', ParseUUIDPipe) id: string): Promise<UserDetailDto> {
    return this.userService.view(id);
  }
}
