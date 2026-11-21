import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from '../../common/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * @returns A static greeting, useful as a liveness check.
   */
  @Public()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
