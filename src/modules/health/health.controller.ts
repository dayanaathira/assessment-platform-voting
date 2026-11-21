import { Controller, Get, Res, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { HealthService } from './health.service';
import { RawResponse } from '../../common/decorators/response.decorator';

/**
 * Liveness and readiness, kept separate on purpose.
 *
 * Both are registered outside the global prefix and outside URI versioning,
 * so a probe URL is just `/health` and does not move when the service is
 * renamed or the API is versioned.
 */
@ApiExcludeController()
@RawResponse()
@Controller({ version: VERSION_NEUTRAL })
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /**
   * Liveness. Answers 200 as soon as the process is listening and never
   * checks the database — a brief database blip must not get healthy pods
   * restarted. It keeps answering 200 throughout a graceful shutdown, because
   * the question it answers is "is this process wedged", not "should it get
   * traffic".
   *
   * Note this says nothing during the migration window before app.listen().
   * That gap is a deployment concern: cover it with a startupProbe (or
   * initialDelaySeconds), not by weakening liveness.
   */
  @Get('health')
  liveness(): { status: string } {
    return { status: 'ok' };
  }

  /**
   * Readiness. 503 while the database is unreachable, and immediately on
   * SIGTERM so the load balancer stops sending new requests while in-flight
   * ones finish.
   *
   * The status is set directly rather than by throwing, so the deliberate 503
   * keeps its explanatory body — AllExceptionsFilter replaces the message on
   * any thrown 5xx, which is right for real failures and wrong here.
   */
  @Get('ready')
  async readiness(
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ status: string; database: string }> {
    if (this.healthService.isShuttingDown()) {
      response.status(503);
      return { status: 'shutting_down', database: 'not_checked' };
    }

    const databaseReachable = await this.healthService.isDatabaseReachable();

    response.status(databaseReachable ? 200 : 503);

    return {
      status: databaseReachable ? 'ready' : 'not_ready',
      database: databaseReachable ? 'up' : 'down',
    };
  }
}
