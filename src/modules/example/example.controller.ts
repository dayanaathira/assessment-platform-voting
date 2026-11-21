import { Body, Controller, Get, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CreateExampleDto } from './dto/create-example.dto';
import { ExampleService } from './example.service';
import type { ExampleItem } from './example.service';
import { CustomApiResponse } from '../../common/utils/api-response.util';

@ApiTags('example')
@Controller('examples')
export class ExampleController {
  constructor(private readonly exampleService: ExampleService) {}

  @Get()
  @CustomApiResponse('List of example items.', '', HttpStatus.OK)
  findAll(): ExampleItem[] {
    return this.exampleService.findAll();
  }

  @Post()
  @CustomApiResponse('Created example item.', '', HttpStatus.CREATED)
  create(@Body() input: CreateExampleDto): ExampleItem {
    return this.exampleService.create(input);
  }
}
