import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import { map, Observable } from 'rxjs';
import {
  RAW_RESPONSE_KEY,
  RESPONSE_MESSAGE_KEY,
} from '../decorators/response.decorator';

/** The shape of every successful response. Errors use AllExceptionsFilter's. */
export interface ApiResponseBody<T> {
  statusCode: number;
  message?: string;
  data?: T;
}

/** Wraps successful responses as `{ statusCode, message?, data? }`. */
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  /**
   * @param context - The current request context.
   * @param next - The route handler.
   * @returns The handler's result, wrapped unless the route opts out.
   */
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const targets = [context.getHandler(), context.getClass()];

    if (this.reflector.getAllAndOverride<boolean>(RAW_RESPONSE_KEY, targets)) {
      return next.handle();
    }

    const message = this.reflector.getAllAndOverride<string>(
      RESPONSE_MESSAGE_KEY,
      targets,
    );

    return next.handle().pipe(
      map((data): ApiResponseBody<unknown> => ({
        statusCode: context.switchToHttp().getResponse<Response>().statusCode,
        message,
        data,
      })),
    );
  }
}
