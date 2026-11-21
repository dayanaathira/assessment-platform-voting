import { Inject, Injectable } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER, WinstonLogger } from 'nest-winston';
import type * as Winston from 'winston';

/** Small wrapper around nest-winston's configured logger. */
@Injectable()
export class WinstonLoggerService {
  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly nestLogger: WinstonLogger,
  ) {}

  /**
   * @returns The underlying winston logger, for structured log calls.
   */
  public getLogger(): Winston.Logger {
    return this.nestLogger.getWinstonLogger();
  }

  /**
   * @returns The Nest-compatible logger, for `app.useLogger()`.
   */
  public getNestLogger(): WinstonLogger {
    return this.nestLogger;
  }
}
