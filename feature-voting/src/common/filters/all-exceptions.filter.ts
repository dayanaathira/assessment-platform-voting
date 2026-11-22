import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { GENERIC_SERVER_ERROR_MESSAGE } from '../const/error.const';
import { WinstonLoggerService } from '../logger/winston-logger.service';

/** The one shape every error response from this service has. */
export interface ErrorResponseBody {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
}

/**
 * Turns every uncaught error into one stable response shape. 4xx messages
 * pass through; 5xx messages are replaced so driver text and SQL never reach
 * the caller.
 */
@Catch()
@Injectable()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: WinstonLoggerService) {}

  /**
   * @param exception - Whatever was thrown.
   * @param host - The current execution context.
   * @returns Nothing; writes the error response.
   */
  catch(exception: unknown, host: ArgumentsHost): void {
    // switchToHttp() on a non-HTTP transport would throw a second, more confusing error.
    if (host.getType() !== 'http') {
      throw exception;
    }

    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const body: ErrorResponseBody = {
      statusCode: status,
      error: HttpStatus[status] ?? 'ERROR',
      message: this.resolvePublicMessage(exception, status),
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    this.logFailure(exception, request, status);

    response.status(status).json(body);
  }

  /**
   * @param exception - Whatever was thrown.
   * @param status - The resolved HTTP status.
   * @returns The message that is safe to send to the caller.
   */
  private resolvePublicMessage(
    exception: unknown,
    status: number,
  ): string | string[] {
    if (
      status >= HttpStatus.INTERNAL_SERVER_ERROR ||
      !(exception instanceof HttpException)
    ) {
      return GENERIC_SERVER_ERROR_MESSAGE;
    }

    const response = exception.getResponse();

    if (typeof response === 'string') {
      return response;
    }

    // ValidationPipe puts its per-field errors here as a string array.
    const message = (response as { message?: unknown }).message;

    if (
      typeof message === 'string' ||
      (Array.isArray(message) && message.every((it) => typeof it === 'string'))
    ) {
      return message;
    }

    return exception.message;
  }

  /**
   * Logs the full detail, which never goes in the response.
   *
   * @param exception - Whatever was thrown.
   * @param request - The failed request.
   * @param status - The resolved HTTP status.
   * @returns Nothing.
   */
  private logFailure(
    exception: unknown,
    request: Request,
    status: number,
  ): void {
    const context = `${request.method} ${request.url} -> ${status}`;

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.getLogger().error(context, {
        label: AllExceptionsFilter.name,
        stack: exception instanceof Error ? exception.stack : String(exception),
      });
      return;
    }

    this.logger
      .getLogger()
      .warn(
        `${context}: ${exception instanceof Error ? exception.message : String(exception)}`,
        { label: AllExceptionsFilter.name },
      );
  }
}
